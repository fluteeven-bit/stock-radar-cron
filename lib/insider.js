/* ───────────── 🕵️ 內部人買賣：把「薪酬機制」跟「他自己的意見」分開 ─────────────

   Form 4 是「董監事與高階主管」申報自家股票異動，成交後<兩個營業日>內要交 ——
   所以它是這個站上<時效最好>的基本面訊息（13F 是 111 天前的事，財報是一季前的事）。

   ⚠⚠ 但原始資料裡<絕大多數不是「他的意見」>，是薪酬流程。實測 2026-10-20：
     ・MU 的 CEO 最近一份 Form 4 有 10 筆交易，<全部>是 A（獎酬取得）／M（選擇權行使）
       ／F（扣稅交回）—— <一筆公開市場買賣都沒有>。
     ・那些 F 的「價格」是當天股價（989.04），照股數乘下去會變成「CEO 賣了一億美元」，
       <而他根本沒賣>，那是領股票要繳的稅。
     ・NOW、BE 最近四份也都沒有任何 P。
   👉 所以這張卡<大多數時候是空的>，而那是<正常>，不是壞掉。
      把空的畫成「沒有訊號」已經是一種說法了，要寫清楚「這段期間沒有人自己掏錢買」。

   ⚠⚠ 第二個坑：<一個決定會被拆成幾十筆>。實測同一天同一個人的一份申報裡，
     S 出現 30 次（價格 914.13 → 945.91 一路爬）——那是<一張 10b5-1 預定單在分批成交>，
     是<一個>決定不是 30 個。不合併的話畫面會寫「30 筆賣出」，那是假數字。

   ⚠ 第三個：<賣出幾乎沒有訊號>。節稅、分散、買房、10b5-1 預定計畫都會賣，
     而且高管的薪酬本來就是股票，不賣就無法變現。<買進>才是他自己掏現金做的決定。
     這張卡的重點是「誰自己掏錢買」，不是「誰賣了」。

   ⚠ 這裡<不預測>任何事。它報的是「公開申報文件上寫了什麼」，不是「所以會漲」。 */

/* 交易代碼。只有 P／S 是公開市場，其他都是薪酬或移轉機制。 */
export const OPEN_MARKET = new Set(['P', 'S']);
export const CODE_NOTE = {
  P: { label: '公開市場買進', kind: 'buy', why: '他自己掏現金在市場上買的' },
  S: { label: '公開市場賣出', kind: 'sell', why: '在市場上賣掉（節稅、分散、預定計畫都會賣）' },
  A: { label: '獎酬取得', kind: 'pay', why: '公司發給他的，不是他買的' },
  M: { label: '選擇權行使', kind: 'pay', why: '行使既有的選擇權，不是新掏錢買' },
  F: { label: '扣稅交回', kind: 'pay', why: '領股票要繳的稅，用股票抵—— <不是賣出>' },
  G: { label: '贈與', kind: 'move', why: '移轉，不是買賣' },
  C: { label: '轉換', kind: 'move', why: '證券轉換，不是買賣' },
  D: { label: '處分', kind: 'move', why: '非市場處分' },
  /* ⚠⚠ plan <不是一個 Form 4 代碼>，是「代碼確實是 P，但申報的附註說它是計畫自動買的」。
       放在同一張表裡，是因為「每一種 kind 都要有自己的一句話」這件事<只能有一個出處>
       （[[learning_一題四種狀態卻只寫一句話]]）。沒有任何代碼叫做 plan，
       所以 CODE_NOTE[t.code] 不會撞到它。 */
  plan: { label: '計畫自動買進', kind: 'plan', why: '員工認股計畫／事先訂好的計畫自動買的，<不是他的決定>' },
};

/* ───────────── ⚠⚠ 代碼 P 不等於「他決定要買」 ─────────────

   2026-10-22 實測 TSM：卡片寫「<24 位內部人在公開市場買進>」，而那 24 筆的附註全部寫著
     `Common Shares purchased by the administrator of the issuer's Employee Stock Purchase
      Plan ("ESPP") on behalf of the filer pursuant to terms predetermined by the issuer.`
   —— 代碼確實是 P，但那是<員工認股計畫按公司事先訂好的條件自動扣款買的>，
   <不是任何人的決定>。金額也都是零頭（144 股、68 股、60 股，同一天同一個價）。
   而內部人這一題已經是「📋 進場前檢查表」的加分題，所以這個假訊號<會讓那一題打勾>。

   根因：footnote 我們<從來沒讀過>（grep footnote 在 lib/sec.js 與 lib/insider.js 都是 0）。

   ⚠⚠ 這張表<不是完備的判準>，它只是「已知會出現的那幾種說法」。所以規則只有一條：
     <比對到才降級，沒比對到一律當成真的買進>。
     寧可漏判成真買（他點開 Form 4 自己看得到附註），<絕對不要把真的買進誤殺>。 */
