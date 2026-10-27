// SEC EDGAR：公司申報文件與內部人（董監高管）買賣
import { memoized } from './cache.js';
import { insiderSummary } from './insider.js';

// SEC 要求帶可辨識的 User-Agent
const UA = 'evan-stock-radar/1.0 (+https://evan-stock-radar.vercel.app)';
const H = { 'User-Agent': UA, Accept: 'application/json,text/html,*/*', 'Accept-Encoding': 'gzip, deflate' };

export const FORM_LABEL = {
  '10-K': '年報', '10-Q': '季報', '8-K': '重大事件', '6-K': '外國發行人報告', '20-F': '外國發行人年報',
  '4': '內部人交易', '3': '內部人初始持股', '5': '內部人年度申報', '144': '限制股擬賣出通知',
  'DEF 14A': '股東會議事手冊', 'DEFA14A': '股東會補充資料',
  'SC 13D': '大股東持股（積極型）', 'SC 13G': '大股東持股（被動型）', 'SC 13D/A': '大股東持股異動', 'SC 13G/A': '大股東持股異動',
  'S-3': '發行登記', 'S-8': '員工認股登記', '424B5': '公開發行條款', '13F-HR': '機構持股申報',
  'N-PX': '基金投票紀錄', '25-NSE': '下市通知', 'CORRESP': '與 SEC 往來函件', 'UPLOAD': 'SEC 意見函',
};
export const ITEM_LABEL = {
  '1.01': '簽訂重大合約', '1.02': '終止重大合約', '1.05': '重大資安事件',
  '2.01': '併購或處分資產', '2.02': '財報結果公布', '2.03': '新增重大債務', '2.05': '重整／裁員費用', '2.06': '資產減損',
  '3.01': '不符上市規定／下市通知', '3.02': '未登記股權發行',
  '4.01': '更換簽證會計師', '4.02': '過去財報不可信賴（重大警訊）',
  '5.02': '董事或高階主管異動', '5.03': '公司章程修改', '5.07': '股東會投票結果',
  '7.01': 'Reg FD 公開揭露', '8.01': '其他重大事件', '9.01': '財務報表與附件',
};
const IMPORTANT_FORMS = new Set(['8-K', '10-K', '10-Q', '4', 'SC 13D', 'SC 13D/A', 'SC 13G', '20-F', '6-K']);
const CODE_LABEL = { P: '公開市場買進', S: '公開市場賣出', A: '獎酬股票取得', M: '選擇權行使', F: '扣稅交回股票', G: '贈與', C: '轉換', D: '處分' };

const pad10 = (cik) => String(cik).padStart(10, '0');
const num = (x) => { const n = Number(String(x).replace(/,/g, '')); return isFinite(n) ? n : null; };

// 代號 → CIK 對照表。這份 580KB，本來是整個 Blob 裡最大的一份，
// 但它是 SEC 公開的檔案、一次 HTTP 就抓得回來，<沒有理由佔 Blob 額度>。
// 改成記憶體快取 24 小時；冷啟動時多抓一次 580KB，比每次都去讀 Blob 划算得多。
async function fetchTickerMap() {
  const r = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: H });
  if (!r.ok) throw new Error(`sec tickers ${r.status}`);
  const j = await r.json();
  const map = {};
  for (const v of Object.values(j)) map[String(v.ticker).toUpperCase()] = { cik: v.cik_str, name: v.title };
  if (!Object.keys(map).length) throw new Error('sec tickers 空的');
  return map;
}

export async function cikOf(symbol) {
  const sym = symbol.toUpperCase();
  if (/\.(TW|TWO)$/.test(sym)) return null;
  const map = await memoized('sec-tickers', 24 * 3600 * 1000, fetchTickerMap);
  return map[sym] || null;
}

/* ⚠ SEC 的 XML 會把 & 寫成 &amp;，所以職稱會變成
     「Chief People &amp; AI Enblmt. Off.」。前端還會再 esc 一次，
     不解碼的話畫面上就是原樣印出 `&amp;`（實測 NOW 與 SNDK 都中）。 */
