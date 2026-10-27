/* ───────────── 🔔 集群買入推播：規則 ─────────────

   「同一家公司<好幾位高管或董事各自掏錢買>」這件事發生的那一天，推播給他。

   ⚠⚠ 這個檔<只放規則>，不碰網路、不發推播。原因有兩個：
     ① 排程跑在 GitHub Actions（它<從網站上把這幾支 lib 抓下來>再跑），
        判斷留在這裡就只有<一份實作>——排程那邊只負責 I/O（鐵律⑥）。
     ② 規則是純函式，離線測試才測得到。

   ⚠⚠ <不要記「發過了沒」>。規則寫成「窗內不重複人數<今天第一次>達到門檻」——
     「今天達到、昨天還沒達到」這件事<一天只成立一次>，所以根本不需要去重紀錄
     （[[learning_記不住超過半天的去重]]：不要記「叫過了沒」，要讓「該叫」一天只成立一次）。
     ⚠ 代價：集群如果整個滑出窗外之後又重新形成，會再響一次。那是<另一個事件>，響得對。

   ⚠⚠ 門檻（7 天窗、4 位）是照<發送頻率>訂的，<不是>照「有沒有用」訂的 ——
     實測 2026-09-28 → 10-26 的 21 個平日：
       2 位 → 19/21 天會響（等於每天吵）
       3 位 → 12/21 天
       <4 位 → 7/21 天、10 家次（約每 3 個平日一次）>
       5 位 → 7/21 天、7 家次
     7 天窗與 14 天窗在 4 位這個門檻下<結果一樣>（都是 10 家次），所以取 7 天 —— 少抓一半的申報。
   ⚠⚠ 「這個訊號後來會不會漲」<還沒有量>。所以推播的文字只講<發生了什麼事>，
     <不講>「所以可以買」（[[learning_照金額排會答錯問題]] 的同一條：
     卡片上、推播上只要寫了比較級或結論，那就是一個必須先量的主張）。 */

/* 預設值。⚠ 排程那邊可以用環境變數覆蓋，但<預設只有一份>，在這裡。 */
export const ALERT = { WIN: 7, MIN_PEOPLE: 4, MAX_LIST: 6 };

/* 一天的判定。
   `buys` 的形狀跟 lib/insider-flow.js 的 flowBuys 回傳的一樣
   （sym/name/who/role/rc/filed/v/sh/px/acc/upPct/newPos），所以網站與排程<看的是同一種東西>。
   ⚠ 只收<高管與董事>（rc === 'exec'）：同一件申報常常掛著好幾個法人實體，
     10% 大股東算進去會憑空變出一個「七人集群」。 */
export function clusterAlerts(buys = [], { day, win = ALERT.WIN, minPeople = ALERT.MIN_PEOPLE } = {}) {
  if (!day) return [];
  const since = new Date(Date.parse(`${day}T00:00:00Z`) - (win - 1) * 864e5).toISOString().slice(0, 10);
  const by = new Map();
  for (const b of buys) {
    if (!b || b.rc !== 'exec') continue;
    const f = String(b.filed || '');
    if (f < since || f > day) continue;
    if (!by.has(b.sym)) by.set(b.sym, []);
    by.get(b.sym).push(b);
  }
  const out = [];
  for (const [sym, list] of by) {
    const who = new Set(list.map((b) => b.who));
    /* ⚠⚠ 「今天之前」要用<同一個窗>算，不是用全部歷史：
         窗是滾動的，拿全部歷史算的話，一位三個月前買過的人會讓 before 永遠達標，
         然後這一家<永遠不會響>。 */
    const before = new Set(list.filter((b) => String(b.filed) < day).map((b) => b.who));
    if (who.size < minPeople || before.size >= minPeople) continue;
    const todays = list.filter((b) => String(b.filed) === day);
    const fresh = [...new Set(todays.map((b) => b.who))].filter((w) => !before.has(w));
    const people = [...who];
    let topUp = null, newPos = false, v = 0;
    for (const b of list) {
      v += Number(b.v) || 0;
      if (b.upPct != null && (topUp == null || b.upPct > topUp)) topUp = b.upPct;
      if (b.newPos) newPos = true;
    }
    out.push({
      sym, name: list[0].name || sym, people: who.size, names: people,
      /* 今天<新加入>的那幾位（讓他知道這一則是為什麼現在響）。 */
      fresh, freshN: fresh.length, v, topUp, newPos,
      since, day, n: list.length,
      roles: [...new Set(list.map((b) => b.role))].slice(0, 4),
    });
  }
  /* 先按人數、再按金額 —— 這張榜的主詞是「有幾個人」。 */
  out.sort((a, b) => b.people - a.people || b.v - a.v);
  return out;
}