export const PLAN_PATTERNS = [
  { key: 'espp', re: /employee stock purchase|\bESPP\b/i, label: '員工認股計畫（ESPP）自動買的' },
  { key: 'drip', re: /dividend reinvest|reinvestment of dividend|\bDRIP\b/i, label: '股利再投資（配到的股利自動買回股票）' },
  { key: 'retire', re: /401\(k\)|\bsavings plan\b|\bthrift plan\b/i, label: '退休／儲蓄計畫（401(k)）自動買的' },
  { key: 'payroll', re: /payroll deduction/i, label: '薪資扣款自動買的' },
  { key: 'r10b51', re: /10b5-?1/i, label: '事先排定的交易計畫（Rule 10b5-1）買的' },
  { key: 'predetermined', re: /pre-?determined/i, label: '買進條件是公司事先訂好的' },
  { key: 'automatic', re: /automatic/i, label: '自動買進（不是當下決定的）' },
];
/* 申報書上那個勾選格（aff10b5One）＝這份申報裡有 Rule 10b5-1 預定計畫的交易。
   ⚠ 它是<整份申報>的旗標，不是某一筆的，所以比對到的話整份都算計畫買進。 */
export const AFF_10B5_1 = { key: 'aff10b5One', re: null, label: '申報書上勾了 Rule 10b5-1 預定計畫' };

/* 這一筆是「計畫自動買的」還是「他自己決定買的」。
   ⚠ 比對到回一個物件（裡面是比對到哪幾條），沒比對到回 null ——
     null 的意思是「<就當成真的買進>」，不是「不知道」。 */
export function planFlagOf(t) {
  if (!t) return null;
  const notes = Array.isArray(t.footnotes) ? t.footnotes : [];
  const text = [...notes, t.nature || ''].join('\n');
  const hits = text ? PLAN_PATTERNS.filter((p) => p.re.test(text)) : [];
  if (t.aff10b5One) hits.push(AFF_10B5_1);
  if (!hits.length) return null;
  /* 表是照<具體程度>排的，所以第一條就是最該講的那一句（ESPP 比「automatic」具體）。 */
  return { keys: [...new Set(hits.map((h) => h.key))], label: hits[0].label, labels: [...new Set(hits.map((h) => h.label))] };
}

/* 這一筆到底算哪一類。<同一個判斷只能有一份實作>，畫面與檢查表都讀 collapse 寫進去的 kind。 */
export function tradeKind(t) {
  const note = t && CODE_NOTE[t.code];
  if (!note) return null;
  return note.kind === 'buy' && planFlagOf(t) ? 'plan' : note.kind;
}

/* 這個人是誰。CEO／CFO 自己掏錢買，跟某個副總買，份量不一樣。 */
export function roleOf({ title = '', isDirector = false, isOfficer = false, isTenPercent = false } = {}) {
  const t = String(title || '').toLowerCase();
  if (/chief executive|(^|\W)ceo(\W|$)/.test(t)) return { key: 'ceo', label: '執行長', weight: 3 };
  if (/chief financial|(^|\W)cfo(\W|$)/.test(t)) return { key: 'cfo', label: '財務長', weight: 3 };
  if (/chair/.test(t)) return { key: 'chair', label: '董事長', weight: 3 };
  if (/president/.test(t)) return { key: 'pres', label: '總裁', weight: 2 };
  if (/chief|officer|evp|svp|vp\b/.test(t) || isOfficer) return { key: 'officer', label: title.trim() || '高階主管', weight: 2 };
  if (isDirector) return { key: 'director', label: '董事', weight: 2 };
  if (isTenPercent) return { key: 'owner10', label: '10% 大股東', weight: 1 };
  return { key: 'other', label: title.trim() || '內部人', weight: 1 };
}

/* ⚠⚠ 一個決定會被拆成幾十筆（10b5-1 分批成交）。
   合併鍵＝<同一份申報 ＋ 同一個人 ＋ 同一天 ＋ 同一個代碼 ＋ 同一種附註>。
   股數相加、價格用<成交量加權>（不是算術平均，大單小單權重不同）。
   ⚠ 附註也要進鍵：同一個人同一天可能既有 ESPP 自動買的零頭、也有自己下單買的，
     不分開就會把一筆真買跟一堆 ESPP 黏成一筆，然後整筆的性質變成由先來的那一筆決定。 */