export const unent = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  .replace(/&apos;|&#39;/g, "'")
  .replace(/&amp;/g, '&');     // ⚠ &amp; 一定要<最後>解，否則 &amp;lt; 會被解成 <
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  if (!m) return null;
  const inner = m[1];
  const val = inner.match(/<value>([\s\S]*?)<\/value>/);
  const raw = (val ? val[1] : inner).replace(/<[^>]+>/g, ' ').trim();
  return raw ? unent(raw) : null;
};

/* ⚠⚠ SEC 被打太快的時候回的是 <403>，不是 429 也不是等一下再來 ——
     而我們原本<一次都不重試>，直接記成「讀不到」。
     2026-10-20 線上量到：單獨一個請求 5/5 檔全讀得到，但健檢那種<連續打很多支端點>
     的時候，好幾個函式實例同時在對 SEC 要文件，整批被擋，
     然後那份殘缺的答案還被 CDN 收下 —— 一次短暫的壅塞變成好幾小時的假話。
   👉 退一步再試一次就好。只對「被擋」那幾種碼重試，404 之類的不要浪費時間。 */
const RETRY_CODE = new Set([403, 429, 500, 502, 503, 504]);
async function secGet(url, tries = 2) {
  let last = 0;
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: H });
    if (r.ok) return r;
    last = r.status;
    if (!RETRY_CODE.has(r.status) || i === tries - 1) break;
    // ⚠ 加一點隨機，否則同時被擋的幾個實例會<一起>在同一刻重試，等於沒退讓
    await new Promise((res) => setTimeout(res, 500 + Math.floor(Math.random() * 500)));
  }
  throw new Error(`sec ${last}`);
}

/* ───────────── 📎 申報的附註（footnote） ─────────────

   ⚠⚠ 附註是<判斷「這筆 P 到底是不是他的決定」唯一的依據>。
     實測 TSM 的 24 筆 P，附註全部寫著「ESPP 的管理人依公司事先訂好的條件代為買進」——
     不讀附註的話，畫面會寫「24 位內部人在公開市場買進」，而那是假訊號。

   ⚠⚠ 而附註要<對應到正確的欄位>，不可以整份掃一遍。
     實測 CELH 2026-09-10：執行長 Fieldly 真的在市場上買了 18,000 股（$49 萬），
     那一筆的 postTransactionAmounts 掛著一條附註寫
       `Includes 523 shares acquired under Celsius' 2025 Employee Stock Purchase Plan`
     —— 那句在講<他買完之後總共持有幾股裡面有 523 股來自 ESPP>，
     <不是>在講這一筆是 ESPP 買的。整份掃關鍵字的話，<這筆真買會被誤殺>。
   👉 所以只收「描述這一筆交易本身」那些欄位上的附註，
      <postTransactionAmounts（交易後持股）那一段要整段排除>。 */
