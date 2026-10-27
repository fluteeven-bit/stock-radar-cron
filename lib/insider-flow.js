/* ───────────── 🕵️ 全市場內部人動向：把「有訊號的」跟「沒訊號的」分開算 ─────────────

   這一頁回答一個問題：<最近全市場有哪些內部人自己掏錢買自家股票>。
   判讀沿用 lib/insider.js 那一套（代碼 P／S 才是公開市場、附註說是計畫自動買的不算
   「自己掏錢買」、同一張分批單合併成一筆），這個檔只多做三件事：
     ① 把發行公司的 SIC 行業代碼對到板塊
     ② 三種範圍（有效買賣／只看高管與董事／照代碼全算）
     ③ 聚合之後要怎麼講才不會講出假話

   ⚠⚠ 參考站 april-insider-flow 的頭條是「近 7 天淨買入 −$701.6M」，而<那個數字沒有意義>，
     它自己的頁面就證明了：同一頁上每個板塊都寫著「計劃內賣出 74%／95%／96%／100%」。
     既然賣出大部分是<事先排定的計畫自動執行>的，拿它去扣有訊號的買進，
     得到的是個沒有意義的數字。
   👉 所以這一頁<買賣分開列、絕對不相減>，頭條只用「自己掏錢買」。
      而「為什麼不相減」這個理由<要用本頁自己算出來的計劃內賣出佔比去說>，
      不是寫一句空的免責聲明（[[learning_用免責聲明代替修好它]]）。

   ⚠ 這一頁<不預測、不給建議>。它報的是公開申報文件上寫了什麼。 */

import { roleOf } from './insider.js';
import { sectorOf } from './sectors.js';

/* ───────────── 📎 附註要對應到正確的欄位 ─────────────

   季度資料集<每個欄位各自有附註編號>，所以可以精準對應 —— 這正是做得起來的關鍵之一。

   ⚠⚠ 交易後持股那兩欄<要排除>。實測 CELH 2026-09-10（accession 0001628280-26-061406）：
     執行長 Fieldly 真的在市場上買了 18,000 股 @ $27.44，
     而那一筆的 `SHRS_OWND_FOLWNG_TRANS_FN` 掛著
       `Includes 523 shares acquired under Celsius' 2025 Employee Stock Purchase Plan`
     —— 那句在講<他買完總共持有幾股裡面有 523 股來自 ESPP>，不是在講這一筆是 ESPP 買的。
     整份掃關鍵字 → <這筆真買會被誤殺>。
   ⚠ 對照組：TSM 2026-09-09（accession 0001046179-26-000644）董事長兼執行長買 149 股，
     ESPP 的附註掛在 `TRANS_DATE_FN` 上（描述這一筆交易本身）→ <正確判成計畫自動買進>。
   這跟 lib/sec.js 的 TX_SCOPE（排除 postTransactionAmounts 那一段）是<同一件事的兩種格式>。 */
export const FN_OUT_OF_SCOPE = ['SHRS_OWND_FOLWNG_TRANS_FN', 'VALU_OWND_FOLWNG_TRANS_FN'];
export const ALL_FN_FIELDS = [
  'SECURITY_TITLE_FN', 'TRANS_DATE_FN', 'DEEMED_EXECUTION_DATE_FN', 'EQUITY_SWAP_TRANS_CD_FN',
  'TRANS_TIMELINESS_FN', 'TRANS_SHARES_FN', 'TRANS_PRICEPERSHARE_FN', 'TRANS_ACQUIRED_DISP_CD_FN',
  'SHRS_OWND_FOLWNG_TRANS_FN', 'VALU_OWND_FOLWNG_TRANS_FN',
  'DIRECT_INDIRECT_OWNERSHIP_FN', 'NATURE_OF_OWNERSHIP_FN',
];
export const PLAN_FN_FIELDS = ALL_FN_FIELDS.filter((f) => !FN_OUT_OF_SCOPE.includes(f));

/* ───────────── 🏷️ 板塊：來源是發行公司在 EDGAR 上的 SIC 行業代碼 ─────────────

   ⚠⚠ 參考站有 29 筆買進落在「未分類」而<完全沒有解釋>。這裡不走那條路：
     對不上的<如實標成「分不出板塊」>，而且要寫出有幾檔、是什麼行業。

   ⚠ 板塊名稱<沿用 lib/sectors.js 的那 11 個鍵> —— 「這個板塊叫什麼、對應哪一支 ETF」
     只能有一份實作（鐵律⑥）。這張表只負責「SIC → 那 11 個鍵之一，或對不上」。
   ⚠ SIC <不是 GICS>：它是 1987 年的美國行業代碼，邊界案例會跟券商的分類不一樣
     （例如遊戲公司的 SIC 是 7372 預製軟體 → 這裡算科技，GICS 算通訊服務）。
     這件事要印在卡上，不可以讓人以為這是券商的板塊。
   ⚠⚠ 順序<有意義>：先比對到的先算。醫療那一段放在化學（2800-2829）前面，
     否則藥品（2833-2836）會被算成原物料。 */
export const SIC_RANGES = [
  // 醫療保健
  [2830, 2836, 'Healthcare'],
  [3826, 3826, 'Healthcare'],
  [3841, 3851, 'Healthcare'],
  [5047, 5047, 'Healthcare'],
  [5122, 5122, 'Healthcare'],
  [8000, 8099, 'Healthcare'],
  [8731, 8731, 'Healthcare'],
  // 科技
  [3570, 3579, 'Technology'],
  [3661, 3669, 'Technology'],
  [3670, 3699, 'Technology'],
  [3821, 3821, 'Technology'],
  [3827, 3829, 'Technology'],
  [7370, 7379, 'Technology'],
  // 金融
  [6020, 6036, 'Financial Services'],
  [6099, 6099, 'Financial Services'],
  [6111, 6163, 'Financial Services'],
  [6172, 6199, 'Financial Services'],
  [6200, 6299, 'Financial Services'],
  [6300, 6411, 'Financial Services'],
  [6726, 6726, 'Financial Services'],
  [6770, 6770, 'Financial Services'],
  // 房地產
  [6500, 6552, 'Real Estate'],
  // ⚠ 權利金信託：SIC 把它們放在金融／不動產那一段，但它們的收入來自<油氣與礦>，
  //   所以照產業歸到能源與原物料（SIC 不是 GICS，這種邊界案例本來就會不一樣）。
  [6792, 6792, 'Energy'],
  [6794, 6794, 'Industrials'],
  [6795, 6795, 'Basic Materials'],
  [6798, 6798, 'Real Estate'],
  // 能源
  [1221, 1241, 'Energy'],
  [1311, 1311, 'Energy'],
  [1381, 1389, 'Energy'],
  [2911, 2911, 'Energy'],
  [4610, 4619, 'Energy'],
  [5171, 5172, 'Energy'],
  // 公用事業
  [4900, 4949, 'Utilities'],
  [4961, 4961, 'Utilities'],
  [4991, 4991, 'Utilities'],
  // 通訊服務
  [2711, 2741, 'Communication Services'],
  [4810, 4841, 'Communication Services'],
  [4888, 4899, 'Communication Services'],
  [7310, 7319, 'Communication Services'],
  [7812, 7841, 'Communication Services'],
  // 非必需消費
  // ⚠ 1520-1531＝住宅營建（Lennar 是 1520 不是 1531）。只寫 1531 的話，
  //   這個月最大的一筆買進（波克夏買 Lennar $382.9M）會掉進「分不出板塊」。
  [1520, 1531, 'Consumer Cyclical'],
  [7200, 7299, 'Consumer Cyclical'],
  [8200, 8299, 'Consumer Cyclical'],
  [2200, 2399, 'Consumer Cyclical'],
  [2510, 2599, 'Consumer Cyclical'],
  [3011, 3021, 'Consumer Cyclical'],
  [3100, 3151, 'Consumer Cyclical'],
  [3630, 3639, 'Consumer Cyclical'],
  [3710, 3716, 'Consumer Cyclical'],
  [3751, 3751, 'Consumer Cyclical'],
  [3942, 3949, 'Consumer Cyclical'],
  [5200, 5410, 'Consumer Cyclical'],
  [5412, 5736, 'Consumer Cyclical'],
  [5810, 5813, 'Consumer Cyclical'],
  [5900, 5911, 'Consumer Cyclical'],
  [5913, 5999, 'Consumer Cyclical'],
  [7000, 7011, 'Consumer Cyclical'],
  [7500, 7549, 'Consumer Cyclical'],
  [7900, 7999, 'Consumer Cyclical'],
  // 必需消費
  [100, 999, 'Consumer Defensive'],
  [2000, 2141, 'Consumer Defensive'],
  [2840, 2844, 'Consumer Defensive'],
  [5140, 5149, 'Consumer Defensive'],
  [5411, 5411, 'Consumer Defensive'],
  [5912, 5912, 'Consumer Defensive'],
  // 原物料
  [1000, 1099, 'Basic Materials'],
  [1400, 1499, 'Basic Materials'],
  [2400, 2499, 'Basic Materials'],
  [2600, 2679, 'Basic Materials'],
  [2800, 2829, 'Basic Materials'],
  [2850, 2899, 'Basic Materials'],
  [3050, 3099, 'Basic Materials'],
  [3200, 3299, 'Basic Materials'],
  [3300, 3399, 'Basic Materials'],
  // 工業
  [1540, 1599, 'Industrials'],
  [1600, 1799, 'Industrials'],
  [2750, 2799, 'Industrials'],
  [3400, 3499, 'Industrials'],
  [3500, 3569, 'Industrials'],
  [3580, 3629, 'Industrials'],
  [3640, 3660, 'Industrials'],
  [3700, 3709, 'Industrials'],
  [3720, 3743, 'Industrials'],
  [3760, 3799, 'Industrials'],
  [3800, 3820, 'Industrials'],
  [3822, 3825, 'Industrials'],
  [3830, 3840, 'Industrials'],
  [3860, 3941, 'Industrials'],
  [3950, 3999, 'Industrials'],
  [4000, 4013, 'Industrials'],
  [4100, 4173, 'Industrials'],
  [4200, 4231, 'Industrials'],
  [4400, 4499, 'Industrials'],
  [4500, 4581, 'Industrials'],
  [4700, 4789, 'Industrials'],
  [4950, 4959, 'Industrials'],
  [5000, 5046, 'Industrials'],
  [5048, 5121, 'Industrials'],
  [5123, 5139, 'Industrials'],
  [5150, 5170, 'Industrials'],
  [5173, 5199, 'Industrials'],
  [7320, 7369, 'Industrials'],
  [7380, 7389, 'Industrials'],
  [8700, 8730, 'Industrials'],
  [8732, 8744, 'Industrials'],
];

