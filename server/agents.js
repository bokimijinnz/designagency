/*
 * AI agents for the studio. Everything they write is a draft for the designer:
 * it is stored on the request as studio-only data (never shown to clients)
 * and nothing is sent to a client without the designer pressing a button.
 *
 *   intake   — new request → web research → brief with brand concept,
 *              three logo directions, quote draft, questions, marketing plan
 *   reply    — drafts a reply to the client's latest message, in their language
 *   round    — turns a client feedback round into a task list for the designer
 *   post     — drafts a Journal (blog) post for the studio's own site
 *
 * Needs `npm install` (for @anthropic-ai/sdk) and ANTHROPIC_API_KEY.
 */
'use strict';

let Anthropic = null;
try { Anthropic = require('@anthropic-ai/sdk'); } catch (e) { /* not installed: agents stay off */ }

const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const LANG = process.env.STUDIO_LANG || 'Korean'; // language the designer reads briefs in
let client = null;

function enabled() {
  return !!(Anthropic && (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN));
}
function api() {
  if (!client) client = new (Anthropic.default || Anthropic)();
  return client;
}

const SERVICE_NAMES = { logo: 'Logo', brand: 'Brand identity', web: 'Website design (Figma/PDF)', brochure: 'Brochure', social: 'Social media set', card: 'Business card', app: 'App UI/UX design (Figma/PDF)', space: 'Space & signage', mkt: 'Ongoing marketing (SNS, search ads, blog)' };

const STUDIO = `You work inside WHETŪ Studio, a small independent design studio in Aotearoa New Zealand.
The studio works fully online (no meetings), quotes in NZD excluding 15% GST, and a human designer approves everything.
Prices: Logo Essential $490, Brand Starter $1,090, 5-page website design $1,690 (+$180 per extra page up to 8),
Complete Launch (brand + website) $2,290, brochure $390, social set of 4 $240, business card $180,
extra revision round $150. Websites and apps are design only, delivered as Figma files and PDF — no coding or hosting.
App, signage and ongoing marketing are quoted by hand.`;

function requestText(r) {
  const a = r.answers || {};
  const lines = Object.keys(a).filter(k => a[k] && String(a[k]).length).map(k => `- ${k}: ${Array.isArray(a[k]) ? a[k].join(', ') : a[k]}`);
  const b = r.brief ? Object.keys(r.brief).filter(k => k !== 'at').map(k => `- ${k}: ${Array.isArray(r.brief[k]) ? r.brief[k].join(', ') : r.brief[k]}`) : [];
  return `Request ${r.id}
Business: ${r.biz}
Client: ${r.client.name} (${r.client.role || 'role not given'})
Services: ${(r.services || []).map(s => SERVICE_NAMES[s] || s).join(', ') || 'not chosen'}
Client's estimate: ${(r.estimate.lines || []).map(l => `${l[0]} ${l[1]}`).join('; ') || 'none'}; quoted separately: ${(r.estimate.manual || []).join(', ') || 'none'}
Answers:
${lines.join('\n') || '- none'}
${b.length ? 'Design brief from the client:\n' + b.join('\n') : ''}`;
}

const textOf = msg => msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();

// One request on the Messages API, with the server-side refusal fallback on.
async function call(params) {
  const stream = api().beta.messages.stream(Object.assign({
    model: MODEL,
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default'
  }, params));
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('The model declined this request.');
  return msg;
}

// Research with web search; resumes server-tool pauses until the model is done.
async function research(prompt) {
  const messages = [{ role: 'user', content: prompt }];
  for (let i = 0; i < 6; i++) {
    const msg = await call({
      system: STUDIO,
      output_config: { effort: 'medium' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
      messages
    });
    if (msg.stop_reason !== 'pause_turn') return textOf(msg);
    messages.push({ role: 'assistant', content: msg.content });
  }
  return '';
}

// Ask for JSON that matches a schema; returns the parsed object.
async function structured(system, prompt, schema, effort) {
  const msg = await call({
    system,
    output_config: { effort: effort || 'high', format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: prompt }]
  });
  if (msg.stop_reason === 'max_tokens') throw new Error('The answer was cut off. Try again.');
  return JSON.parse(textOf(msg));
}

/* ---------------- schemas ---------------- */
const S = (props, req) => ({ type: 'object', properties: props, required: req || Object.keys(props), additionalProperties: false });
const str = { type: 'string' };
const strs = { type: 'array', items: str };