const footnotesOf = (xml) => {
  const out = {};
  const block = xml.match(/<footnotes>([\s\S]*?)<\/footnotes>/);
  if (!block) return out;
  for (const m of block[1].matchAll(/<footnote[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/footnote>/g)) {
    const txt = unent(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (txt) out[m[1]] = txt.slice(0, 400);
  }
  return out;
};
export const TX_SCOPE = (t) => String(t).replace(/<postTransactionAmounts>[\s\S]*?<\/postTransactionAmounts>/g, ' ');
const footnotesFor = (txBlock, map) => {
  const ids = [...new Set([...TX_SCOPE(txBlock).matchAll(/<footnoteId[^>]*\bid="([^"]+)"/g)].map((m) => m[1]))];
  return { footnoteIds: ids, footnotes: ids.map((id) => map[id]).filter(Boolean) };
};

/* ⚠⚠ 完整申報檔（`{accession}.txt`）裡可能<裝了好幾份文件>（附件、XSL 轉出來的 HTML 複本）。
     整份丟進去解的話，同一筆交易<會被數兩次>。所以先切出<第一份 ownershipDocument>再解。
   ⚠ 單獨的 .xml 檔本身就只有一份，切不到就原樣回傳（不可以回空字串 ——
     那會把「格式不同」靜悄悄變成「沒有交易」）。 */
export const firstOwnershipDoc = (text) => {
  const s = String(text == null ? '' : text);
  const m = s.match(/<ownershipDocument>[\s\S]*?<\/ownershipDocument>/);
  return m ? m[0] : s;
};

/* 解析一份 Form 4 的 XML。
   ⚠⚠ <純函式、不連網>：scripts/build-insider-flow.mjs 走完整申報檔、站上走單獨的 .xml，
     兩條路<共用這一份實作>（[[learning_測試自己抄一份判斷邏輯]]：
     建檔腳本自己抄一份解析，等於測的是抄本不是產品）。 */
export function parseForm4Xml(raw) {
  const xml = firstOwnershipDoc(raw);
  const owner = tag(xml, 'rptOwnerName') || '內部人';
  /* ⚠ 三個身分旗標要<各自>拿出來，不要擠成一個 title 字串 ——
       lib/insider.js 的 roleOf 要靠它們分「執行長／財務長／董事／10% 大股東」，
       而份量差很多（CEO 自己掏錢買 ≠ 某個副總買）。 */
  const isDirector = /<isDirector>\s*(1|true)/.test(xml);
  const isOfficer = /<isOfficer>\s*(1|true)/.test(xml);
  const isTenPercent = /<isTenPercentOwner>\s*(1|true)/.test(xml);
  // ⚠ 這一行沒走 tag()，所以要自己解實體（否則職稱會印出 `&amp;`）
  const title = unent((xml.match(/<officerTitle>([^<]*)<\/officerTitle>/) || [])[1] || '')
    || (isDirector ? '董事' : isTenPercent ? '10% 大股東' : '');
  const fnMap = footnotesOf(xml);
  /* 申報書上那個勾選格：這份申報裡有 Rule 10b5-1 事先排定計畫的交易。
     ⚠ 它是<整份>的旗標（不是某一筆的），所以整份的每一筆都帶著它。 */
  const aff10b5One = /<aff10b5One>\s*(1|true)/i.test(xml);
  const out = [];
  for (const m of xml.matchAll(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g)) {
    const t = m[1];
    const code = tag(t, 'transactionCode');
    const shares = num(tag(t, 'transactionShares'));
    const price = num(tag(t, 'transactionPricePerShare'));
    const ad = tag(t, 'transactionAcquiredDisposedCode');
    const date = tag(t, 'transactionDate');
    if (!shares) continue;
    out.push({
      owner, title: title.trim(), isDirector, isOfficer, isTenPercent,
      code, codeLabel: CODE_LABEL[code] || code, date, shares, price,
      /* 📄 這一筆買的是哪一種證券。
         ⚠⚠ 同一家公司<可能同時申報 ADS 與原股>，兩者的價格差一個固定倍數
           （實測 PAM 同一份申報裡 $3.105 的原股與 $77.628 的 ADS，剛好 25 倍）。
           「價格填錯了沒」要比的是<同一種證券>的中位數，不是同一家公司的 ——
           不分開的話，誠實申報的原股會被當成填錯擋掉。 */
      security: tag(t, 'securityTitle'),
      value: price ? shares * price : null, buy: ad === 'A',
      /* ⚠ 交易後他自己還剩多少股。<這比金額有意義得多> ——
           「把自己的持股加了四成」是個決定，「買了 20 萬美元」對 CEO 可能是零頭。 */
      after: num(tag(t, 'sharesOwnedFollowingTransaction')),
      /* 📎 判讀「這是不是他的決定」要用的三樣東西。判讀本身在 lib/insider.js。
         ⚠ nature＝持有性質（實測 TSM 寫「By ESPP Trust」），它也算一個線索。 */
      ...footnotesFor(t, fnMap), nature: tag(t, 'natureOfOwnership'), aff10b5One,
    });
  }
  return out;
}

/* 抓一份 Form 4 回來解。連網的部分只有這裡，判讀全在 parseForm4Xml。 */
async function parseForm4(cik, accession, primaryDocument) {
  const noDash = accession.replace(/-/g, '');
  const doc = String(primaryDocument || '').replace(/^xsl[^/]*\//, '');
  const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${noDash}/${doc}`;
  return parseForm4Xml(await (await secGet(url)).text());
}

export async function fetchFilings(symbol, { days = 180, limit = 14, insiderFilings = 24 } = {}) {
  const hit = await cikOf(symbol);
  if (!hit) return { supported: false, filings: [], insider: null, counts: { total: 0, eightK: 0, form4: 0 } };
  const cik = hit.cik;
  const r = await fetch(`https://data.sec.gov/submissions/CIK${pad10(cik)}.json`, { headers: H });
  if (!r.ok) throw new Error(`sec submissions ${r.status}`);
  const j = await r.json();
  const rec = j.filings?.recent;
  if (!rec) throw new Error('沒有申報資料');
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);

  const all = [];
  for (let i = 0; i < rec.form.length; i++) {
    if (rec.filingDate[i] < since) break;
    all.push({
      form: rec.form[i], date: rec.filingDate[i],
      items: (rec.items[i] || '').split(',').filter(Boolean).map((c) => ({ code: c, label: ITEM_LABEL[c] || c })),
      accession: rec.accessionNumber[i], primaryDocument: rec.primaryDocument[i],
      label: FORM_LABEL[rec.form[i]] || rec.form[i],
      important: IMPORTANT_FORMS.has(rec.form[i]),
      url: `https://www.sec.gov/Archives/edgar/data/${cik}/${rec.accessionNumber[i].replace(/-/g, '')}/${rec.primaryDocument[i]}`,
    });
  }

  // 內部人買賣：抓最近幾份 Form 4 來拆明細
  const form4 = all.filter((f) => f.form === '4').slice(0, insiderFilings);
  const trades = [];
  const queue = [...form4];
  /* ⚠⚠ 失敗一定要<數出來>，不可以 catch {} 吞掉。
       2026-10-20 實測：跨股票掃描時三家公司並行、每家內部再 4 條，
       一瞬間對 SEC 打超過 10 次/秒 → 文件全部被擋 → trades 空的 →
       畫面寫「這段期間沒有任何申報」。<而那是假話>：申報有 39 份，是我們讀不到。
       這正是 [[learning_沒丟出例外不等於算出結果]] 那一條：
       「讀不到」被畫成「沒有」。 */
  let failed = 0;
  /* ⚠ 並行度 4 → 2。健檢那種連續打很多支端點的情況下，
       好幾個函式實例會同時在要文件，4 條就超過 SEC 的 10 次/秒。
       慢一倍（五檔約 14 秒）換「不會整批被擋」，而且走 CDN 快取三小時，划算。 */
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (queue.length) {
      const f = queue.shift();
      try {
        /* ⚠⚠ `filed`＝SEC 收到這一份的日期（f.date 來自 submissions 的 filingDate），
             跟 `date`（交易日）<是兩件不同的事>，而且相差兩個營業日以上很常見。
           為什麼一定要帶出去：睡前那一則要判斷「這一筆是<上一則之後>才出現的嗎」，
             而那只能用<申報日>判斷 —— 用交易日的話，一筆 T+2 才申報的買進
             會在我們看到它的<前兩天>就被算成「舊的」，於是永遠不會通知。 */
        for (const t of await parseForm4(cik, f.accession, f.primaryDocument)) trades.push({ ...t, accession: f.accession, filed: f.date, url: f.url });
      } catch { failed++; }
    }
  }));
  /* ⚠⚠ 判讀整個交給 lib/insider.js（純函式，窮舉測得起來）。
       這裡只負責<把資料拿回來>，不負責<說它是什麼意思>。
     ⚠ 以前這一段自己算 buyCount／sellCount，而那會把
       <一張 10b5-1 預定單分批成交的 30 筆>算成 30 個決定（實測 MU 真的是 30 筆）。
       collapse() 會把「同一份申報＋同一個人＋同一天＋同一個代碼」合併成一筆。 */
  const summary = insiderSummary(trades, {
    days, today: new Date().toISOString().slice(0, 10),
    // ⚠ 有幾份讀不到要往下傳 —— 判讀那一層才講得出「是沒有，還是沒讀到」
    failed, tried: form4.length,
  });
  const insider = {
    ...summary,
    filings: form4.length,
    /* ⚠ 舊欄位留著（畫面與測試都在用），但它們現在是<合併後>的數字。
       ⚠⚠ 這裡<刻意只放 buys 與 sells>：巡邏（api/monitor.js）拿它來推播
         「內部人買進 100 萬美元以上」，而計畫自動買進<不是一個決定>，
         推出去就是把 ESPP 扣款講成「內部人在買」。plans 另外走 summary.plans。 */
    trades: [...summary.buys, ...summary.sells]
      .sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8),
    /* ⚠ 「看了幾份」要講出來 —— 這張卡只拆最近 N 份 Form 4，
         不是「這家公司這段期間的全部」。不講的話「沒有買進」會被當成全稱命題。 */
    scanned: form4.length, scannedOf: all.filter((f) => f.form === '4').length,
  };

  // 這家公司實際用的表單種類（近千筆申報裡看得到的）
  const seen = new Set(rec.form);
  const forms = {
    annual: seen.has('10-K') ? '10-K' : seen.has('20-F') ? '20-F' : seen.has('40-F') ? '40-F' : '10-K',
    quarter: seen.has('10-Q') ? '10-Q' : seen.has('6-K') ? '6-K' : null,
    current: seen.has('8-K') ? '8-K' : seen.has('6-K') ? '6-K' : null,
    foreign: !seen.has('10-K') && (seen.has('20-F') || seen.has('40-F')),
  };

  return {
    supported: true, cik, name: j.name || hit.name, sic: j.sicDescription || null, forms,
    filings: all.filter((f) => f.important || f.items.length).slice(0, limit),
    counts: { total: all.length, eightK: all.filter((f) => f.form === '8-K').length, form4: all.filter((f) => f.form === '4').length },
    insider,
  };
}