export function collapse(trades = []) {
  const by = new Map();
  for (const t of trades) {
    if (!t || !(Number(t.shares) > 0)) continue;
    /* ⚠ 分類<只有一份實作>（tradeKind），這裡不要自己再判一次
         （[[learning_測試自己抄一份判斷邏輯]]）。 */
    const plan = planFlagOf(t);
    const kind = tradeKind(t);
    const k = `${t.accession || ''}|${t.owner || ''}|${t.date || ''}|${t.code || ''}|${plan ? plan.keys.join(',') : ''}`;
    const cur = by.get(k);
    const shares = Number(t.shares);
    const price = Number(t.price) > 0 ? Number(t.price) : null;
    if (!cur) {
      by.set(k, { ...t, plan, kind, shares, price, parts: 1, _pv: price ? price * shares : 0, _pw: price ? shares : 0 });
    } else {
      cur.shares += shares;
      cur.parts += 1;
      if (price) { cur._pv += price * shares; cur._pw += shares; }
      // 交易後持股取<最後一筆>（它才是這一連串做完之後的真實剩餘）
      if (t.after != null) cur.after = t.after;
    }
  }
  return [...by.values()].map((x) => {
    const price = x._pw > 0 ? x._pv / x._pw : null;
    const { _pv, _pw, ...rest } = x;
    return { ...rest, price, value: price ? price * x.shares : null };
  });
}

/* 他這一筆<把自己的持股動了幾成>。
   ⚠ 這比金額有意義得多：20 萬美元對 CEO 可能是零頭，但「把自己的持股加了四成」不是。
   ⚠ 算不出來就回 null，<不要用 0 頂替>（0 的意思是「沒變」，那是另一件事）。 */
export function stakeMove(t) {
  const after = Number(t && t.after);
  const shares = Number(t && t.shares);
  if (!(after > 0) || !(shares > 0)) return null;
  const before = t.buy ? after - shares : after + shares;
  /* ⚠⚠ before <b>小於</b> 0 跟 before <b>等於</b> 0 是兩件完全不同的事，第一版把它們混在一起：
       `before === 0` ＝ 他<新建倉>（買之前一股都沒有），那是個<結論>。
       `before < 0`  ＝ 交易後持股<比這一筆買的還少>，那在算術上不可能 ——
         實測成因：同一份申報裡<直接持有與間接持有各一列>（例如本人名下買 1000 股、
         信託名下買 50,000 股），而合併鍵是「申報＋人＋日期＋代碼＋附註」，
         所以兩列會<合成一筆>（股數相加＝51,000），但「交易後持股」取的是<最後一列>的
         那個持有形式（50,000）—— 51,000 > 50,000，before 就變成負的。
         這種情況是<算不出來>，<不是>「新建倉」。回 firstBuy 的話，畫面會對一位
         持股多年的董事印出「新建倉」，那是<一句假話>。
     👉 所以：before < 0 回 null（算不出來），before === 0 才是新建倉
        （[[learning_算不出來和算出來是否定的是兩回事]]）。 */
  if (before < 0) return null;
  if (before === 0) return t.buy ? { pct: null, firstBuy: true } : null;
  return { pct: (t.buy ? shares : -shares) / before, firstBuy: false };
}
/* ⚠ 「交易後持股」指的是<這份申報上那一個持有形式>的持股（直接／某個信託／配偶名下），
     <不是>他在這家公司的全部持股。所以「增持 12%」要讀成「他申報的那個戶頭加了 12%」。
     這句話<要印在畫面上>，不印的話那個百分比會被當成「他的總持股變化」。 */
export const STAKE_WHY = '「<b>增持 ％</b>」＝這一筆買的股數 ÷ 買之前的持股，'
  + '出處是申報書上的「<b>交易後持股</b>」欄。'
  + '⚠ 它指的是<b>這份申報上那一個持有形式</b>的持股（本人直接持有、或某一個信託、配偶名下），'
  + '<b>不是他在這家公司的全部持股</b> —— 同一個人用別的形式持有的部分不在這個分母裡。'
  + '⚠ 買之前<b>一股都沒有</b>才叫「<b>新建倉</b>」；'
  + '欄位沒填、或兩種持有形式合在一筆算出矛盾的數字時，印「<b>算不出來</b>」，'
  + '<b>不會</b>當成新建倉（那會對一位持股多年的董事印出假話）。';

export const INSIDER_TRUTH = '這張卡報的是<b>公開申報文件上寫了什麼</b>，不是「所以會漲」。'
  + '內部人<b>買進</b>是他自己掏現金做的決定；<b>賣出</b>幾乎沒有訊號'
  + '（節稅、分散、買房、事先排定的賣出計畫都會賣，而高管的薪酬本來就是股票，不賣就無法變現）。';