/* SIC → 那 11 個板塊鍵之一，對不上回 null。
   ⚠⚠ null 的意思是「<分不出來>」，<不是>「沒有板塊」。這兩件事在畫面上要說不同的話
     （[[learning_算不出來和算出來是否定的是兩回事]]）。 */
export function sectorKeyOfSic(sic) {
  const n = Number(String(sic == null ? '' : sic).trim());
  if (!Number.isInteger(n) || n <= 0 || n > 9999) return null;
  for (const [lo, hi, key] of SIC_RANGES) if (n >= lo && n <= hi) return key;
  return null;
}

/* 板塊的中文名與追蹤 ETF。<走 lib/sectors.js>，不要在這裡再寫一份對照。 */
export function sectorLabelOf(key) {
  if (!key || key === '_none') return { name: '分不出板塊', symbol: null, key: '_none' };
  const hit = sectorOf({ sector: key }, 'US');
  return hit ? { name: hit.name, symbol: hit.symbol, key } : { name: key, symbol: null, key };
}
export const NO_SECTOR_WHY = '這幾檔的發行公司在 EDGAR 上的 <b>SIC 行業代碼對不上</b>我們這 11 個板塊'
  + '（或那家公司根本沒有 SIC）—— 這是<b>分不出來</b>，<b>不是</b>「沒有板塊」，也<b>不是</b>「不重要」。'
  + '它們的買賣<b>照樣算進最上面的總數</b>，只是沒辦法放進某一個板塊。';
export const SIC_SOURCE_WHY = '板塊是用<b>發行公司在 EDGAR 上的 SIC 行業代碼</b>對出來的（來源跟申報同一個地方）。'
  + '⚠ SIC <b>不是券商用的 GICS</b>，邊界案例會不一樣'
  + '（例如遊戲公司的 SIC 是「預製軟體」→ 這裡算科技，券商多半算通訊服務）。';

/* ───────────── 💸 申報書上的「每股價格」會填錯，而且錯得很大 ─────────────

   ⚠⚠ 2026-10 實測兩種，兩種都是<發行人自己填錯>，不是我們解析錯（原始 XML 對過）：
     ① <總價填進了每股欄>。SLBT（SL Science Holding）一筆 4,545,306 股「@ $2,272,653」，
        而它自己的附註寫著 `for an aggregate purchase price of US$2,272,653` ——
        每股其實是 $0.50。不擋的話這一筆是 <$10.3 兆>，比整個美股市值還大，
        而且它會<一個人獨占整張榜、整個板塊、整個頭條>。
     ② <小數點掉了>。UUU 一筆 18,000 股「@ $5,134」，而同一個人同一週其他兩筆是
        $5.11、$5.02 —— 差 1000 倍（真實值 $5.134）。

   兩道過濾，<順序無所謂，兩道各自獨立>：
     ① 同一家公司的<同一種證券>有 ≥3 筆公開市場報價 → 跟<自己的中位數>比，
        差 100 倍以上當成填錯
     ② 比不出中位數（只有一兩筆）→ 只能用絕對上界：每股 100 萬美元
        （全美股最貴的波克夏 A 股約 70 萬，所以 100 萬以上不是股價）

   ⚠⚠ 這兩個門檻<第一版都設錯了，而且錯的方向是「殺到誠實的申報」>：
     ⚠ 中位數本來是<按公司>算的 —— 但同一家公司可能同時申報 <ADS 與原股>。
       實測 PAM 同一份申報裡同時有 $3.105（原股）與 $77.628（ADS），<剛好 25 倍>，
       那是<股別比例，不是填錯>。改成按<公司＋證券名稱>算。
     ⚠ 倍數本來設 10 倍 —— 實測 10 倍會擋掉 UXIN 的 Class A 原股（$0.01 對 ADS $1.15）
       與 IBO 的 $0.55（總共 398 美元）。改成 100 倍之後，兩個已知的真錯
       （SLBT 走絕對值、UUU 1012 倍）照樣擋得住。
     👉 代價要講出來：<10 到 100 倍之間的填錯，這一頁擋不掉>。

   ⚠⚠ 擋掉的<要數出來、印在頁面上>。靜悄悄丟掉的話，這張榜就跟那些「股數掉最多」
     的排行榜一樣 —— 看起來很乾淨，但沒有人知道它乾淨在哪裡
     （[[learning_排行榜的價值全在那幾道過濾]]）。
   ⚠ 只有一兩筆報價的公司<比不出中位數>，所以「$5,134 這種幅度」擋不掉。
     這件事也要講，不要假裝全部擋得掉。 */
export const PX_ABS_MAX = 1e6;
export const PX_RATIO = 100;
export const PX_MIN_SAMPLE = 3;
const pxKey = (r) => `${r.cik}|${String((r && r.security) || '').trim().toLowerCase()}`;
export function dropBadPrices(rows = []) {
  const by = new Map();
  for (const r of rows) {
    const p = Number(r && r.price);
    if (!(p > 0) || !r.cik) continue;
    const k = pxKey(r);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(p);
  }
  const med = new Map();
  for (const [k, a] of by) {
    if (a.length < PX_MIN_SAMPLE) continue;
    a.sort((x, y) => x - y);
    med.set(k, a[Math.floor(a.length / 2)]);
  }
  const kept = [], bad = [];
  for (const r of rows) {
    const p = Number(r && r.price) || 0;
    const m = med.get(pxKey(r));
    const why = p > PX_ABS_MAX ? 'abs'
      : (m && p > 0 && (p > m * PX_RATIO || p < m / PX_RATIO)) ? 'ratio' : null;
    if (why) bad.push({ ...r, badPrice: why, median: m || null }); else kept.push(r);
  }
  return { kept, bad };
}
export const BAD_PRICE_WHY = '⚠ 有幾筆<b>申報書上的每股價格明顯填錯</b>，整筆<b>擋在外面</b>。'
  + '實測這一個月兩種：一種是<b>把整筆的總價填進了每股欄</b>'
  + '（有一筆 454 萬股「每股 227 萬美元」，它自己的附註寫的是<b>總價</b> 227 萬 —— '
  + '不擋的話那一筆是 <b>10.3 兆美元</b>，比整個美股市值還大），'
  + '另一種是<b>小數點掉了</b>（同一個人同一週其他筆是 $5.11，那一筆寫 $5,134）。'
  + '判準：同一家公司的<b>同一種證券</b>有三筆以上報價，就跟<b>它自己的中位數</b>比，'
  + '差<b>一百倍</b>以上當成填錯；比不出中位數的只能擋<b>每股超過一百萬美元</b>的'
  + '（全美股最貴的波克夏 A 股約七十萬）。'
  + '⚠⚠ 為什麼要分「同一種證券」、為什麼是一百倍不是十倍：'
  + '同一家公司<b>可能同時申報 ADS 與原股</b>，兩者差一個固定倍數'
  + '（實測 PAM 同一份申報裡 $3.105 的原股與 $77.628 的 ADS，<b>剛好 25 倍</b>）—— '
  + '那是<b>股別比例，不是填錯</b>。按公司算、用十倍當門檻的話，<b>誠實的申報會被殺掉</b>。'
  + '⚠ 代價：<b>差十到一百倍的填錯，這一頁擋不掉</b>，只有一兩筆報價的小公司也擋不掉。'
  + '這一頁沒有假裝全部擋得掉。';