/* ───────────── 🍖 回購：從 SEC 的 XBRL 拿股數與回購金額 ─────────────

   ⚠ XBRL（companyconcept）是 SEC 把每一份 10-K／10-Q 裡的數字<拆成結構化欄位>的 API，
     所以不用去剖析財報原文。但它有兩個陷阱，判讀層（lib/buyback.js）都處理了：
     ①股數<沒有還原分割> ②金額是<年初至今累計>。

   ⚠⚠ 單一欄位依賴遲早會壞（[[learning_上游會整欄不給]]）：
     實測 AZO 的 ShareBasedCompensation <停在 2015>、CommonStockSharesOutstanding <停在 2019>。
     所以每一項都走<退路鏈>，而且<哪一項讀不到要回報出去>，不可以當成 0。 */
/* 一次把這家公司的 XBRL 全部拿回來。

   ⚠⚠ 本來用 companyconcept（一個標籤一次請求）。改掉的原因是<它會漏>：
     實測 Bloom Energy（BE）的 companyconcept 回 `{"units":{"shares":{}}}` ——
     <空的>，而同一家的 companyfacts 裡那個標籤<有 75 筆>。
     兩個端點對同一家公司給不一樣的答案，而空的那個不會報錯，
     於是整張卡變成「算不出來」而資料其實在。
   ⚠ 順便快了：companyfacts 一次 0.5～4.2MB、143～300ms，<一次請求取代六次>。 */