/* ⚠⚠ 這一句一定要印在卡上。不印的話，使用者沒辦法知道「24 筆 P」為什麼只剩 0 筆買進。 */
export const INSIDER_PLAN_TRUTH = '⚠ 代碼 <b>P（公開市場買進）不等於「他決定要買」</b>：'
  + '員工認股計畫（ESPP）、股利再投資、Rule 10b5-1 事先排定的計畫都是用 P 申報的，'
  + '那些是<b>按事先訂好的條件自動買的，不是他的意見</b>。'
  + '站上會<b>讀申報的附註</b>把這一種分出來，<b>不算進「自己掏錢買」</b>。'
  + '附註沒提到計畫的，<b>一律當成真的買進</b>（寧可漏判，不要把真的買進誤殺）。';

export const INSIDER_EMPTY_TRUTH = '<b>大多數公司、大多數時候都是空的</b> —— 公開市場買進本來就很少見。'
  + '空白<b>不是</b>「沒有人看好」，是「這段期間沒有人自己掏錢買，也沒有人在公開市場賣」。';

/* ───────────── 🔭 這一份掃描：為什麼只掃他關心的那幾檔 ─────────────

   ⚠⚠ 2026-10-20 這裡原本寫著一句<錯話>，而且那句錯話<印在網站上>：
     「每日索引只索引申報的那個人、不索引發行公司（實測一天 912 份、0 份重複）」。
     2026-10-22 重新量過，<兩個數字都是量錯東西量出來的>：

       form.20261016.idx：Form 4 <912 列>，但不重複的 accession 只有 <450 件>。
       同一件 `0000921895-26-002832` 出現 <7 次>：<發行公司> El Pollo Loco Holdings 一列，
       每個申報人（Biglari Capital、SARDAR BIGLARI、LION FUND II…）各一列。
       抽驗那一列的 CIK 1606366 → `entityType: operating`、`tickers: ["LOCO"]`。

     當初為什麼會量成「0 份重複」：把「<列>數」當成「<份>數」，
     而且<重複的判準拿 CIK 或公司名去比>。同一件裡每一列的 CIK 與公司名本來就都不一樣
     （實測 450 件裡「同一件內有重複 CIK」的 0 件），<所以怎麼比都是 0>。
     只有 accession 收得起來（[[learning_檢查存在不等於檢查對不對]]）。

   👉 所以<全市場版是做得起來的>，已經做了，在 <b>#/flow</b>（🕵️ 全市場內部人動向）。
      真正難的地方也不是索引，是<每日索引不含交易代碼>（不知道誰買誰賣），要逐份打開；
      而那一頁走的是 SEC <官方的 Form 345 季度結構化資料集>＋最近幾週逐份回補。

   這一份（首頁那張卡）<仍然只掃他關心的那幾檔>，理由跟上面無關：
   它要的是<即時>（今天的申報今天就看到），而逐份打開幾千份沒辦法即時。 */
/* ⚠⚠ 這句話<跟著掃描範圍一起改>。範圍已經從「只有持有的」擴成
     「持有的 ＋ 你打開過個股頁的」，這句還寫「只掃你關注的那幾檔」的話，
     同一張卡上面列著 GME、下面寫著「只掃你關注的」—— <卡片自己打自己臉>
     （[[learning_同一件事的兩種說法要共用一個門檻]]）。 */
export const SCAN_SCOPE_TRUTH = '這一份掃的是<b>你持有的</b>加上<b>你打開過個股頁的</b>那幾檔，<b>不是全市場</b>。'
  + '這樣做是為了<b>即時</b> —— 今天送出的申報，今天就在這張卡上。'
  + '要看<b>全市場</b>最近一個月誰在買，上面導覽列的 <a href="#/flow">🕵️ 內部人</a> 那一頁有。';

/* ───────────── 判讀 ─────────────
   ⚠ 五種處境要說五句不同的話，不可以共用一句（[[learning_一題四種狀態卻只寫一句話]]）。 */