/* ───────────── 👤 申報人身分：三類 ─────────────
   ⚠ 10% 大股東的買賣<常常是法人的持股配置>，不是「經營這家公司的人」的意見
     —— 實測一天的索引裡，同一件申報掛著 Biglari Capital、LION FUND II 等七個法人實體。
     所以要讓他可以把這一類<單獨關掉>。 */
export const ROLE_CLASS = {
  exec: { label: '高管與董事', why: '公司的經營者與董事會成員 —— 他們自己掏錢買，份量最重' },
  owner10: { label: '10% 大股東', why: '持股超過一成的大股東（常常是法人）—— 買賣多半是持股配置，不是經營者的意見' },
  other: { label: '其他申報人', why: '既不是高管董事、也不到 10% 的申報人（例如已離任、或關係人）' },
};
export function roleClassOf({ isOfficer = false, isDirector = false, isTenPercent = false } = {}) {
  if (isOfficer || isDirector) return 'exec';
  if (isTenPercent) return 'owner10';
  return 'other';
}
export const ROLE_ORDER = ['exec', 'owner10', 'other'];

/* ───────────── 🪣 桶子 ─────────────
   每一個實體（總計／板塊／某一天／某一家公司）都存同一組 12 個桶：
     身分（高管董事／10% 大股東／其他）× 性質（真的買賣／計畫自動）× 方向（買／賣）
   ⚠ 存成固定長度的陣列，是為了讓「三種範圍」在瀏覽器端<從同一份數字算出來> ——
     每一種範圍各存一份的話，三個數字遲早會對不上（鐵律⑦）。 */
export const BUCKETS = 12;
export function bucketIndex(side, roleClass, isPlan) {
  const base = { exec: 0, owner10: 4, other: 8 }[roleClass];
  if (base == null) return null;
  return base + (isPlan ? 2 : 0) + (side === 'buy' ? 0 : 1);
}

/* ───────────── 🔭 三種範圍 ─────────────
   ⚠⚠ 每一種都要有<自己的一句話>，而且 `all` 那一種要<明說它的買進不是「自己掏錢買」>
     —— 不然它就變成參考站那個假訊號（[[learning_一題四種狀態卻只寫一句話]]）。 */
export const SCOPES = {
  real: {
    label: '有效買賣',
    short: '有效買賣',
    why: '代碼是 <b>P（公開市場買進）／S（公開市場賣出）</b>，而且<b>申報的附註沒有說它是事先排定的計畫自動執行的</b>。申報人不分身分。',
    roles: null, plan: false,
  },
  exec: {
    label: '只看高管與董事',
    short: '高管與董事',
    why: '同「有效買賣」，再<b>把 10% 大股東與其他申報人排除</b> —— 大股東的買賣常常是法人的持股配置，不是<b>經營這家公司的人</b>的意見。',
    roles: ['exec'], plan: false,
  },
  all: {
    label: '照代碼全算（對照組）',
    short: '照代碼全算',
    why: '⚠ 這一種<b>連 ESPP、股利再投資、Rule 10b5-1 預定計畫自動買的都算進來</b>。'
      + '放它在這裡<b>只是為了讓你看見「照代碼算會多出多少」</b> —— '
      + '這個「買進」<b>不等於「有人自己掏錢買」</b>，裡面很多人<b>沒有做過任何決定</b>。',
    roles: null, plan: true,
  },
};
export const SCOPE_KEYS = ['real', 'exec', 'all'];
export function scopeAccepts(scopeKey, roleClass, isPlan) {
  const s = SCOPES[scopeKey];
  if (!s) return false;
  if (isPlan && !s.plan) return false;
  if (s.roles && !s.roles.includes(roleClass)) return false;
  return true;
}

/* 某一個實體在某一種範圍下的數字。
   ⚠⚠ 計劃內賣出佔比的<分母一律是「這個範圍的身分篩選下、全部的賣出」>（含計畫的），
     跟 `plan` 開關無關。頭條那一句「為什麼不相減」跟板塊表那一欄
     <共用這一個算法>，否則卡片會自己打自己臉（鐵律⑦）。 */
export function pickScope(e, scopeKey) {
  const s = SCOPES[scopeKey];
  if (!e || !s) return null;
  const roles = s.roles || ROLE_ORDER;
  const v = e.v || [], n = e.n || [];
  let buyV = 0, buyN = 0, sellV = 0, sellN = 0, planBuyV = 0, planBuyN = 0, planSellV = 0, planSellN = 0;
  for (const rc of roles) {
    const b = { exec: 0, owner10: 4, other: 8 }[rc];
    buyV += v[b] || 0; buyN += n[b] || 0;
    sellV += v[b + 1] || 0; sellN += n[b + 1] || 0;
    planBuyV += v[b + 2] || 0; planBuyN += n[b + 2] || 0;
    planSellV += v[b + 3] || 0; planSellN += n[b + 3] || 0;
  }
  const show = {
    buyV: s.plan ? buyV + planBuyV : buyV,
    buyN: s.plan ? buyN + planBuyN : buyN,
    sellV: s.plan ? sellV + planSellV : sellV,
    sellN: s.plan ? sellN + planSellN : sellN,
  };
  const allSellV = sellV + planSellV, allSellN = sellN + planSellN;
  return {
    ...show,
    realBuyV: buyV, realBuyN: buyN, realSellV: sellV, realSellN: sellN,
    planBuyV, planBuyN, planSellV, planSellN,
    allSellV, allSellN,
    /* ⚠ 分母是 0 的時候回 null，<不要回 0> —— 「算不出佔比」跟「佔比是 0%」是兩件事。 */
    planSellShare: allSellV > 0 ? planSellV / allSellV : null,
    planSellShareN: allSellN > 0 ? planSellN / allSellN : null,
    people: (e.p && e.p[`${scopeKey}b`]) || 0,
    sellPeople: (e.p && e.p[`${scopeKey}s`]) || 0,
    firms: (e.c && e.c[`${scopeKey}b`]) || 0,
    sellFirms: (e.c && e.c[`${scopeKey}s`]) || 0,
  };
}

/* ───────────── 📏 樣本數太少就要明白標出來 ─────────────
   ⚠⚠ 參考站的「公用事業 +$18.6M」<只有 1 筆交易>就代表整個板塊，
     而它沒有標示 —— 讀的人會以為那是一個趨勢。
   ⚠ 這個門檻<只有一個出處>：板塊表上那個標記、以及底下那句話，都讀同一個函式（鐵律⑦）。 */
export const THIN_MAX = 4;
export function thinOf(n) {
  const k = Number(n) || 0;
  if (k <= 0) return null;                              // 0 筆是另一種狀態，不是「樣本少」
  if (k > THIN_MAX) return null;
  return {
    n: k,
    badge: `只有 ${k} 筆`,
    why: k === 1
      ? `這個板塊整段期間<b>只有 1 筆交易</b>，那是<b>一個人的一個決定</b>，不是一個趨勢 —— 金額再大也只是那一筆。`
      : `這個板塊整段期間<b>只有 ${k} 筆交易</b>（不到 ${THIN_MAX + 1} 筆），<b>不足以看成趨勢</b> —— 一兩筆大單就能主導這個數字。`,
  };
}

/* ───────────── 🚫 為什麼買賣不相減 ─────────────
   ⚠⚠ 這句話<要帶本頁自己算出來的數字>。寫空話等於沒修
     （[[learning_用免責聲明代替修好它]]：量得出偏差就去修，量不出來的才寫小字）。 */