async function companyFacts(cik) {
  const pad = String(cik).padStart(10, '0');
  const r = await secGet(`https://data.sec.gov/api/xbrl/companyfacts/CIK${pad}.json`, 2);
  return r.json();
}

/* ⚠⚠ 收哪幾種申報書。原本只收 10-K／10-Q，於是<外國發行人整張卡都是「算不出來」> ——
     2026-10-22 實測 TSM 與 ASML 的回購卡都空白，而 fetchFilings 回的 forms.foreign
     <早就知道>他們交的是 20-F／6-K（美國公司交 10-K／10-Q，外國發行人交 20-F／6-K，
     加拿大的交 40-F）。實測 ASML 的股數有 45 筆 20-F、BABA 有 36 筆 20-F ＋ 11 筆 6-K。
   ⚠ 修正版（10-K/A、20-F/A）<不收>：同一期會同時有原始與重編兩個值，
     混進來就是在同一條線上放兩種基準（跟 quarterlyShares 挑最早申報那一份同一個理由）。 */
export const XBRL_FORMS = new Set(['10-K', '10-Q', '20-F', '6-K', '40-F']);

/* 退路鏈：第一個「有足夠資料」的就用，並回報用了哪一個。
   ⚠ units 不一定是陣列（BE 就是個空物件），一定要擋，否則 .filter 會丟例外。
   ⚠ 單位要一起回報：外國發行人的金額<不是美元>（實測 ASML 是 EUR、BABA 是 CNY），
     當成美元去跟股價比，「平均每股買在 $5,950」就是一句假話。 */