const money = (v) => {
  const a = Math.abs(Number(v) || 0);
  if (a >= 1e6) return `$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${Math.round(a / 1e3)}K`;
  return `$${Math.round(a)}`;
};

/* 推播的文字。⚠ 四種處境<各寫各的>，不要共用一句話
   （[[learning_一題四種狀態卻只寫一句話]]）：
     none   今天沒有達標的      → 回 null，<不發>（沒事就不要響）
     one    一家                → 標題寫那一家，點進去是它的個股頁（即時的）
     many   好幾家              → 標題寫幾家，內文逐家列，點進去是第一家
     capped 多到列不完          → 列前 MAX_LIST 家，而且<說還有幾家>，不要靜悄悄截斷 */
export function alertMessage(fires = [], { day, base = 'https://evan-stock-radar.vercel.app', win = ALERT.WIN, minPeople = ALERT.MIN_PEOPLE } = {}) {
  if (!fires.length) return null;
  const line = (f) => {
    const bits = [`${f.people} 位`, money(f.v)];
    if (f.newPos) bits.push('有人新建倉');
    if (f.topUp != null) bits.push(`最高增持 ${(f.topUp * 100).toFixed(Math.abs(f.topUp) >= 1 ? 0 : 1)}%`);
    return `${f.sym}　${String(f.name).slice(0, 24)}\n　${bits.join('・')}`;
  };
  const shown = fires.slice(0, ALERT.MAX_LIST);
  const rest = fires.length - shown.length;
  const title = fires.length === 1
    ? `🕵️ ${fires[0].sym} ${fires[0].people} 位高管董事各自掏錢買`
    : `🕵️ ${fires.length} 家公司有 ${minPeople} 位以上內部人一起買`;
  const body = [
    ...shown.map(line),
    rest > 0 ? `…還有 ${rest} 家（打開網站看）` : '',
    '',
    `規則：${win} 天內有 ${minPeople} 位以上<b>不同的</b>高管或董事，`
    + '各自在公開市場買進（已排除事先排定的計畫、配股、行權）。',
    /* ⚠⚠ 這兩句<一定要在推播裡>。推播會打斷他，所以更不能讓他以為這是「可以買」。 */
    '⚠ 這是一件<b>已經發生的事實</b>，不是買進訊號 —— 它後來會不會漲，這個站<b>還沒有量過</b>。',
    '⚠ 要不要買，照你的三步判斷走（基本面 → 買賣點 → 大盤與板塊）。',
  ].filter(Boolean).join('\n').replace(/<\/?b>/g, '');
  /* 點進去要去<即時>的那一頁。⚠ 不可以連到 #/flow —— 那一頁一個月才重建一次，
       今天這一筆<根本不在上面>，點過去會看到一個沒有它的畫面。 */
  const url = `${base}/#/s/${encodeURIComponent(fires[0].sym)}`;
  return { title, body, url, count: fires.length, day };
}

export const ALERT_TRUTH = '推播報的是<b>公開申報文件上寫了什麼</b>：'
  + `<b>${ALERT.WIN} 天內有 ${ALERT.MIN_PEOPLE} 位以上不同的高管或董事，各自在公開市場買進同一家公司</b>。`
  + '⚠ 這是<b>已經發生的事實</b>，<b>不是</b>買進訊號。';
export const ALERT_THRESHOLD_WHY = `門檻（<b>${ALERT.WIN} 天窗、${ALERT.MIN_PEOPLE} 位</b>）是照<b>發送頻率</b>訂的，`
  + '<b>不是</b>照「有沒有用」訂的 —— 實測 2026-09-28 → 10-26 的 21 個平日：'
  + '2 位會響 19 天（等於每天吵）、3 位 12 天、<b>4 位 7 天（10 家次，約每 3 個平日一次）</b>、5 位 7 天。'
  + `⚠⚠ 「這個訊號後來會不會漲」<b>還沒有量</b>，所以推播只講發生了什麼事，<b>不講</b>「所以可以買」。`;
