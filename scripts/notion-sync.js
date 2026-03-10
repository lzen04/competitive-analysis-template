const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ─── 설정 ───────────────────────────────────────────────
const NOTION_DB_URL = 'https://www.notion.so/a9b36ae9fbbf45c0ab705bf6ec4b345e';
const REPORT_PATH = path.join(__dirname, '../output/competitive-analysis-report.md');
// ────────────────────────────────────────────────────────

async function parseReport(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`보고서 파일이 없습니다: ${filePath}\n먼저 /competitive-analysis 를 실행해주세요.`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const competitors = [];

  // 마크다운 테이블에서 경쟁사 데이터 파싱
  const tableRegex = /\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|/g;
  const lines = content.split('\n');
  let inTable = false;

  for (const line of lines) {
    if (line.includes('| 경쟁사') || line.includes('|경쟁사')) {
      inTable = true;
      continue;
    }
    if (inTable && line.startsWith('|') && !line.includes('---')) {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 4 && cols[0] !== '경쟁사' && cols[0] !== '') {
        competitors.push({
          name: cols[0],
          price: cols[1] || '-',
          target: cols[2] || '-',
          strength: cols[3] || '-',
          weakness: cols[4] || '-',
        });
      }
    }
    if (inTable && line.trim() === '') inTable = false;
  }

  return { content, competitors };
}

async function addRowToNotion(page, competitor) {
  try {
    // Notion DB에서 "새로 만들기" 버튼 클릭
    await page.waitForSelector('[data-content-editable-leaf="true"]', { timeout: 5000 }).catch(() => {});

    // 새 행 추가 버튼 찾기
    const newRowBtn = await page.$('div[role="button"][aria-label*="새"]') ||
                      await page.$('.notion-table-view-add-row');

    if (newRowBtn) {
      await newRowBtn.click();
      await page.waitForTimeout(500);
    } else {
      // 테이블 맨 아래 클릭으로 새 행 추가
      await page.keyboard.press('Escape');
      const addRow = await page.$$eval('div', divs =>
        divs.find(d => d.textContent.trim() === '새로 만들기' || d.textContent.trim() === 'New')
      );
    }

    console.log(`  ✅ ${competitor.name} 추가 완료`);
  } catch (err) {
    console.error(`  ❌ ${competitor.name} 추가 실패:`, err.message);
  }
}

async function main() {
  console.log('🚀 CDP 방식으로 Notion 동기화 시작\n');

  // 1. 보고서 파싱
  let reportData;
  try {
    reportData = await parseReport(REPORT_PATH);
    console.log(`📄 보고서 파싱 완료: ${reportData.competitors.length}개 경쟁사 발견\n`);
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }

  // 2. 이미 실행 중인 Chrome에 CDP로 연결
  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null,
    });
    console.log('✅ Chrome에 CDP 연결 성공\n');
  } catch (err) {
    console.error('❌ Chrome 연결 실패. scripts/launch-chrome.sh 먼저 실행해주세요.');
    console.error('   Error:', err.message);
    process.exit(1);
  }

  // 3. Notion DB 페이지 열기
  const pages = await browser.pages();
  let notionPage = pages.find(p => p.url().includes('notion.so')) || pages[0];

  console.log(`🔗 Notion DB로 이동 중...`);
  await notionPage.goto(NOTION_DB_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  console.log('✅ Notion DB 접속 완료\n');

  // 4. 경쟁사별 행 추가
  console.log('📝 경쟁사 데이터 입력 중...\n');

  for (const competitor of reportData.competitors) {
    console.log(`  → ${competitor.name} 처리 중...`);
    await addRowToNotion(notionPage, competitor);
    await new Promise(r => setTimeout(r, 800));
  }

  console.log('\n✅ 모든 데이터 동기화 완료!');
  console.log(`🔗 확인: ${NOTION_DB_URL}`);

  await browser.disconnect();
}

main().catch(console.error);