function pickTag(facts, chain, min = 1) {
  for (const [ns, tag] of chain) {
    const node = facts && facts[ns] && facts[ns][tag];
    if (!node || !node.units) continue;
    const unit = Object.keys(node.units)[0];
    const arr = Array.isArray(node.units[unit]) ? node.units[unit] : [];
    const rows = arr.filter((x) => x && XBRL_FORMS.has(x.form));
    if (rows.length >= min) return { rows, tag, unit };
  }
  return { rows: [], tag: null, unit: null };
}

/* 同一個概念散在好幾個標籤時，<把它們接起來>而不是二選一。
   回傳跟 pickTag 一樣的形狀（rows + 用到哪些標籤），讓後面的處理完全一樣。 */
export function mergeTags(facts, chain) {
  const rows = [];
  const used = [];
  const seen = new Set();
  let unit0 = null;
  for (const [ns, tag] of chain) {
    const node = facts && facts[ns] && facts[ns][tag];
    if (!node || !node.units) continue;
    const unit = Object.keys(node.units)[0];
    /* ⚠ 單位不同的兩個標籤<不可以接起來>：ASML 的股酬是 EUR，
         接上一份美元的就是在相加兩種錢，而加出來的數字看不出哪裡錯了。 */
    if (unit0 && unit !== unit0) continue;
    const arr = Array.isArray(node.units[unit]) ? node.units[unit] : [];
    let added = 0;
    for (const x of arr) {
      if (!x || !XBRL_FORMS.has(x.form)) continue;
      /* ⚠ 同一個期間可能兩個標籤都有（實測 AAPL 兩個完全一樣）。
           先來的優先，後面的只補<還沒有>的期間，否則會變成兩倍。 */
      const k = `${x.start || ''}|${x.end}`;
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push(x);
      added++;
    }
    if (added) { unit0 = unit; used.push(tag); }
  }
  return { rows, tag: used.join('＋') || null, unit: unit0 };
}

