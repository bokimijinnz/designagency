/*
 * Example of what the intake agent (server/agents.js) prepares for the designer.
 * Demo mode shows this so the screen can be seen without an API key.
 * On the server the real brief is written by Claude for each new request.
 */
window.SAMPLE_BRIEF = {
  summary: '오클랜드의 소규모 로스터리로, 카페 납품(B2B)을 늘리기 위해 더 신뢰감 있는 브랜드와 5페이지 웹사이트가 필요해요. 핵심은 "작은 배치로 볶은 신선함"과 "24시간 배송"을 한눈에 전달하는 것. 11월 말 매장 오픈 전에 브랜드가 먼저 확정돼야 해요.',
  snapshot: {
    business: 'Kiwi Coffee Roasters · 스페셜티 원두 로스팅, 카페 납품과 온라인 판매',
    industry: '뉴질랜드 스페셜티 커피 / 로스터리',
    audience: '오클랜드 카페 오너(납품), 25–45세 직장인 홈카페 고객',
    goals: ['카페 납품 계약 늘리기', '로고 인지도 개선', '온라인 원두 주문 쉽게 만들기']
  },
  research: [
    { finding: '오클랜드 로스터리 상위권은 대부분 단색 + 크래프트 지 패키지로 "수제" 느낌을 강조해요. 차별화하려면 색이나 마크가 더 또렷해야 해요.', source: 'https://example.com/research-1' },
    { finding: '카페 오너들은 공급업체를 고를 때 일관된 품질과 배송 신뢰도를 가장 중요하게 봐요. 웹사이트에 납품 문의 동선이 짧아야 해요.', source: 'https://example.com/research-2' },
    { finding: '현재 인스타그램은 사진 품질이 들쭉날쭉하고 로고가 작은 화면에서 잘 안 읽혀요.', source: 'https://example.com/research-3' }
  ],
  competitors: [
    { name: 'Example Roasters A', note: '흑백 타이포 중심, 고급스럽지만 차가운 인상', url: 'https://example.com/a' },
    { name: 'Example Roasters B', note: '일러스트 패키지, 친근하지만 B2B 신뢰감은 약함', url: 'https://example.com/b' },
    { name: 'Example Roasters C', note: '원산지 스토리 강조, 웹사이트 납품 페이지가 잘 되어 있음', url: 'https://example.com/c' }
  ],
  concept: {
    positioning: '"동네 바리스타가 직접 볶는, 하루 만에 도착하는 신선함" — 대형 로스터보다 가깝고, 홈로스터보다 믿을 수 있는 브랜드',
    personality: ['따뜻함', '정직함', '장인정신', '부지런함'],
    tone: '짧고 솔직하게. 전문 용어보다 맛과 신선도를 말하기.',
    keywords: ['small batch', 'roasted this week', 'Auckland', 'next-day'],
    story: '10년 바리스타 경험에서 시작한 로스터리. 매주 소량만 볶아 다음 날 카페 문 앞에 둔다.'
  },
  directions: [
    { key: 'A', name: 'Warm & Rooted', idea: '로스팅 단계 색을 쓴 클래식 세리프 워드마크 + 원형 씰', mark: '원두 단면을 단순화한 원형 씰, 테두리에 "AUCKLAND · SMALL BATCH"', typography: 'Playfair Display(제목) + Inter(본문)', palette: [{ hex: '#3B2A20', name: 'Dark roast' }, { hex: '#B85C38', name: 'Crema' }, { hex: '#E8D5B5', name: 'Kraft' }, { hex: '#FAF5EA', name: 'Paper' }], why: '"장인·신뢰"를 가장 직관적으로 전달. 카페 납품용 박스와 인보이스에도 잘 어울림.', risk: '경쟁사와 비슷해 보일 수 있어 씰 형태로 차별화가 필요해요.' },
    { key: 'B', name: 'Bold & Next-day', idea: '굵은 그로테스크 워드마크 + 노란 포인트로 "빠른 배송"을 강조', mark: 'K 이니셜과 화살표를 합친 모노그램', typography: 'Archivo Black + Inter', palette: [{ hex: '#111111', name: 'Ink' }, { hex: '#F2C200', name: 'Signal' }, { hex: '#EDEDED', name: 'Steel' }, { hex: '#FFFFFF', name: 'White' }], why: '멀리서도 읽히고 배송 차량·박스에 강함. B2B에서 "믿을 수 있는 공급자" 인상.', risk: '홈카페 고객에게는 다소 차갑게 느껴질 수 있어요.' },
    { key: 'C', name: 'Neighbourhood Fresh', idea: '손글씨 느낌의 둥근 산세리프 + 초록/분홍 톤으로 동네 카페 친근함', mark: '원두 모양 말풍선 안의 작은 하트', typography: 'Bricolage Grotesque + Inter', palette: [{ hex: '#2F4A3C', name: 'Fern' }, { hex: '#8FB89A', name: 'Leaf' }, { hex: '#F3D7D0', name: 'Blush' }, { hex: '#F8F6F0', name: 'Milk' }], why: '인스타그램과 홈카페 고객에게 가장 매력적. 오픈 이벤트와 잘 맞음.', risk: '카페 오너에게 "작은 가게" 인상을 줄 수 있어요.' }
  ],
  deliverables: {
    format: 'Figma 파일 + PDF (개발 없음)',
    pages_or_screens: ['Home', 'Our coffee (원두 목록)', 'Wholesale (카페 납품 문의)', 'About', 'Contact'],
    notes: '납품 문의 폼은 디자인만 제공. 실제 구축은 고객 측 개발자 또는 Squarespace 템플릿에 적용하도록 가이드 PDF 포함.'
  },
  marketing: { needed: false, channels: [], content_ideas: [], ad_keywords: [], blog_topics: [], monthly_plan: '' },
  quote: [
    { label: 'BRAND-01 Brand Starter', amount: 1090 },
    { label: 'WEB-05 Website design, up to 5 pages (Figma + PDF)', amount: 1690 },
    { label: 'LAUNCH-01 Launch bundle saving', amount: -490 }
  ],
  quote_notes: '패키지(라벨) 디자인은 문의에 없지만 로스터리 특성상 곧 필요할 가능성이 커요. 견적 메모에 "패키지 라벨은 별도 견적"으로 적어두기를 추천해요.',
  questions: ['원두 봉투(라벨) 디자인도 이번에 필요하신가요?', '웹사이트는 어떤 플랫폼에 올릴 예정인가요? (Squarespace, Shopify 등)', '매장 오픈 날짜가 정해졌나요?'],
  red_flags: ['오픈 일정(11월 말)이 빠듯해요. 피드백이 늦어지면 웹사이트는 오픈 후로 밀릴 수 있다고 미리 안내하세요.'],
  next_steps: ['질문 3개를 메시지로 보내기', '견적 발행 (위 초안 기준)', '계약금 확인 후 A/B/C 방향을 시안으로 제작']
};