export function insiderSummary(rawTrades = [], { days = 180, today = null, failed = 0, tried = 0 } = {}) {
  const all = collapse(rawTrades);
  const since = today ? new Date(Date.parse(today) - days * 864e5).toISOString().slice(0, 10) : null;
  const inWin = all.filter((t) => !since || !t.date || t.date >= since);

  /* ⚠⚠ 一律看 collapse 算好的 kind，不要自己用 code 再判一次 ——
       代碼是 P 但附註說是 ESPP／預定計畫的那些是 plan，<不算「自己掏錢買」>。 */
  const buys = inWin.filter((t) => t.kind === 'buy');
  const plans = inWin.filter((t) => t.kind === 'plan');
  const sells = inWin.filter((t) => t.kind === 'sell');
  const pay = inWin.filter((t) => t.kind === 'pay');

  const sum = (a, k) => a.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const peopleOf = (a) => new Set(a.map((x) => x.owner).filter(Boolean)).size;
  const buyers = peopleOf(buys);
  const withRole = (a) => a.map((t) => ({ ...t, role: roleOf(t), move: stakeMove(t) }));
  const buyRows = withRole(buys).sort((a, b) => (b.value || 0) - (a.value || 0));
  const sellRows = withRole(sells).sort((a, b) => (b.value || 0) - (a.value || 0));
  const planRows = withRole(plans).sort((a, b) => (b.shares || 0) - (a.shares || 0));
  /* 計畫買進要講<是哪一種計畫>（ESPP 跟 10b5-1 不是同一件事）。 */
  const planWhat = [...new Set(planRows.flatMap((t) => (t.plan && t.plan.labels) || []))];

  const bigShot = buyRows.find((r) => r.role.weight >= 3) || null;
  const biggest = buyRows[0] || null;
  /* ⚠ 「一群人一起買」要<至少兩個不同的人>。同一個人分兩次買不是 cluster。 */
  const cluster = buyers >= 2;

  const why = [];
  let tone = 'neutral', label = '這段期間沒有公開市場買賣';
  if (buys.length) {
    tone = 'bull';
    label = cluster ? `${buyers} 位內部人在公開市場買進` : '有內部人在公開市場買進';
    /* ⚠ 這一句<一定要有>。下面幾條都是加分項（大咖／一群人／加碼幅度），
         三個都不成立時 why 會是空的 —— 一個有結論卻給不出理由的狀態
         （[[learning_一題四種狀態卻只寫一句話]]）。而「他自己掏現金買」本身
         就是這張卡最重要的那句話，不該只在有加分項時才說。 */
    why.push(`公開市場買進＝<b>他自己掏現金</b>在市場上買的，不是公司發給他的`);
    if (bigShot) why.push(`<b>${bigShot.role.label}</b>親自買了 —— 掏的是自己的現金，不是公司發的`);
    if (cluster) why.push(`<b>${buyers} 個不同的人</b>在這段期間各自買進，不是同一個人分批`);
    const m = biggest && biggest.move;
    if (m && m.firstBuy) why.push('這是他<b>第一次</b>持有這家公司的股票');
    else if (m && m.pct != null && m.pct >= 0.1) why.push(`最大那一筆<b>把他自己的持股加了 ${(m.pct * 100).toFixed(0)}%</b>（比金額有意義：金額對高管可能是零頭）`);
    if (plans.length) why.push(`⚠ 另外有 ${plans.length} 筆代碼也是 P，但申報的附註說那是<b>${planWhat[0]}</b> —— <b>沒有算進上面的買進</b>`);
    if (sells.length) why.push(`⚠ 同一段期間也有 ${peopleOf(sells)} 個人在賣 —— <b>兩邊都要看</b>`);
  } else if (plans.length) {
    /* ⚠⚠ 這一種<最危險>：代碼是 P，不擋的話畫面會寫「24 位內部人在公開市場買進」，
         而那 24 個人沒有一個做過任何決定（實測 TSM 2026-10）。 */
    tone = 'neutral';
    label = `只有計畫自動買進（${peopleOf(plans)} 人）`;
    why.push(`這 ${plans.length} 筆的代碼<b>確實是 P（公開市場買進）</b>，但申報的附註寫著<b>${planWhat.join('、')}</b>`);
    why.push('那是<b>按事先訂好的條件自動買的，不是任何人當下的決定</b> —— 所以<b>不算「有人自己掏錢買」</b>，這一題也不會打勾');
    why.push('真正要看的是有沒有人<b>自己決定</b>在市場上掏現金買，而這段期間<b>沒有</b>');
    if (sells.length) why.push(`⚠ 同一段期間有 ${peopleOf(sells)} 個人在賣 —— <b>兩邊都要看</b>`);
  } else if (sells.length) {
    tone = 'neutral';
    label = `只有賣出（${peopleOf(sells)} 人）`;
    why.push('<b>賣出幾乎沒有訊號</b>：節稅、分散、事先排定的計畫都會賣，而高管的薪酬本來就是股票');
    why.push('真正值得看的是<b>有沒有人自己掏錢買</b>，而這段期間<b>沒有</b>');
  } else if (pay.length) {
    label = '只有薪酬相關的異動';
    why.push(`${pay.length} 筆都是<b>獎酬取得／選擇權行使／扣稅交回</b> —— 那是薪酬流程，<b>不是他的意見</b>`);
    why.push('沒有人自己掏錢買，也沒有人在公開市場賣');
  } else {
    label = '這段期間沒有任何申報';
    why.push('不是「沒有人看好」，是<b>這段期間沒有內部人異動需要申報</b>');
  }

  /* ⚠⚠ 讀不到 ≠ 沒有。
     實測 2026-10-20：跨股票掃描時對 SEC 打太快、文件全被擋，
     畫面就寫「這段期間沒有任何申報」—— 而申報有 39 份，是我們讀不到。
     只要有任何一份沒讀到，上面那個結論就<不是全稱命題>，必須當場說破；
     全部讀不到的話，結論整個作廢。 */
  const unread = Math.max(0, Number(failed) || 0);
  if (unread > 0) {
    if (unread >= (Number(tried) || 0) && !inWin.length) {
      tone = 'unknown';
      label = '這次讀不到（不是沒有）';
      why.length = 0;
      why.push(`${unread} 份申報<b>一份都沒讀到</b>（多半是上游擋太快）—— <b>這不代表沒有人在買</b>，只代表這一刻問不到`);
    } else {
      why.push(`⚠ 這次有 <b>${unread} 份讀不到</b>，所以上面說的是「<b>讀到的那幾份裡</b>」，不是全部`);
    }
  }

  return {
    tone, label, why,
    days,
    buyers, sellers: peopleOf(sells), cluster, bigShot: bigShot ? bigShot.role.label : null,
    buyCount: buys.length, sellCount: sells.length, payCount: pay.length,
    buyShares: sum(buys, 'shares'), sellShares: sum(sells, 'shares'),
    buyValue: sum(buys, 'value'), sellValue: sum(sells, 'value'),
    netValue: sum(buys, 'value') - sum(sells, 'value'),
    /* 🧾 計畫自動買進（ESPP／10b5-1／股利再投資…）：<跟買進完全分開>的一組數字。
       ⚠ 混進 buyCount 的那一刻，TSM 就會變成「24 位內部人在公開市場買進」。 */
    planCount: plans.length, planPeople: peopleOf(plans),
    planShares: sum(plans, 'shares'), planValue: sum(plans, 'value'),
    planWhat, plans: planRows.slice(0, 4),
    buys: buyRows.slice(0, 6), sells: sellRows.slice(0, 4),
    // ⚠ 把被合併掉的筆數留著：畫面要講「一張分批成交的單」而不是「30 筆」
    collapsedFrom: rawTrades.length, collapsedTo: all.length,
    // ⚠ 讀不到幾份要帶出去，畫面與掃描都要講
    failed: unread, tried: Number(tried) || 0, partial: unread > 0,
    /* ⚠ 有計畫買進的時候<不算空的>：那一行有東西可講（而且要講它不算買進）。 */
    empty: !buys.length && !sells.length && !plans.length,
  };
}