export async function fetchBuyback(symbol, { splits = [], price = null, type = null } = {}) {
  const { quarterlyShares, pickSharesSeries, annualOf, buybackSummary, splitCrossCheck, noFactsWhy, isIfrsOnly, IFRS_WHY } = await import('./buyback.js');
  const hit = await cikOf(symbol);
  if (!hit) return { supported: false, why: noFactsWhy(type) || '查不到這一檔在 SEC 的代號（台股與多數 ETF 沒有），這張卡不適用' };
  const cik = hit.cik;

  let facts;
  try { facts = (await companyFacts(cik)).facts; }
  catch (e) {
    /* ⚠⚠ 404 的意思是「SEC 沒有這個 CIK 的 XBRL 財報」。對 ETF 與信託來說<那是正常的>
         （SPY 有 CIK 但沒有公司財報），講成「讀不到」就是把正常狀況畫成壞掉。
       ⚠ 其他錯誤碼（403／429／500）才是真的讀不到，那一句不可以共用。 */
    const na = /\b404\b/.test(e.message) ? noFactsWhy(type) : null;
    return { supported: false, na: !!na, why: na || `讀不到 SEC 的財報資料（${e.message}）` };
  }
  if (!facts) return { supported: false, why: noFactsWhy(type) || '這家公司沒有 XBRL 財報資料' };
  /* ⚠⚠ 整份只有 ifrs-full（實測 TSM：dei ＋ ifrs-full ＋ srt，<完全沒有 us-gaap>）——
       收了 20-F 也沒用，我們要的三個欄位一個都不存在。明白說不適用。 */
  if (isIfrsOnly(facts)) {
    return { supported: false, na: true, foreign: true, why: IFRS_WHY };
  }

  /* ⚠ 退路鏈的每一個標籤都<各自整串拿出來>，由 pickSharesSeries 挑「真的算得出點」的那一個。
       只挑「有原始資料」的那一個會卡在 ASML 的年度資料上（45 筆、0 個季度點）。 */
  const SH_CHAIN = [
    ['us-gaap', 'WeightedAverageNumberOfDilutedSharesOutstanding'],
    ['us-gaap', 'WeightedAverageNumberOfSharesOutstandingBasic'],
    ['dei', 'EntityCommonStockSharesOutstanding'],
    ['us-gaap', 'CommonStockSharesOutstanding'],
  ];
  const shCands = SH_CHAIN.map(([ns, t]) => pickTag(facts, [[ns, t]], 1));
  const sp = pickTag(facts, [['us-gaap', 'PaymentsForRepurchaseOfCommonStock']], 1);
  /* ⚠⚠ 股酬<不可以用「挑第一個有資料的」那種退路鏈> ——
       實測 AZO 的 ShareBasedCompensation <停在 2014>（有 15 年，所以「有資料」），
       於是鏈子就停在它，而我們要比的是 2021–2025，整段都是空的 → 畫面寫「讀不到」。
       但同一家的 AllocatedShareBasedCompensationExpense <有 48 年、2025 年是 $125M>。
     👉 兩個是同一個概念，要<合併>：先用主要的，缺的年度再從備援補。
       （[[learning_上游會整欄不給]]：退路鏈要補得到<缺的那一段>，不是換一整欄。） */
  const sc = mergeTags(facts, [
    ['us-gaap', 'ShareBasedCompensation'],
    ['us-gaap', 'AllocatedShareBasedCompensationExpense'],
  ]);

  /* 每一個標籤都試，而且每一個標籤先試季度再試年度 —— 美國公司第一個就中，
     外國發行人（只交 20-F）會落到年度那一種。 */
  const picked = pickSharesSeries(shCands, splits, 4);
  const sh = shCands.find((c) => c.tag === picked.tag) || shCands[0] || { rows: [], tag: null };
  const shares = picked.shares;
  const spend = annualOf(sp.rows);
  const sbc = annualOf(sc.rows);
  /* ⚠⚠ 「有花錢回購的年度」裡只要有一年讀不到股酬，就不可以宣稱算得出「留下來多少」。 */
  const years = [...spend.keys()].sort().slice(-5);
  const sbcPartial = years.some((y) => !sbc.has(y));

  /* ⚠⚠ 分割清單對不對，拿 XBRL 自己的重編版來驗（同一個 end 的原始 vs 重編，
       比例應該剛好等於中間的分割倍數）。對不上就不要假裝算得出來。 */
  const xcheck = splitCrossCheck(sh.rows, splits);
  const out = buybackSummary({
    shares, spend, sbc, price, sbcPartial,
    // ⚠ 幣別與「一期多長」要往下傳，判讀那一層才講得出「這是歐元，不跟美元股價比」
    cur: sp.unit || 'USD', sbcCur: sc.unit || sp.unit || 'USD', period: picked.period || 'quarter',
  });
  return {
    supported: true, symbol: symbol.toUpperCase(), cik, name: hit.name,
    ...out,
    /* ⚠ 只有<分割>對不上才作廢結論；<填錯單位>那幾季已經在 quarterlyShares 丟掉了，
         其餘年份照常可信（實測 NVDA 只有 2009–2011 五季填錯，近十年完全正常）。 */
    ...(xcheck.split ? { state: 'unknown', label: '算不出來', tone: 'warn', why: ['<b>股票分割對不起來</b>，股數還原之後不可信，所以這張卡不給結論。'] } : {}),
    xcheck,
    src: { shares: picked.tag, spend: sp.tag, sbc: sc.tag, period: picked.period },
    splits: splits.map((s) => ({ at: s.at, r: s.r })),
  };
}