export function noNetWhy(pick) {
  const pct = pick && pick.planSellShare != null ? Math.round(pick.planSellShare * 100) : null;
  const head = '這兩個數字<b>刻意不相減</b>，也<b>不會印出「淨買超」</b>。';
  if (pct == null) {
    /* ⚠ 算不出佔比的時候<不可以照抄那句話> —— 沒有賣出就沒有「大部分是計畫」這件事。 */
    return head + '理由：<b>賣出幾乎沒有訊號</b>（節稅、分散、買房、事先排定的計畫都會賣，'
      + '而高管的薪酬本來就是股票，不賣就無法變現），拿它去扣有訊號的買進，得到的是個沒有意義的數字。'
      + '<b>這段期間沒有賣出可以算佔比</b>，所以上面那個理由是通則，不是這一段的實測。';
  }
  return head + `理由<b>就在這一頁上</b>：這段期間的賣出有 <b>${pct}%</b>（按金額）是`
    + '<b>事先排定的計畫自動執行</b>的 —— 那些人沒有在那一天做任何決定。'
    + '拿一個<b>大部分沒有訊號</b>的數字去扣一個<b>有訊號</b>的，得到的是個沒有意義的數字。';
}

export const FILED_TRUTH = '這一頁的日期一律是<b>提交日</b>（SEC 收到那份申報的那一天），<b>不是交易日</b>。'
  + 'Form 4 是成交後<b>兩個營業日</b>內要交，所以交易日會更早'
  + '（實測 MU 交易日 10-16、提交日 10-20，<b>差四天</b>）。'
  + '用提交日是因為<b>那才是「這件事什麼時候可以被知道」</b>；'
  + '而且交易日是<b>申報人自己填的</b>，實測整季裡有填到 2027 年的。';

export const FLOW_TRUTH = '這一頁報的是<b>公開申報文件上寫了什麼</b>，不是「所以會漲」，也不是建議。'
  + '內部人<b>買進</b>是他自己掏現金做的決定；<b>賣出</b>幾乎沒有訊號。';

export const SCOPE_TRUTH = '這一頁掃的是<b>全美股市場</b>所有交了 Form 4 的公司'
  + '（不是你關注的那幾檔，也不是一份固定名單）。'
  + '來源是 <b>SEC 官方的 Form 345 季度結構化資料集</b>加上<b>EDGAR 每日索引逐份申報</b>。';

/* ───────────── 🗓️ 涵蓋到哪一天（兩段資料要分開講） ─────────────
   ⚠⚠ 季度資料集<最新只到季末>。混成一句「涵蓋到 10/21」的話，
     讀的人沒辦法知道哪一段可能有洞。所以兩段各講各的。 */
export function coverOf(p) {
  if (!p || !p.from) return null;
  const back = (p.src && p.src.back) || {};
  const dsTo = (p.src && p.src.dsTo) || null;
  const out = {
    from: p.from, to: p.to, builtAt: p.builtAt,
    dsFrom: p.from, dsTo,
    backFrom: back.from || null, backTo: back.to || null,
    unread: Number(back.unread) || 0,
    unreadDays: back.unreadDays || [],
    lines: [],
  };
  if (dsTo) out.lines.push(`<b>${p.from} → ${dsTo}</b>：SEC 官方的季度結構化資料集（整季一次下載，<b>沒有漏讀的問題</b>）`);
  if (back.from && back.from <= p.to) {
    out.lines.push(out.unread > 0
      ? `<b>${back.from} → ${p.to}</b>：每日索引逐份打開回補 —— ⚠ 其中 <b>${out.unread} 份讀不到</b>（上游擋掉），所以這一段是<b>下限</b>`
      : `<b>${back.from} → ${p.to}</b>：每日索引逐份打開回補，<b>全部讀到了</b>`);
  }
  /* ⚠ 建檔日跟涵蓋日<不是同一件事>，要各寫一行 —— 不然「今天的資料」會被誤會。 */
  out.stale = p.builtAt && p.to
    ? Math.round((Date.parse(p.builtAt + 'T00:00:00Z') - Date.parse(p.to + 'T00:00:00Z')) / 864e5)
    : null;
  return out;
}

/* ───────────── 🗓️ 每一天 ─────────────
   ⚠⚠ 六種處境<各寫各的一句話>。尤其<讀不到的那一天不可以畫成一根 0> ——
     那就是把「讀不到」畫成「沒有」（鐵律⑤）。 */