/* ───────────── 🔔 新的「自己掏錢買」要主動找上他 ─────────────

   這張卡原本<只有打開網頁才看得到>（grep 內部人 在 lib/solo.js 與 lib/tonight.js 都是 0），
   而站上<唯一會主動找他的東西>是睡前那一則推播。
   公開市場買進很稀有（實測他那五檔的底層近 180 天<一筆都沒有>），
   所以接進推播<不會變成噪音>：一季不見得響一次，響的時候是真的有事。

   ⚠⚠ 整件事最難的是<去重>，而難的原因很具體：
     沒有雲端存放區，唯一的紀錄是 ntfy 自己發過的訊息，而 ntfy 免費版<只留 12 小時>。
     所以「這一筆有沒有叫過」<記不住超過半天>。既有的提醒靠「鍵裡含日期」解決
     （同一天只叫一次、隔天再叫一次），但<內部人買進不可以隔天再叫> ——
     同一筆買進連叫五天，等於把一個真訊號變成噪音。

   👉 做法：<不要去記「叫過了沒」，改成讓「該叫」這件事一天只成立一次>。
      每一份申報都有一個申報日 `filed`。睡前那一則<每個平日發一次>，所以把日期軸
      照「上一個平日」切開：
        這一趟要看的＝ <上一個平日 ≦ 申報日 < 今天>
      相鄰兩天的窗口<完全不重疊>（星期二看星期一、星期三看星期二；
      星期一看星期五六日），所以每一份申報<只會落在恰好一天的窗口裡>。
      ntfy 那 12 小時的紀錄仍然有用 —— 它擋的是<同一天跑兩趟>
      （Cloudflare 主力 ＋ GitHub 備援晚 2～7 小時）。

   ⚠ 代價要講清楚：申報當天<不會>叫，隔天早上那一則才會（Form 4 本身就是 T+2 的東西）。
     而且<睡前那一則整天沒跑的那一天>，那天的窗口就過去了。寧可這樣，也不要連叫五天。
   ⚠⚠ 週末那一趟（?brief=1 強制）<不判斷>：星期六的窗口是「星期五」，
     而星期一的窗口是「星期五六日」—— <重疊>，同一筆會叫兩次。 */