const BRIEF_SCHEMA = S({
  summary: str,
  snapshot: S({ business: str, industry: str, audience: str, goals: strs }),
  research: { type: 'array', items: S({ finding: str, source: str }) },
  competitors: { type: 'array', items: S({ name: str, note: str, url: str }) },
  concept: S({ positioning: str, personality: strs, tone: str, keywords: strs, story: str }),
  directions: {
    type: 'array',
    items: S({
      key: { type: 'string', enum: ['A', 'B', 'C'] }, name: str, idea: str, mark: str, typography: str,
      palette: { type: 'array', items: S({ hex: str, name: str }) }, why: str, risk: str
    })
  },
  deliverables: S({ format: str, pages_or_screens: strs, notes: str }),
  marketing: S({ needed: { type: 'boolean' }, channels: strs, content_ideas: strs, ad_keywords: strs, blog_topics: strs, monthly_plan: str }),
  quote: { type: 'array', items: S({ label: str, amount: { type: 'number' } }) },
  quote_notes: str,
  questions: strs,
  red_flags: strs,
  next_steps: strs
});

/* ---------------- agents ---------------- */
async function intake(r) {
  const notes = await research(`Research this new design client so the designer can plan their brand.
Look up the business if it has a website or social links, its industry in New Zealand, three to five comparable
businesses or competitors and how they present themselves, and visual conventions in this category.
Write concise research notes with source URLs. Do not invent facts; say when something could not be found.

${requestText(r)}`);

  const brief = await structured(
    `${STUDIO}\nYou are the studio's intake strategist. You prepare a complete starting brief for the human designer, written in ${LANG}.
Keep proper nouns, hex codes and quote labels in English. Be specific to this business; avoid generic advice.`,
    `Prepare the designer's brief for this request.

Include:
- summary: three sentences on what the client needs and what matters most
- research and competitors from the notes below (with real URLs only)
- a brand concept, and exactly three distinct logo directions (A, B, C), each with a mark idea, typography, a 4-colour palette (hex) and why it fits
- deliverables: websites and apps are Figma + PDF only; list pages or key screens if relevant
- marketing: fill it in if the client chose ongoing marketing or social; otherwise needed=false and empty lists
- quote: line items in NZD excluding GST using the studio prices, plus notes on anything to confirm
- questions to ask the client before quoting, red flags, and the designer's next steps

Request:
${requestText(r)}

Research notes:
${notes || '(no research results)'}`,
    BRIEF_SCHEMA
  );
  return Object.assign(brief, { research_notes: notes });
}

async function reply(r) {
  const last = [...r.messages].reverse().find(m => m.by === 'client');
  const thread = r.messages.filter(m => m.by !== 'system').slice(-12).map(m => `${m.by === 'client' ? 'Client' : 'Studio'}: ${m.text}`).join('\n');
  const out = await structured(
    `${STUDIO}\nYou draft replies for the designer to review and send. Write in the language the client writes in. Warm, short, specific. Never promise dates or prices the quote does not show.`,
    `Project status: ${r.status}. ${r.quote ? `Quote v${r.quote.version}: NZD ${r.quote.total} incl. GST.` : 'No quote yet.'}
Request summary:
${requestText(r)}

Recent messages:
${thread || '(none)'}

Draft the next studio message${last ? ' answering the client\'s latest message' : ''}.`,
    S({ draft: str, language: str }), 'medium'
  );
  return out;
}

async function round(r, n) {
  const rd = r.design.rounds.find(x => x.n === n);
  if (!rd) throw new Error('Round not found.');
  return structured(
    `${STUDIO}\nYou turn client feedback into a clear task list for the designer, written in ${LANG}.`,
    `Client: ${r.biz}. Chosen direction: ${r.design.chosen}. Round ${n}${rd.extra ? ' (paid extra round)' : ''}.
Areas: ${rd.areas.join(', ') || 'none'}
Feedback: ${rd.t1}
Extra note: ${rd.t2 || '-'}
Earlier rounds: ${r.design.rounds.filter(x => x.n < n).map(x => `#${x.n}: ${x.t1}`).join(' | ') || 'none'}

List concrete tasks, flag anything outside the agreed scope, and suggest one question if something is unclear.`,
    S({ tasks: strs, out_of_scope: strs, question: str }), 'medium'
  );
}

async function post(topic, notes) {
  return structured(
    `${STUDIO}\nYou write posts for the studio's own Journal: practical, plain English, for small-business owners. Use Markdown with ## headings and short lists. No hype.`,
    `Write a Journal post draft about: ${topic}\n${notes ? 'Notes from the designer: ' + notes : ''}`,
    S({ title: str, slug: str, excerpt: str, tags: strs, body: str }), 'medium'
  );
}

module.exports = { enabled, intake, reply, round, post, MODEL };