export const DAY_STATE = {
  ds: { label: '季度資料集', why: '這一天來自 SEC 官方的季度結構化資料集，沒有漏讀的問題' },
  back: { label: '逐份回補', why: '這一天是把每日索引裡的申報一份一份打開讀出來的' },
  partial: { label: '有讀不到的', why: '⚠ 這一天<b>有申報讀不到</b>（上游擋掉）—— 這一根是<b>下限</b>，不是那天的全部' },
  noindex: { label: '沒有索引', why: 'SEC <b>那一天沒有發布索引</b>（多半是假日）—— 這是<b>問不到</b>，<b>不是</b>「那天沒有人買」' },
  weekend: { label: '週末', why: '週末 SEC 不收件，所以本來就沒有申報' },
  gap: { label: '沒有資料', why: '⚠ 這一天<b>兩段來源都沒有涵蓋到</b> —— 這是<b>缺口</b>，<b>不是</b>「那天沒有人買」' },
};
export function flowDays(p, scopeKey) {
  if (!p || !p.from || !p.to) return [];
  const byDay = new Map();
  for (const d of p.daily || []) byDay.set(d.d, d);
  const backDays = new Map();
  for (const x of (p.src && p.src.back && p.src.back.days) || []) backDays.set(x.d, x);
  const unread = new Set((p.src && p.src.back && p.src.back.unreadDays) || []);
  const dsTo = (p.src && p.src.dsTo) || null;
  const out = [];
  for (let d = p.from; d <= p.to; d = new Date(Date.parse(d + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10)) {
    const wd = new Date(Date.parse(d + 'T00:00:00Z')).getUTCDay();
    let state;
    if (wd === 0 || wd === 6) state = 'weekend';
    else if (dsTo && d <= dsTo) state = 'ds';
    else {
      const b = backDays.get(d);
      if (!b) state = 'gap';
      else if (b.kind === 'noindex') state = 'noindex';
      else if (b.kind === 'weekend') state = 'weekend';
      else state = unread.has(d) ? 'partial' : 'back';
    }
    const e = byDay.get(d);
    const pick = e ? pickScope(e, scopeKey) : null;
    out.push({
      d, state, ...DAY_STATE[state],
      /* ⚠ 沒有資料的那幾種狀態<值要給 null 不是 0>：畫面才有辦法畫成「不知道」而不是「零」。 */
      buyV: state === 'noindex' || state === 'gap' ? null : (pick ? pick.buyV : 0),
      sellV: state === 'noindex' || state === 'gap' ? null : (pick ? pick.sellV : 0),
      buyN: pick ? pick.buyN : 0, sellN: pick ? pick.sellN : 0,
      planSellV: pick ? pick.planSellV : 0,
      trading: !(wd === 0 || wd === 6),
      known: state === 'ds' || state === 'back' || state === 'partial',
    });
  }
  return out;
}

/* ───────────── 🏷️ 板塊表 ───────────── */
export function flowSectors(p, scopeKey, { by = 'buy', win = 'all', role = 'any', minKey = 'any' } = {}) {
  /* ⚠⚠ 買進那幾欄<改從逐筆算>（flowBuys），賣出那幾欄還是讀合計。
       這是為了讓「同一個數字只有一個出處」：時間窗與職位／金額篩選一旦開著，
       頭條、板塊、公司排名<三張表的買進都走同一份逐筆資料> ——
       各算一份的話，三個數字遲早對不上（鐵律⑦）。
     ⚠ 逐筆的 v 是<美元>，合計的 v 是<千美元>。在這裡就換好單位，
       不要讓畫面那一層去記「哪一欄是什麼單位」。 */
  const agg = flowBuyAgg(p, scopeKey, { win, role, minKey });
  const rows = [];
  for (const s of p.sectors || []) {
    const pick = pickScope(s, scopeKey);
    if (!pick) continue;
    const lab = sectorLabelOf(s.key);
    const b = agg.bySec.get(s.key) || { v: 0, n: 0, people: 0, firms: 0 };
    rows.push({
      key: s.key, ...lab, ...pick,
      buyV: Math.round(b.v / 1000), buyN: b.n, people: b.people, firms: b.firms,
      thin: thinOf(b.n + pick.sellN),
      /* ⚠ 買進與賣出<各自>也可能樣本太少，所以兩邊各算一次。 */
      thinBuy: thinOf(b.n), thinSell: thinOf(pick.sellN),
      none: b.n + pick.sellN === 0,
    });
  }
  rows.sort((a, b) => (a.key === '_none') - (b.key === '_none')
    || (by === 'sell' ? b.sellV - a.sellV : b.buyV - a.buyV));
  return rows;
}

/* ───────────── 🧮 逐筆買進的聚合（<買進那一半唯一的出處>）─────────────
   ⚠⚠ 頭條的買進、板塊的買進、公司排名的買進<全部讀這一個函式>。
     第一版它們三個各自讀合計桶，所以一旦加上時間窗或篩選，
     就會變成「三張表各自算一份」—— 那是鐵律⑦明文禁止的那件事。
   ⚠ 人數與家數<數不重複的>，所以不能把每個板塊的加起來當總數
     （同一個人在兩個板塊各買一家，那是一個人）。 */
export function flowBuyAgg(p, scopeKey, { win = 'all', role = 'any', minKey = 'any', sector = null } = {}) {
  const list = flowBuys(p, scopeKey, { win, role, minKey, sector });
  const bySym = new Map();
  const bySec = new Map();
  for (const b of list) {
    const f = bySym.get(b.sym) || bySym.set(b.sym, {
      sym: b.sym, name: b.name, cik: b.cik, sec: b.sec, secName: b.secName, secSymbol: b.secSymbol,
      v: 0, n: 0, who: new Set(), buys: [], topUp: null, topBefore: null, topAfter: null, newPos: false, last: '',
    }).get(b.sym);
    f.v += Number(b.v) || 0;
    f.n += 1;
    f.who.add(b.who);
    f.buys.push(b);
    if (b.upPct != null && (f.topUp == null || b.upPct > f.topUp)) {
      f.topUp = b.upPct; f.topBefore = b.before; f.topAfter = b.after;
    }
    if (b.newPos) f.newPos = true;
    if (String(b.filed) > f.last) f.last = String(b.filed);

    const sk = b.sec || '_none';
    const g = bySec.get(sk) || bySec.set(sk, { v: 0, n: 0, who: new Set(), firms: new Set() }).get(sk);
    g.v += Number(b.v) || 0;
    g.n += 1;
    g.who.add(b.sym + '|' + b.who);
    g.firms.add(b.sym);
  }
  for (const f of bySym.values()) { f.people = f.who.size; f.buys.sort((a, b) => b.v - a.v); }
  for (const g of bySec.values()) { g.people = g.who.size; g.firms = g.firms.size; }
  return { list, total: sumBuys(list), bySym, bySec };
}

/* ───────────── 🏆 公司排名 ───────────── */
export function flowFirms(p, scopeKey, {
  side = 'buy', sector = null, limit = 40, win = 'all', role = 'any', minKey = 'any',
} = {}) {
  /* 買進那一邊<走逐筆>（吃得到時間窗與篩選，而且帶得出增持％）；
     賣出那一邊<沒有逐筆>，讀合計（所以時間窗不動它，WIN_WHY 寫了為什麼）。 */
  const agg = side === 'buy' ? flowBuyAgg(p, scopeKey, { win, role, minKey, sector }) : null;
  const out = [];
  for (const f of p.firms || []) {
    if (sector && (f.sec || '_none') !== sector) continue;
    const pick = pickScope(f, scopeKey);
    if (!pick) continue;
    const ag = agg ? agg.bySym.get(f.sym) : null;
    const v = side === 'sell' ? pick.sellV : Math.round((ag ? ag.v : 0) / 1000);
    const n = side === 'sell' ? pick.sellN : (ag ? ag.n : 0);
    if (!(n > 0)) continue;
    /* ⚠⚠ 板塊的欄位<不可以直接攤平進來>：sectorLabelOf 回傳的 `name` 是<板塊名稱>，
         攤平之後會蓋掉<公司名稱> —— 線上實測第一列印成「LEN／非必需消費」，
         Lennar 這家公司的名字整個不見了。收進 secName／secSymbol。 */
    const lab = sectorLabelOf(f.sec);
    out.push({
      sym: f.sym, name: f.name, sec: f.sec || '_none', sicDesc: f.sicDesc || null,
      secName: lab.name, secSymbol: lab.symbol, secKey: lab.key,
      ...pick, v, n,
      people: side === 'buy' ? (ag ? ag.people : 0) : pick.people,
      /* 📏 這一家裡面<增持比例最高的那一筆>與<有沒有人是新建倉>。
           ⚠ topUp 為 null ＝這一家<每一筆都算不出來>，不是「都沒有增持」。 */
      topUp: ag ? ag.topUp : null,
      topBefore: ag ? ag.topBefore : null,
      topAfter: ag ? ag.topAfter : null,
      newPos: ag ? ag.newPos : false,
      last: ag ? ag.last : null,
      buys: side === 'buy' ? (ag ? ag.buys : []) : [],
      cut: side === 'buy' ? Number(f.cut) || 0 : 0,
    });
  }
  out.sort((a, b) => b.v - a.v || b.n - a.n);
  return out.slice(0, limit);
}

/* ───────────── 🧾 頭條 ─────────────
   ⚠⚠ 四種處境<各寫各的一句話>：
     ok      有自己掏錢買          → 照常報，而且說明為什麼不相減
     nobuy   這段期間沒有人掏錢買   → 這是結論，不是故障（但全市場不太可能，所以要講清楚）
     unread  <整段都讀不到>        → 結論整個作廢，不可以畫成「沒有人買」
     empty   連資料都沒有          → 建檔沒跑成功，明說，不要畫成 0 */
export function flowHeadline(p, scopeKey, { win = 'all', role = 'any', minKey = 'any' } = {}) {
  const scope = SCOPES[scopeKey] || SCOPES.real;
  if (!p || !p.total || !Array.isArray(p.total.v)) {
    return {
      state: 'empty', label: '這一份還沒有資料',
      why: ['<b>資料檔是空的</b>（建檔腳本沒有跑成功）—— 這<b>不是</b>「沒有人買」，是這一份還沒建起來。'],
      pick: null, cover: coverOf(p), scope,
    };
  }
  /* ⚠⚠ 買進那一半<換成逐筆算出來的>（這樣才吃得到時間窗與篩選），賣出那一半讀合計。
       兩個數字<來源不同>，所以畫面上<一定要標出賣出那一欄是整段的> —— 不標的話
       「近 7 天買 $12M、賣 $4.15B」會被讀成同一段期間的對比，那是一句假話。 */
  const agg = flowBuyAgg(p, scopeKey, { win, role, minKey });
  const raw = pickScope(p.total, scopeKey);
  const pick = {
    ...raw,
    buyV: Math.round(agg.total.v / 1000), buyN: agg.total.n,
    people: agg.total.people, firms: agg.total.firms,
  };
  const filtered = win !== 'all' || role !== 'any' || minKey !== 'any';
  const cover = coverOf(p);
  const why = [];
  /* 整段都讀不到：有涵蓋區間、但一筆都沒收到。 */
  if (!pick.buyN && !pick.sellN && cover && cover.unread > 0) {
    return {
      state: 'unread', label: '這次讀不到（不是沒有人買）',
      why: [`回補期間有 <b>${cover.unread} 份申報讀不到</b>，而這段期間<b>一筆公開市場買賣都沒收到</b> —— `
        + '<b>這不代表沒有人在買</b>，只代表這一份建起來的時候問不到。'],
      pick, cover, scope,
    };
  }
  if (!pick.buyN && !pick.sellN) {
    return {
      state: 'nobuy', label: '這段期間一筆公開市場買賣都沒有',
      why: ['全市場<b>一筆都沒有</b>是<b>不太可能</b>的事 —— 比較可能是<b>這一份建錯了</b>或範圍篩得太窄，'
        + '而不是真的沒有人買賣。<b>不要把它讀成「沒有人看好」。</b>'],
      pick, cover, scope,
    };
  }
  why.push(noNetWhy(pick));
  if (filtered) why.push(WIN_WHY);
  if (scopeKey === 'all') why.push(SCOPES.all.why);
  if (cover && cover.unread > 0) {
    why.push(`⚠ 回補期間有 <b>${cover.unread} 份申報讀不到</b>，所以上面每一個數字都是「<b>讀到的那些裡面</b>」的`
      + '<b>下限</b>，不是全部。');
  }
  const label = pick.buyN
    ? `${fmtPeople(pick.people)}在這段期間<b>自己掏錢買</b>（${pick.firms} 家公司、${pick.buyN} 筆）`
    : '這段期間<b>沒有人自己掏錢買</b>，只有賣出';
  if (!pick.buyN) {
    why.unshift('<b>沒有人自己掏錢買</b>這件事本身就是結論的一部分 —— 公開市場買進本來就稀有，'
      + '而這段期間<b>一筆都沒有</b>。這<b>不是</b>讀不到。');
  }
  return { state: 'ok', label, why, pick, cover, scope, filtered, win: winOf(win), agg };
}
const fmtPeople = (n) => `<b>${Number(n) || 0} 位內部人</b>`;

/* 金額：資料檔存的是<千美元>。 */
export const fromK = (k) => (Number(k) || 0) * 1000;
export function money(k) {
  const v = fromK(k);
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}
/* 點得到 SEC 原始申報。⚠ 抽驗對帳要靠這個，所以不可以只印 accession 不給連結。 */
export const secUrlOf = (acc) => {
  const a = String(acc || '').trim();
  if (!/^\d{10}-\d{2}-\d{6}$/.test(a)) return null;
  return `https://www.sec.gov/Archives/edgar/data/${Number(a.slice(0, 10))}/${a.replace(/-/g, '')}/${a}-index.htm`;
};

/* ═════════════════════════════════════════════════════════════════════════
   🧩 逐筆買進清單（第二版加的）

   ⚠⚠ 第一版這一頁只存了<每一家的前三大買進>，所以除了「照金額排」以外什麼都算不出來。
     那讓整張榜被<法人與 10% 大股東>佔滿（實測第一名是波克夏買 Lennar $382.9M）——
     那是<資金流>，不是「經營這家公司的人自己掏錢買」。
   👉 第二版把<每一筆買進都存進來>，於是下面這些全部可以在瀏覽器端
     <從同一份逐筆資料>算出來，不必每一種各存一份（鐵律⑦）：
       ① 集群買入（同一家公司有幾位不同的高管／董事各自買）
       ② 增持 ％ 與新建倉（走 lib/insider.js 的 stakeMove，判斷只有一份）
       ③ 職位、金額、時間窗篩選
       ④ 公司查詢

   ⚠⚠ <賣出沒有存逐筆>，只存了合計。所以<時間窗只動買進那一半>，而且畫面上要說出來。
     為什麼不存：賣出有大半是事先排定的計畫自動執行的（這一頁的頭條就在講這件事），
     為一個<沒有訊號>的方向存一千多筆逐筆資料，是拿檔案大小換一個不會用的功能。
   ⚠ 而且「不重複人數／家數」<不能把每天的加起來>（同一個人連續三天賣會被數成三個人）
     —— 買進那邊有逐筆所以數得準，賣出那邊沒有，這也是時間窗只動買進的原因之一。
   ═════════════════════════════════════════════════════════════════════════ */

/* ⏱️ 時間窗。⚠ `days: null` ＝整段，不是 0 天。 */
export const BUY_WINS = [
  { key: 'all', days: null, label: '整段' },
  { key: 'd14', days: 14, label: '近 14 天' },
  { key: 'd7', days: 7, label: '近 7 天' },
];
export const BUY_WIN_KEYS = BUY_WINS.map((w) => w.key);
export const WIN_WHY = '⚠ 時間窗<b>只動買進那一半</b>（公司排名的買進、集群買入、本期要點）。'
  + '買進那一邊<b>每一筆都存著</b>，所以任何一段期間都算得準；'
  + '賣出只存了<b>合計</b>，而<b>每天的「不重複人數」加起來不等於整段的不重複人數</b>'
  + '（同一個人連續三天賣，會被數成三個人）—— 與其算一個錯的，這一頁<b>直接不動它</b>，'
  + '並且在欄位上標明那是<b>整段</b>的數字。';

/* 👔 職位。走 lib/insider.js 的 roleOf 的 key，<這裡不自己判一次職稱>（鐵律⑥）。 */
export const ROLE_PICKS = {
  any: { label: '不分身分', keys: null, why: '所有申報人：高管、董事、10% 大股東、其他關係人都算。' },
  cxo: {
    label: '執行長・財務長', keys: ['ceo', 'cfo'],
    why: '<b>只看執行長與財務長</b> —— 這兩個位子最清楚公司下一季會怎樣，他們自己掏錢買的份量最重。',
  },
  dir: {
    label: '董事（含董事長）', keys: ['chair', 'director'],
    why: '<b>只看董事會成員</b>。他們看得到董事會資料，但不管日常營運。',
  },
  own: {
    label: '10% 大股東', keys: ['owner10'],
    why: '⚠ <b>只看持股超過一成的大股東</b>（多半是法人）。這一類的買賣常常是<b>持股配置</b>，'
      + '不是「經營這家公司的人」的意見 —— 放這一個選項是為了讓你<b>把它們挑出來看</b>，'
      + '或是用上面那幾個選項<b>把它們排除掉</b>。',
  },
};
export const ROLE_PICK_KEYS = ['any', 'cxo', 'dir', 'own'];

/* 💵 金額門檻。⚠ 單位是<美元>（逐筆買進的 v 存的是美元，不是千美元）。 */
export const MIN_PICKS = [
  { key: 'any', min: 0, label: '不限' },
  { key: 'k100', min: 100000, label: '$10 萬以上' },
  { key: 'k500', min: 500000, label: '$50 萬以上' },
  { key: 'm1', min: 1000000, label: '$100 萬以上' },
];
export const MIN_PICK_KEYS = MIN_PICKS.map((m) => m.key);

export function winOf(key) { return BUY_WINS.find((w) => w.key === key) || BUY_WINS[0]; }
export function minPickOf(key) { return MIN_PICKS.find((m) => m.key === key) || MIN_PICKS[0]; }

/* 時間窗的起算日。⚠ 以<資料涵蓋的最後一天>往回數，不是以「今天」往回數 ——
     這一份一個月才重建一次，拿今天往回數會算出一個<空的>「近 7 天」。 */
export function winFromOf(p, winKey) {
  const w = winOf(winKey);
  if (!w.days || !p || !p.to) return null;
  return new Date(Date.parse(p.to + 'T00:00:00Z') - (w.days - 1) * 864e5).toISOString().slice(0, 10);
}

/* 逐筆買進，攤平成一個清單（附上公司與板塊）。
   ⚠ 這是<所有>買進相關功能的唯一入口 —— 集群、篩選、排名、要點都讀它。 */
export function flowBuys(p, scopeKey, {
  win = 'all', role = 'any', minKey = 'any', sector = null, sym = null,
} = {}) {
  const sc = SCOPES[scopeKey] || SCOPES.real;
  const rolesOk = sc.roles ? new Set(sc.roles) : null;
  const rkList = ROLE_PICKS[role] ? ROLE_PICKS[role].keys : null;
  const rkOk = rkList ? new Set(rkList) : null;
  const min = minPickOf(minKey).min;
  const since = winFromOf(p, win);
  const want = sym ? String(sym).trim().toUpperCase() : null;
  const out = [];
  for (const f of p.firms || []) {
    if (sector && (f.sec || '_none') !== sector) continue;
    if (want && f.sym !== want) continue;
    const lab = sectorLabelOf(f.sec);
    for (const b of f.buys || []) {
      /* ⚠ 計畫自動買的那幾筆<也存著>，但只有「照代碼全算」那一種範圍收它們
           —— 判斷走 scopeAccepts，跟桶子用的是同一份（鐵律⑥）。 */
      if (!scopeAccepts(scopeKey, b.rc, !!b.pl)) continue;
      if (rolesOk && !rolesOk.has(b.rc)) continue;
      if (rkOk && !rkOk.has(b.rk)) continue;
      if (Number(b.v) < min) continue;
      if (since && String(b.filed) < since) continue;
      out.push({
        ...b, sym: f.sym, name: f.name, cik: f.cik,
        sec: f.sec || '_none', secName: lab.name, secSymbol: lab.symbol,
        plan: !!b.pl,
        /* 增持 ％：建檔時用 lib/insider.js 的 stakeMove 算好存成<萬分比>。
           ⚠ null ＝<算不出來>（欄位沒填、或兩種持有形式合成一筆算出矛盾），不是 0%。 */
        upPct: b.up == null ? null : b.up / 10000,
        newPos: !!b.nb,
        /* 📏 買之前／買之後各有幾股。⚠ 這兩個數字<一定要跟增持 ％ 印在一起>：
             實測 ATCH 一位董事買之前<只有 706 股>、買了 50 萬股 → 增持 <b>70,822%</b>。
             那個百分比是對的，但單獨印出來會被讀成「他大舉加碼」，
             而實際上那跟<新建倉>幾乎是同一件事。把分母印出來，數字就自己說明自己 ——
             這比去訂一個講不出理由的上限好（[[learning_用免責聲明代替修好它]]）。 */
        after: b.af == null ? null : b.af,
        before: b.af == null || b.af < b.sh ? null : b.af - b.sh,
      });
    }
  }
  out.sort((a, b) => b.v - a.v);
  return out;
}

/* 一個清單的合計。⚠ 人數與家數<數不重複的>，不是把筆數加起來。 */
export function sumBuys(list = []) {
  const who = new Set(), firms = new Set();
  let v = 0;
    /* ⚠ 鍵用 <sym|姓名>，跟建檔那邊一模一樣（理由在 build-insider-flow.mjs 的 ownerKey）。 */
  for (const b of list) { v += Number(b.v) || 0; who.add(b.sym + '|' + b.who); firms.add(b.sym); }
  return { v, n: list.length, people: who.size, firms: firms.size };
}

/* ───────────── 👥 集群買入 ─────────────

   <兩位以上不同的高管／董事，各自在公開市場買同一家公司>。
   ⚠⚠ 這是這一頁<第二版最重要的新東西>，因為它回答的問題跟「誰買得最多」不一樣：
     波克夏一筆 $382.9M 是<一個人>（而且是法人的持股配置）；
     六位主管各自掏錢買同一家，是<六個人分別做了同一個判斷>。
     金額榜看不到第二種 —— 實測那幾家的金額都掉在榜上很後面。
   ⚠ 門檻是<不重複的人>，不是筆數：同一個人分三天買三筆<還是一個人>
     （[[learning_每天一筆不是每天一個樣本]] 的同一條）。
   ⚠ 10% 大股東<不算進集群人數>：同一件申報常常掛著七個法人實體
     （實測 Biglari Capital、LION FUND II…），那會憑空變出一個「七人集群」。 */
export const CLUSTER_MIN = 2;
export const CLUSTER_WHY = '<b>2 位以上不同的高管或董事</b>，各自在公開市場買<b>同一家公司</b>。'
  + '⚠ 為什麼單獨列一張：金額榜排的是「誰買得最多」，那會被<b>法人與大股東的持股配置</b>佔滿'
  + '（實測榜首是波克夏買 Lennar，一筆 $382.9M）。集群排的是「<b>幾個人分別做了同一個判斷</b>」'
  + '—— 六位主管各自掏錢買同一家，跟一個法人買一大筆，是<b>兩件不同的事</b>。'
  + '⚠ 算的是<b>不重複的人</b>（同一個人分三天買三筆<b>還是一個人</b>），'
  + '而且<b>10% 大股東不算進人數</b> —— 同一件申報常常掛著好幾個法人實體'
  + '（實測一件掛著七個），那會憑空變出一個「七人集群」。';
export function flowClusters(p, scopeKey, { win = 'all', minPeople = CLUSTER_MIN, limit = 12 } = {}) {
  /* ⚠ 集群<固定只看高管與董事>，不跟著範圍選擇器放寬到大股東（理由在 CLUSTER_WHY）。
       但「是不是計畫自動買的」要跟著範圍走，所以 scopeKey 還是要傳下去。 */
  const list = flowBuys(p, scopeKey, { win, role: 'any' }).filter((b) => b.rc === 'exec');
  const by = new Map();
  for (const b of list) {
    const g = by.get(b.sym) || by.set(b.sym, {
      sym: b.sym, name: b.name, cik: b.cik, sec: b.sec, secName: b.secName, secSymbol: b.secSymbol,
      v: 0, n: 0, who: new Map(), last: '', newPos: false, topUp: null,
    }).get(b.sym);
    g.v += Number(b.v) || 0;
    g.n += 1;
    const cur = g.who.get(b.who) || { who: b.who, role: b.role, v: 0, n: 0, up: null, nb: false, before: null, after: null };
    cur.v += Number(b.v) || 0;
    cur.n += 1;
    /* ⚠ 增持最大的那一筆的<買前買後股數>要一起帶著 —— 畫面要印分母（見 flowBuys 的註解）。 */
    if (b.upPct != null && (cur.up == null || b.upPct > cur.up)) {
      cur.up = b.upPct; cur.before = b.before; cur.after = b.after;
    }
    if (b.newPos) cur.nb = true;
    g.who.set(b.who, cur);
    if (String(b.filed) > g.last) g.last = String(b.filed);
    if (b.newPos) g.newPos = true;
    if (b.upPct != null && (g.topUp == null || b.upPct > g.topUp)) {
      g.topUp = b.upPct; g.topBefore = b.before; g.topAfter = b.after;
    }
  }
  const out = [];
  for (const g of by.values()) {
    const people = [...g.who.values()].sort((a, b) => b.v - a.v);
    if (people.length < minPeople) continue;
    out.push({ ...g, who: people, people: people.length });
  }
  /* 排序：<先按人數>再按金額 —— 這張榜的主詞是「有幾個人」，不是「多少錢」。 */
  out.sort((a, b) => b.people - a.people || b.v - a.v);
  return out.slice(0, limit);
}

/* ───────────── 📰 本期要點 ─────────────
   ⚠⚠ 參考站這一塊寫「最大買入 APLD +$6.7M」就結束了。這裡每一句都要<帶得出處>，
     而且<算不出來的那一句就不要出現>（不要用一句「—」佔位，那會讓人以為是 0）。 */
export function flowBrief(p, scopeKey, { win = 'all' } = {}) {
  const buys = flowBuys(p, scopeKey, { win });
  const sum = sumBuys(buys);
  const out = { win: winOf(win), sum, lines: [] };
  if (!buys.length) {
    out.lines.push({ k: 'none', label: '這一段沒有一筆自己掏錢買', name: '', v: null, s: '換成「整段」看看' });
    return out;
  }
  /* ① 最大的一家（按金額） */
  const byFirm = new Map();
  for (const b of buys) {
    const g = byFirm.get(b.sym) || byFirm.set(b.sym, { sym: b.sym, name: b.name, v: 0, n: 0, who: new Set() }).get(b.sym);
    g.v += b.v; g.n += 1; g.who.add(b.who);
  }
  const topFirm = [...byFirm.values()].sort((a, b) => b.v - a.v)[0];
  out.lines.push({
    k: 'top', label: '買進金額最大',
    sym: topFirm.sym, name: topFirm.name, v: topFirm.v,
    s: topFirm.who.size + ' 人・' + topFirm.n + ' 筆',
  });
  /* ② 最多人一起買的那一家（集群）。⚠ 沒有集群就<不要印這一行>。 */
  const cl = flowClusters(p, scopeKey, { win, limit: 1 });
  if (cl.length) {
    out.lines.push({
      k: 'cluster', label: '最多人一起買',
      sym: cl[0].sym, name: cl[0].name, v: cl[0].v,
      s: cl[0].people + ' 位高管與董事各自買',
    });
  }
  /* ③ 增持比例最大的那一筆。⚠ 要排除「算不出來」的，而且<新建倉不混進來比大小>。 */
  const ups = buys.filter((b) => b.upPct != null && b.upPct > 0).sort((a, b) => b.upPct - a.upPct);
  if (ups.length) {
    const u = ups[0];
    /* ⚠⚠ 這一格<一定要帶買之前有幾股>。實測這一段的第一名是 ATCH 一位董事
         買之前<只有 706 股>、增持 70,822% —— 只印百分比的話，那一格會變成
         「有人大舉加碼」，而實際上那跟新建倉幾乎是同一件事。 */
    out.lines.push({
      k: 'up', label: '把自己的持股加最多',
      sym: u.sym, name: u.name, v: u.v,
      s: u.who + '　增持 ' + (u.upPct * 100).toFixed(u.upPct >= 1 ? 0 : 1) + '%'
        + (u.before != null ? `（${u.before.toLocaleString()} → ${Number(u.after).toLocaleString()} 股）` : ''),
    });
  }
  /* ④ 板塊：這一段買進最多的板塊（走同一份逐筆資料，不另外存一份）。 */
  const bySec = new Map();
  for (const b of buys) bySec.set(b.secName, (bySec.get(b.secName) || 0) + b.v);
  const topSec = [...bySec.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topSec) out.lines.push({ k: 'sec', label: '買進最多的板塊', sym: null, name: topSec[0], v: topSec[1], s: '' });
  return out;
}

/* ───────────── 🔎 公司查詢 ─────────────
   ⚠ 查不到<要分兩種>：「這一段沒有這家公司的公開市場買賣」跟「沒有這家公司」
     在這一份資料裡<是同一件事>（這一份只收有買賣的公司），所以只能講前者 ——
     不可以回「查無此股」，那會被讀成「這家公司不存在」。 */
export function flowSearch(p, q, { limit = 12 } = {}) {
  const s = String(q || '').trim().toUpperCase();
  if (!s) return [];
  const hit = [];
  for (const f of p.firms || []) {
    const sym = String(f.sym || '').toUpperCase();
    const name = String(f.name || '').toUpperCase();
    let rank = -1;
    if (sym === s) rank = 0;
    else if (sym.startsWith(s)) rank = 1;
    else if (name.startsWith(s)) rank = 2;
    else if (name.includes(s)) rank = 3;
    if (rank < 0) continue;
    const pick = pickScope(f, 'real');
    hit.push({
      sym: f.sym, name: f.name, sec: f.sec || '_none', rank,
      buyV: pick.buyV, buyN: pick.buyN, sellV: pick.sellV, sellN: pick.sellN,
      planSellShare: pick.planSellShare,
    });
  }
  hit.sort((a, b) => a.rank - b.rank || b.buyV - a.buyV);
  return hit.slice(0, limit);
}
export const SEARCH_EMPTY_WHY = '這一份<b>只收這段期間有公開市場買賣的公司</b>，'
  + '所以查不到的意思是「<b>這段期間沒有它的公開市場買賣申報</b>」，'
  + '<b>不是</b>「沒有這家公司」，也<b>不是</b>「沒有內部人申報」'
  + '（配股、行權、計畫自動執行的買賣都不在這一頁）。';

/* ───────────── ✅ 自動對帳 ─────────────
   參考站寫「每日與 SEC 原件核對」，那是它最硬的一塊 —— 這裡也做，但<把方法寫出來>。
   ⚠⚠ 只有<季度資料集>那一段對帳才算得上交叉驗證：那一段是從 TSV 讀的，
     拿 SEC 官方的 Form 4 <XML 原件>用另一條程式路徑重讀，兩邊比股數、價格、代碼。
     回補那一段<本來就是從 XML 讀的>，再讀一次 XML 是<拿同一個東西跟自己比>，
     那種對帳永遠會過，等於沒測（[[learning_斷言的兩邊都不是待測對象]]）。 */
export function reconOf(p) {
  const r = (p && p.recon) || null;
  if (!r || !r.n) return null;
  return {
    n: r.n, cmp: r.cmp || 0, bad: r.bad || 0, rows: r.rows || [], unread: r.unread || 0,
    pool: r.pool || 0,
    /* 📏 「只差在捨入」<不是對不上>，但它是兩段資料真正的差別，所以要帶金額影響出去。 */
    rounded: r.rounded || 0, maxAbs: r.maxAbs || 0, maxRel: r.maxRel || 0,
    maxWhere: r.maxWhere || null, maxRelWhere: r.maxRelWhere || null,
    sumOk: r.sumOk !== false, sumBuy: r.sumBuy || null, sumFirms: r.sumFirms || null,
    ok: (r.bad || 0) === 0 && r.sumOk !== false,
  };
}

/* ⚠⚠ 這一段是<對帳自己量出來的>，不是抄文件：SEC 的季度資料集把股數與價格
     四捨五入到<小數第二位>，XML 原件是完整精度。寫在頁面上是因為它說明了
     「為什麼兩段資料的同一筆會差一點」—— 而且它解釋了<第一版的對帳為什麼報 22 份不符>。 */
export function roundWhyOf(p) {
  const r = reconOf(p);
  if (!r || !r.rounded) return null;
  r.dsFrom = (p && p.from) || '';
  r.dsTo = (p && p.src && p.src.dsTo) || '';
  const w = r.maxWhere, wr = r.maxRelWhere;
  return '📏 <b>兩段資料的精度不一樣</b>（這是對帳自己量出來的，不是抄文件）：'
    + `抽驗的 ${r.n} 份裡有 <b>${r.rounded} 份</b>，資料集與原件在<b>第三、四位小數</b>上不同 —— `
    + '<b>SEC 的季度結構化資料集把股數與每股價格四捨五入到小數第二位</b>，XML 原件是完整精度。'
    /* ⚠⚠ 絕對差與相對差<是兩筆不同的交易>，<兩個都要印> —— 只印金額那一個的話，
         「仙股被捨入 16%」這件事會整個看不到（[[learning_兩個都是真的時不要宣布贏家]]）。 */
    + (w ? `<br>・<b>金額差最多</b>的一筆是 <b>${w.sym}</b>（資料集 $${w.tsv}、原件 $${w.xml}）：`
      + `整筆差 <b>$${Number(r.maxAbs).toLocaleString()}</b>。` : '')
    + (wr ? `<br>・<b>比例差最多</b>的一筆是 <b>${wr.sym}</b>（資料集 $${wr.tsv}、原件 $${wr.xml}）：`
      + `差 <b>${(r.maxRel * 100).toFixed(1)}%</b>。⚠⚠ 這是<b>低價股</b>才會發生的事 —— `
      + '捨入到小數第二位，對一檔每股不到一分錢的股票來說<b>不是小數點後的小事</b>。' : '')
    + `<br>⚠ 影響的範圍：<b>只有季度資料集那一段</b>（這一份是 ${(r.dsFrom || '')} → ${(r.dsTo || '')}）；`
    + '逐份回補的那一段<b>讀的就是 XML 原件</b>，是完整精度。'
    + '<br>⚠ 所以對帳是<b>在資料集自己的精度上比</b>（小數第二位）：差在精度以內的算「只差在捨入」，'
    + '<b>在精度以內還差的才算對不上</b>。'
    + '⚠⚠ 為什麼要分這兩種：第一版把捨入算成對不上，40 份報了 <b>22 份不符</b> —— '
    + '那種紅燈<b>每次建檔都會亮</b>，然後真的對不上那一天<b>沒有人會注意到</b>'
    + '（[[learning_已知的壞會蓋住新的壞]]）。';
}
/* ⚠ 這裡寫「固定間隔」不是「隨機」—— 實作就是固定步長挑的，而同一張卡上
     下面那一段也寫著「抽樣是固定間隔不是隨機的」。兩句話講同一件事卻用不同的詞，
     卡片就會自己打自己臉（[[learning_同一件事的兩種說法要共用一個門檻]]）。 */
export const RECON_WHY = '建檔的時候<b>自動抽驗</b>：從季度資料集那一段<b>固定間隔抽申報</b>，'
  + '用<b>另一條程式路徑</b>（SEC 官方 Form 4 <b>XML 原件</b>，走 lib/sec.js 的解析）重讀一遍，'
  + '逐筆比<b>股數、每股價格、交易代碼</b>。'
  + '⚠⚠ 為什麼<b>只抽季度資料集那一段</b>：那一段是從 TSV 表格讀的，拿 XML 原件比才算<b>兩條路互相驗</b>；'
  + '回補那一段<b>本來就是從 XML 讀的</b>，再讀一次 XML 是<b>拿同一個東西跟自己比</b>，'
  + '那種對帳<b>永遠會過</b>，等於沒測。'
  + '⚠ 另外對一次<b>加總</b>：每一家公司的買進金額加起來，要等於最上面那個總數'
  + '（抓的是<b>聚合本身</b>寫錯，而不是來源讀錯）。';

/* ───────────── 📈 跟上一段比 ─────────────

   參考站的頭條底下寫「較上一週：買入 -88%，賣出 -90%」。那一句是有用的 ——
   「這一週 $92M」單獨看沒有意義，要知道上一週是多少才判斷得出這一週算多還算少。

   ⚠⚠ 但它<只能在資料真的涵蓋得到上一段的時候>才算得出來。
     這一份只涵蓋 30 天，所以「整段」沒有上一段可以比 ——
     那種時候要<說「沒有上一段可以比」>，不可以拿一個只涵蓋到一半的區間去比，
     那會憑空生出一個「腰斬」（[[learning_同期比大盤要先檢查資料範圍]] 的同一條）。
   ⚠ 而且只比<買進>：賣出沒有存逐筆，切不出任意區間（理由在 WIN_WHY）。 */
export function flowPrev(p, scopeKey, { win = 'all', role = 'any', minKey = 'any' } = {}) {
  const w = winOf(win);
  if (!w.days || !p || !p.from || !p.to) {
    return { ok: false, why: '「整段」<b>沒有上一段可以比</b> —— 這一份只涵蓋一個月。選「近 7 天」或「近 14 天」才比得出來。' };
  }
  const since = winFromOf(p, win);
  const prevTo = new Date(Date.parse(since + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.parse(prevTo + 'T00:00:00Z') - (w.days - 1) * 864e5).toISOString().slice(0, 10);
  if (prevFrom < p.from) {
    return {
      ok: false, prevFrom, prevTo,
      why: `上一段（${prevFrom} → ${prevTo}）<b>超出這一份涵蓋的範圍</b>（這一份從 ${p.from} 開始），`
        + '所以<b>比不出來</b>。拿一個只涵蓋到一半的區間去比，會憑空生出一個「腰斬」。',
    };
  }
  const now = sumBuys(flowBuys(p, scopeKey, { win, role, minKey }));
  const all = flowBuys(p, scopeKey, { win: 'all', role, minKey });
  const prevList = all.filter((b) => String(b.filed) >= prevFrom && String(b.filed) <= prevTo);
  const prev = sumBuys(prevList);
  /* ⚠ 上一段是 0 的時候<不要算百分比>（除以 0），講「上一段一筆都沒有」比較誠實。 */
  const pct = (a, b) => (b > 0 ? (a - b) / b : null);
  return {
    ok: true, from: since, to: p.to, prevFrom, prevTo, now, prev,
    dV: pct(now.v, prev.v), dN: pct(now.n, prev.n), dPeople: pct(now.people, prev.people),
  };
}