const dayShift = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const isDay = (x) => /^\d{4}-\d{2}-\d{2}$/.test(String(x || ''));
export const isWeekendDay = (iso) => {
  if (!isDay(iso)) return false;
  const d = new Date(Date.parse(iso + 'T00:00:00Z')).getUTCDay();
  return d === 0 || d === 6;
};

/* 上一次「睡前那一則」是哪一天＝往前數到的第一個平日。
   ⚠ 美股假日照樣算一天：runSolo 只跳過週末，不跳過假日，所以「平日」才是對的刻度。 */
export function prevBriefDay(todayISO) {
  if (!isDay(todayISO)) return null;
  let d = dayShift(todayISO, -1);
  for (let i = 0; i < 7 && isWeekendDay(d); i++) d = dayShift(d, -1);
  return d;
}

/* 這一份申報是不是「上一則睡前通知之後才出現的」。
   ⚠ 用<申報日>不是交易日（交易日早兩天以上，拿它判斷會永遠判成舊的）。 */
export function isFreshFiling(filed, todayISO) {
  const prev = prevBriefDay(todayISO);
  if (!prev || !isDay(filed)) return false;
  return filed >= prev && filed < todayISO;
}

const nInt = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
const grp = (a) => Math.round(a).toLocaleString('en-US');

/* 一筆買進怎麼寫成一句話。
   ⚠⚠ 這裡<一個字都不可以預測> —— 只寫申報文件上有的：誰、什麼職位、幾股、多少錢、
     占他自己持股幾成。也<不講「淨買超」>（拿一個沒訊號的數字去扣一個有訊號的，
     得到的是沒有意義的數字）。 */
export function buyLineOf(t) {
  if (!t) return '';
  const role = t.role && t.role.label ? `（${t.role.label}）` : '';
  const sh = nInt(t.shares) > 0 ? `${grp(t.shares)} 股` : '持股';
  const val = nInt(t.value) > 0 ? `＝$${grp(t.value)}` : '';
  const px = nInt(t.price) > 0 ? `・每股約 $${Number(t.price).toFixed(2)}` : '';
  const parts = nInt(t.parts) > 1 ? `（一張單分 ${nInt(t.parts)} 筆成交）` : '';
  const after = nInt(t.after) > 0 ? `\n　買完他自己持有 ${grp(t.after)} 股` : '';
  const move = t.move && t.move.firstBuy ? '，這是他第一次持有這家公司的股票'
    : t.move && t.move.pct != null ? `，這一筆把他自己的持股加了 ${(t.move.pct * 100).toFixed(0)}%` : '';
  return `${t.date || '日期不明'} ${t.owner || '內部人'}${role}\n　買進 ${sh}${val}${px}${parts}${after}${move}`;
}

export const PUSH_TRUTH = '這是公開申報文件上寫的事實，不是「所以會漲」。'
  + '附註沒有提到員工認股計畫（ESPP）或事先排定的計畫，所以當成他自己決定掏錢買的。';

/* ───────────── 睡前那一則要怎麼講這一檔的內部人 ─────────────

   ⚠⚠ 七種處境<各寫各的一句話>，不可以共用（[[learning_一題四種狀態卻只寫一句話]]）：
     new      有新的自己掏錢買          → 另外發一則，睡前那一則也提一句
     old      有買進但不是新的          → 只報告，不發第二則
     none     這段期間沒有人自己掏錢買   → <這是常態，要明講不是看壞>
     plan     只有計畫自動買進          → <不算有人掏錢買>，而且要說是哪一種計畫
     unread   讀不到                   → ⚠ <絕對不可以靜悄悄當成「沒有人買」>
     missing  這一趟沒掃到這一檔         → 同上，但原因不同
     na       這一檔本來就沒有 SEC 資料  → 不適用，不是壞掉
   ⚠ 另外 `partial`（有幾份讀不到但不是全部）要<附加>在句子後面，
     不然「沒有人買」會被當成全稱命題。 */
/* ⚠⚠ 這些句子是<給推播用的純文字>，所以<一個角括號都不可以有>。
     站上的註解慣例 `<強調>` 剛好長得像 HTML 標籤，而 briefOf 會先 strip 掉標籤 ——
     2026-10-22 實測：「這<不是>『沒有人買』」被 strip 之後變成「這『沒有人買』」，
     <意思完全相反>，而且那正好是最需要說實話的那一刻（上游被擋）。
     要強調就用「」。這一條有測試守著（strip 過之後整句還要在）。 */
