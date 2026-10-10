/*
 * Starter content for the Journal (blog) and Work (projects).
 * Everything here is SAMPLE content: edit or delete it in admin.html.
 * Once you save anything in admin, the saved copy replaces this seed.
 *
 * Body text uses a small Markdown subset:
 *   ## Heading, ### Subheading, - list, 1. list, > quote,
 *   **bold**, *italic*, [link](https://…), ![alt](image-url)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SEED = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const works = [
    {
      slug: 'kiwi-coffee-roasters', title: 'Kiwi Coffee Roasters', client: 'Kiwi Coffee Roasters', year: '2026',
      services: ['Brand identity', 'Packaging', 'Website'], featured: true, published: true, sample: true,
      summary: 'A warm, rooted identity for a small-batch roaster that wanted to win bigger café accounts.',
      cover: { ink: '#3b2a20', accent: '#b85c38', light: '#e8d5b5', paper: '#faf5ea', font: "'Playfair Display',serif", weight: 500, shape: '50%', mark: 'K' },
      body: `## The challenge
Kiwi Coffee Roasters had great beans and a logo that looked like every other roaster. Café owners liked the coffee but couldn't remember the name.

## Our approach
We went back to the founder's story: ten years behind the counter, roasting in small batches for the neighbourhood. The identity leans on a classic serif and earthy tones that signal craft and care.

- A wordmark and round seal that works on bags, cups and invoices
- A four-colour palette built from roast stages
- A five-page website with a simple wholesale enquiry form

## The result
> "Café owners now recognise our bags across the room." — Founder

Delivered in 7 weeks across two consolidated feedback rounds.`
    },
    {
      slug: 'harbour-physio', title: 'Harbour Physio', client: 'Harbour Physio', year: '2026',
      services: ['Brand refresh', 'Website', 'Booking'], featured: true, published: true, sample: true,
      summary: 'A calm, friendly refresh and a booking-first website for a two-clinic physiotherapy practice.',
      cover: { ink: '#2f4a3c', accent: '#8fb89a', light: '#f3d7d0', paper: '#f8f6f0', font: "'Bricolage Grotesque',sans-serif", weight: 700, shape: '38% 62% 55% 45% / 52% 40% 60% 48%', mark: 'H' },
      body: `## The challenge
Most new patients found Harbour Physio on their phone, in pain, and gave up before they found the booking button.

## Our approach
Soft greens, rounded shapes and big, clear type. Every page leads to one action: book an appointment.

- Brand refresh that kept the existing name and colours recognisable
- Mobile-first site with booking integration
- Accessible contrast and text sizes throughout

## The result
Online bookings became the main way new patients arrive.`
    },
    {
      slug: 'southline-builders', title: 'Southline Builders', client: 'Southline Builders', year: '2025',
      services: ['Logo', 'Vehicle signage', 'Business cards'], featured: true, published: true, sample: true,
      summary: 'A bold mark that reads from across the street, on utes, site fences and hi-vis.',
      cover: { ink: '#111111', accent: '#f2c200', light: '#ededed', paper: '#ffffff', font: "'Archivo Black',sans-serif", weight: 400, shape: '0', mark: 'S' },
      body: `## The challenge
A growing building company with three utes, no consistent look, and a logo that disappeared at a distance.

## Our approach
High contrast and a heavy wordmark so the brand reads in one glance, at 50 km/h.

- Logo system with a stacked and a wide lock-up
- Vehicle wrap layouts for three ute models
- Site signage and business cards

## The result
Consistent across every vehicle and site, and easy to spot.`
    },
    {
      slug: 'moana-kitchen', title: 'Moana Kitchen', client: 'Moana Kitchen', year: '2025',
      services: ['Menu design', 'Social set'], featured: false, published: true, sample: true,
      summary: 'Menus and a social template set for a Pacific-inspired family restaurant.',
      cover: { ink: '#0b2545', accent: '#ff7a59', light: '#e3ecf4', paper: '#fbfaf7', font: "'Bricolage Grotesque',sans-serif", weight: 800, shape: '50% 50% 8% 50%', mark: 'M' },
      body: `## The brief
New menus that are easy to read in low light, and a set of social templates the team can update themselves.

## What we made
- Dine-in and takeaway menus
- Four editable social templates
- A short guide for staff on using them`
    },
    {
      slug: 'tuatara-tutoring', title: 'Tuatara Tutoring', client: 'Tuatara Tutoring', year: '2025',
      services: ['Brand identity', 'Brochure'], featured: false, published: true, sample: true,
      summary: 'A playful but trustworthy identity for an after-school tutoring service.',
      cover: { ink: '#2d1b4e', accent: '#34c759', light: '#eef2e3', paper: '#ffffff', font: "'Caveat',cursive", weight: 700, shape: '24px', mark: 'T' },
      body: `## The brief
Parents need to trust it. Kids need to not hate it.

## What we made
- A hand-drawn wordmark with a simple tuatara symbol
- A four-page brochure for school open evenings
- Colour and type guide`
    },
    {
      slug: 'atelier-noa', title: 'Atelier Noa', client: 'Atelier Noa', year: '2024',
      services: ['Brand identity', 'Online store'], featured: false, published: true, sample: true,
      summary: 'A refined identity and Shopify store for a small ceramics studio.',
      cover: { ink: '#1a1a1a', accent: '#c19a6b', light: '#f4e4e1', paper: '#fdfbf8', font: "'Playfair Display',serif", weight: 700, shape: '50% 50% 0 0', mark: 'N' },
      body: `## The brief
Handmade ceramics deserve an online store that feels as calm as the studio.

## What we made
- Serif wordmark and monogram
- Shopify theme customisation and product photography direction
- Packaging stickers and care cards`
    }
  ];

  const posts = [
    {
      slug: 'how-our-online-quotes-work', title: 'How our online quotes work', date: '2026-09-18',
      tags: ['Process'], published: true, sample: true, cover: { img: 'orbit-3', bg: '#f8f5ee' },
      excerpt: 'Why you see a price in minutes, and why a real designer still checks every quote before you pay anything.',
      body: `Most studios ask you to book a call before they tell you anything about price. We think you should see a number first.

## 1. You tell us about your project
The estimate form asks about your business, the services you need, your taste and your timing. It takes about ten minutes. You don't need an account.

## 2. You see an indicative price, live
Fixed-price items (a logo, a five-page website, a brochure) add up as you choose. Anything that needs a closer look, like an online store or app design, is flagged as **quoted separately**.

## 3. A designer checks everything
Your request lands with a real person. They check scope, effort and capacity, ask questions in your portal if needed, and publish a confirmed quote.

## 4. You accept, then we start
Nothing is charged until you accept. A 50% deposit reserves your slot, and the balance is due before final files are released.`
    },
    {
      slug: 'giving-great-design-feedback', title: 'Giving great design feedback in two rounds', date: '2026-08-30',
      tags: ['Tips', 'Process'], published: true, sample: true, cover: { img: 'orbit-6', bg: '#f3f3f2' },
      excerpt: 'Two consolidated rounds sounds tight. Here is how to make each one count.',
      body: `Every project includes two consolidated revision rounds. That means one message per round, with every change you want.

## Collect, then send
Show the design to everyone who has a say *before* you send feedback. Late opinions are the main reason projects run over.

## Describe the problem, not the fix
"The logo feels too serious for our customers" gives your designer more room than "make it blue".

## Be specific about what to keep
Tell us what's working too. It protects the good parts from accidental changes.

## Need more?
Extra rounds are available at a fixed price, and you'll always see that price before you add one.`
    },
    {
      slug: 'brand-starter-checklist', title: 'A brand starter checklist for small businesses', date: '2026-07-12',
      tags: ['Branding'], published: true, sample: true, cover: { img: 'orbit-1', bg: '#f5f1e8' },
      excerpt: 'What you actually need on day one, and what can wait until you are bigger.',
      body: `You don't need a 60-page brand book to open your doors. You need a few things that work everywhere.

## Day one
- A logo in a wide and a compact version
- Two or three colours, written down as hex codes
- One typeface for headings, one for text
- A business card and an email signature

## When you grow
- Photography direction
- Templates for social media and documents
- Full brand guidelines

Start small and consistent. Consistency builds recognition faster than complexity.`
    },
    {
      slug: 'why-no-meetings', title: 'Why we work without meetings', date: '2026-06-02',
      tags: ['Studio'], published: true, sample: true, cover: { img: 'orbit-2', bg: '#f6f6f5' },
      excerpt: 'Everything happens in your portal, in writing, in your language. Here is why that is better for your project.',
      body: `We don't do discovery calls or weekly check-ins. Everything happens in writing, in your client portal.

## It's faster
You answer questions when it suits you. No waiting for a free slot in two calendars.

## It's clearer
Every decision is written down in one place. No "I thought we agreed on the call…".

## It works in any language
Write to us in the language you're most comfortable in. We reply in the language you choose.

## The time goes into design
The hours we save on admin go straight into your design, by a real designer.`
    }
  ];

  return { works, posts };
});
