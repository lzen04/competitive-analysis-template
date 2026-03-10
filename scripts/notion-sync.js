const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// ─── 설정 ────────────────────────────────────────────────
// Notion DB 페이지 블록 ID (URL의 마지막 32자리)
const NOTION_DB_BLOCK_ID = 'a9b36ae9-fbbf-45c0-ab70-5bf6ec4b345e';
const REPORT_PATH = path.join(__dirname, '../output/competitive-analysis-report.md');
const NOTION_API = 'https://www.notion.so/api/v3';
// ─────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 1. 마크다운 보고서 파싱 ──────────────────────────────
function parseReport(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`보고서 파일 없음: ${filePath}\n먼저 /competitive-analysis 를 실행해주세요.`);
  }
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const competitors = [];
  let inTable = false;

  for (const line of lines) {
    if (line.includes('| 경쟁사') || line.includes('|경쟁사')) { inTable = true; continue; }
    if (inTable && line.startsWith('|') && !line.includes('---')) {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 4 && cols[0] !== '경쟁사' && cols[0] !== '') {
        competitors.push({
          name:     cols[0],
          price:    cols[1] || '-',
          target:   cols[2] || '-',
          strength: cols[3] || '-',
          weakness: cols[4] || '-',
        });
      }
    }
    if (inTable && line.trim() === '') inTable = false;
  }
  return competitors;
}

// ── 2. 브라우저 내부에서 Notion API 호출 ─────────────────
async function notionFetch(page, endpoint, body) {
  const result = await page.evaluate(async (apiBase, ep, reqBody) => {
    const res = await fetch(`${apiBase}/${ep}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(reqBody),
    });
    const text = await res.text();
    return { status: res.status, body: text };
  }, NOTION_API, endpoint, body);

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Notion API 오류 [${result.status}]: ${result.body.slice(0, 300)}`);
  }
  return JSON.parse(result.body);
}

// ── 3. DB 블록에서 collection_id, spaceId, 스키마 로드 ──
async function getDBInfo(page) {
  // Step 1: 블록 정보로 collection_id, space_id 조회
  const blockData = await notionFetch(page, 'getRecordValues', {
    requests: [{ id: NOTION_DB_BLOCK_ID, table: 'block' }]
  });
  const block = blockData.results?.[0]?.value;
  if (!block) throw new Error('DB 블록 정보를 가져오지 못했습니다');

  const { collection_id, space_id: spaceId } = block;

  // Step 2: collection 스키마 조회
  const colData = await notionFetch(page, 'getRecordValues', {
    requests: [{ id: collection_id, table: 'collection' }]
  });
  const collection = colData.results?.[0]?.value;
  if (!collection) throw new Error('Collection 스키마를 가져오지 못했습니다');

  const propMap = {};
  for (const [id, prop] of Object.entries(collection.schema)) {
    propMap[prop.name] = id;
  }

  return { collectionId: collection_id, spaceId, propMap };
}

// ── 4. DB에 행 추가 (saveTransactions) ──────────────────
async function createRow(page, collectionId, spaceId, propMap, competitor) {
  const pageId = randomUUID();
  const today = new Date().toISOString().split('T')[0];

  const text = v => [[v]];
  const date = v => [['‣', [['d', { type: 'date', start_date: v }]]]];

  const ops = [
    {
      pointer: { table: 'block', id: pageId, spaceId },
      path: [],
      command: 'set',
      args: {
        type: 'page', id: pageId, version: 1, alive: true,
        parent_id: collectionId, parent_table: 'collection', space_id: spaceId
      }
    },
    { pointer: { table: 'block', id: pageId, spaceId }, path: ['properties', 'title'], command: 'set', args: text(competitor.name) },
    propMap['경쟁사']    && { pointer: { table: 'block', id: pageId, spaceId }, path: ['properties', propMap['경쟁사']],    command: 'set', args: text(competitor.name) },
    propMap['가격']      && { pointer: { table: 'block', id: pageId, spaceId }, path: ['properties', propMap['가격']],      command: 'set', args: text(competitor.price) },
    propMap['타겟 고객'] && { pointer: { table: 'block', id: pageId, spaceId }, path: ['properties', propMap['타겟 고객']], command: 'set', args: text(competitor.target) },
    propMap['강점']      && { pointer: { table: 'block', id: pageId, spaceId }, path: ['properties', propMap['강점']],      command: 'set', args: text(competitor.strength) },
    propMap['약점']      && { pointer: { table: 'block', id: pageId, spaceId }, path: ['properties', propMap['약점']],      command: 'set', args: text(competitor.weakness) },
    propMap['분석일']    && { pointer: { table: 'block', id: pageId, spaceId }, path: ['properties', propMap['분석일']],    command: 'set', args: date(today) },
  ].filter(Boolean);

  await notionFetch(page, 'saveTransactions', {
    requestId: randomUUID(),
    transactions: [{ id: randomUUID(), spaceId, operations: ops }]
  });
}

// ── Main ─────────────────────────────────────────────────
async function main() {
  console.log('🚀 CDP + Notion 내부 API 동기화 시작\n');

  // 보고서 파싱
  let competitors;
  try {
    competitors = parseReport(REPORT_PATH);
    console.log(`📄 보고서 파싱 완료: ${competitors.length}개 경쟁사\n`);
  } catch (err) { console.error('❌', err.message); process.exit(1); }

  // Chrome 연결
  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
    console.log('✅ Chrome CDP 연결 성공\n');
  } catch (err) { console.error('❌ Chrome 연결 실패:', err.message); process.exit(1); }

  // Notion 탭 찾기
  let notionPage;
  try {
    const pages = await browser.pages();
    notionPage = pages.find(p => p.url().includes('notion.so'));
    if (!notionPage) throw new Error('Notion 탭 없음. Chrome에서 notion.so 접속 후 재시도');
    console.log(`✅ Notion 탭 발견\n`);
  } catch (err) { console.error('❌', err.message); process.exit(1); }

  // DB 정보 로드
  let collectionId, spaceId, propMap;
  try {
    ({ collectionId, spaceId, propMap } = await getDBInfo(notionPage));
    console.log(`✅ DB 스키마 로드 완료: [${Object.keys(propMap).join(', ')}]\n`);
  } catch (err) { console.error('❌ 스키마 오류:', err.message); process.exit(1); }

  // 행 추가
  console.log('📝 Notion DB에 행 추가 중...\n');
  for (const competitor of competitors) {
    try {
      await createRow(notionPage, collectionId, spaceId, propMap, competitor);
      console.log(`  ✅ ${competitor.name}`);
      await sleep(300);
    } catch (err) {
      console.error(`  ❌ ${competitor.name}:`, err.message);
    }
  }

  console.log('\n✅ 동기화 완료!');
  console.log(`🔗 https://www.notion.so/${NOTION_DB_BLOCK_ID.replace(/-/g, '')}`);
  await browser.disconnect();
}

main().catch(console.error);