export function insiderPushOf({ symbol, row, scan, todayISO, weekend = false } = {}) {
  const sym = String(symbol || '').toUpperCase();
  const none = (state, line) => ({ state, line, fresh: [], alerts: [] });
  /* 週末強制跑的那一趟不判斷（窗口會跟星期一重疊 → 同一筆叫兩次）。
     ⚠ 這一條要排<最前面>：連「讀不到」都不講，因為週末本來就不該有新的申報。 */
  if (weekend || isWeekendDay(todayISO)) return none('off', null);
  if (!isDay(todayISO)) return none('off', null);

  if (scan && scan.ok === false) {
    return none('unread', `⚠ 🕵️ 內部人申報：這次「讀不到」（${scan.err || '問不到'}）—— 這不是「沒有人買」，是這一刻問不到`);
  }
  if (!row) return none('missing', '⚠ 🕵️ 內部人申報：這一趟「沒掃到這一檔」—— 這不是「沒有人買」');
  if (row.ok === false) {
    return row.na
      ? none('na', `🕵️ 內部人申報：${sym} 查不到 SEC 的內部人資料，這一項不適用`)
      : none('unread', `⚠ 🕵️ 內部人申報：這次「讀不到」（${row.why || '問不到'}）—— 這不是「沒有人買」`);
  }

  const target = String(row.target || (row.via && row.via.under) || sym).toUpperCase();
  const who = target === sym ? sym : `${target}（你的 ${sym} 追蹤的那一檔）`;
  const days = nInt(row.days) || 180;
  const failed = nInt(row.failed);
  const tail = failed > 0 ? `（⚠ 其中 ${failed} 份讀不到，所以這是「讀到的那幾份裡」）` : '';
  const scope = `看了 ${nInt(row.scanned)}／${nInt(row.scannedOf)} 份申報`;

  // 全部讀不到：結論整個作廢（insiderSummary 已經把 tone 改成 unknown）
  if (row.tone === 'unknown') {
    return none('unread', `⚠ 🕵️ 內部人申報：${who} 這次「一份都沒讀到」（多半是上游擋太快）—— 這不是「沒有人買」`);
  }

  /* ⚠⚠ 第二道鎖：kind === 'plan' 的<絕對不可以推播>。代碼雖然是 P，但那是 ESPP／
       10b5-1 按事先訂好的條件自動買的，推出去就是把員工每月扣款講成「內部人在買」。
       上游（insiderSummary.buys）本來就只放 kind==='buy'，這裡再擋一次 ——
       哪天那邊改了，不會安靜地變成假推播。 */
  const buys = (Array.isArray(row.buys) ? row.buys : []).filter((t) => t && t.kind !== 'plan');
  const fresh = buys.filter((t) => isFreshFiling(t.filed, todayISO));

  if (fresh.length) {
    /* 同一份申報、同一個人合成一則（一個人同一份裡分兩天買是<一個>決定的兩筆）。
       ⚠ 去重鍵<刻意不含日期>：它的意思是「這一份申報的這個人已經通知過了」。
         含日期的話，萬一窗口判斷有誤就會變成「保證每天重發一次」。 */
    const by = new Map();
    for (const t of fresh) {
      const k = `${t.accession || ''}|${t.owner || ''}`;
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(t);
    }
    const alerts = [...by.entries()].map(([k, ts]) => {
      const lead = ts[0];
      const role = lead.role && lead.role.label ? `${lead.role.label}` : '內部人';
      return {
        kind: 'insiderBuy', side: 'bull',
        key: `solo|${sym}|ins|${k}`,
        title: `${sym}｜${target} 有人自己掏錢買（${role}）`,
        body: [
          `${who} 的內部人申報（Form 4）`,
          ...ts.map(buyLineOf),
          '',
          PUSH_TRUTH,
          `⚠ ${scope}${failed > 0 ? `，其中 ${failed} 份讀不到` : ''}。這是「有沒有人自己掏錢買」，不是買賣淨額。`,
        ].join('\n'),
      };
    });
    const people = new Set(fresh.map((t) => t.owner).filter(Boolean)).size || fresh.length;
    return {
      state: 'new', fresh, alerts,
      line: `🕵️ 內部人申報：${who} 有 ${people} 位「自己掏錢買」，明細另外一則通知${tail}`,
    };
  }

  if (buys.length) {
    return none('old', `🕵️ 內部人申報：${who} 這 ${days} 天有 ${buys.length} 筆公開市場買進，沒有新的${tail}`);
  }
  if (nInt(row.planCount) > 0) {
    const what = (Array.isArray(row.planWhat) ? row.planWhat : [])[0] || '事先訂好的計畫';
    return none('plan', `🕵️ 內部人申報：${who} 只有「計畫自動買進」（${nInt(row.planPeople)} 人・${what}）—— 那不算有人自己掏錢買${tail}`);
  }
  return none('none', `🕵️ 內部人申報：${who} 這 ${days} 天沒有人自己掏錢買（這是常態，不是看壞；${scope}）${tail}`);
}
