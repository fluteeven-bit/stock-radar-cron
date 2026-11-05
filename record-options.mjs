/* ───────── 🔬 選擇權「磁吸價位」：每天記一次（排程） ─────────

   ⚠⚠ 這個檔<只有 I/O 接線>：抓現價、抓選擇權鏈、抓到期那天的收盤、寫檔。
     <三件事怎麼做、規則是什麼，一行都不在這個倉庫裡> ——
     每次跑之前從 https://evan-stock-radar.vercel.app/lib/ 把
     options.js／options-log.js／options-record.js 抓下來再跑，
     所以<排程跑的跟網站上的是同一份>。
     在這裡自己抄一份的話，兩邊遲早分岔，而且<分岔的時候兩邊都不會紅燈>。

   ⚠⚠ 為什麼要往前記：「錢堆在那個履約價，價格就會被吸過去」這件事
     <回頭量不了> —— 資料源只給當月以後的選擇權鏈（問過去的月份回 400）。
     所以只剩一條路：每天把「最大未平倉履約價」與「當時現價」記下來，
     到期那天再對收盤。規則（預先登記）在 lib/options-log.js 的檔頭。

   ⚠ GitHub 的排程<不準時>（這個站實測會晚 2–7 小時）。不要緊：
     這件事要的是「每個交易日有一張快照」，早幾小時晚幾小時都一樣，
     而且規則只用「到期前 ≥3 天」那一張，容得下延遲。

   ⚠ 這個倉庫必須保持 PUBLIC，而且<不可以把任何金鑰寫進檔案裡>。這支不需要任何金鑰。

   用法：node record-options.mjs [--dry]
*/
import fs from 'node:fs';
import path from 'node:path';

const SITE = process.env.SITE_BASE || 'https://evan-stock-radar.vercel.app';
const OUT = path.resolve('options-log.json');
const DRY = process.argv.includes('--dry');
const say = (...a) => console.log(...a);

/* ── ① 把判斷用的 lib 從網站抓下來 ──
   ⚠ 抓不到就<整個停掉，不要往下跑> —— 少一支會讓規則悄悄變成另一套。 */
const LIBS = ['options.js', 'options-log.js', 'options-record.js', 'data.js', 'data-nasdaq.js'];
fs.mkdirSync('lib', { recursive: true });
for (const f of LIBS) {
  const r = await fetch(`${SITE}/lib/${f}`);
  if (!r.ok) throw new Error(`抓不到 ${SITE}/lib/${f}：HTTP ${r.status}`);
  const t = await r.text();
  if (!/export/.test(t)) throw new Error(`${f} 看起來不是程式（可能是錯誤頁）`);
  fs.writeFileSync(path.join('lib', f), t);
}
say(`判斷用的 lib 抓好了（${LIBS.length} 支，來源 ${SITE}）`);

const { runRecord } = await import('./lib/options-record.js');
const { logStats } = await import('./lib/options-log.js');

/* ── ② 現價與收盤都跟<網站自己的 API> 要 ──
   ⚠ 不要在這裡另外接一個報價源：那就是第二份判斷，而且壞掉的時候不會有人知道。 */
const jget = async (u) => {
  const r = await fetch(u, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};
const barsCache = {};
const quote = async (sym) => {
  const j = await jget(`${SITE}/api/quote?symbols=${encodeURIComponent(sym)}`);
  const q = Array.isArray(j) ? j[0] : null;
  if (!q || q.error) throw new Error(q ? q.error : '沒有回報價');
  return (q.day && q.day.close != null) ? q.day.close : q.regularPrice;
};
const closeOn = async (sym, iso) => {
  barsCache[sym] ||= await jget(`${SITE}/api/chart?symbol=${encodeURIComponent(sym)}&range=1y`);
  const d = barsCache[sym], off = d.gmtoffset || 0;
  const i = d.t.findIndex((t) => new Date((t + off) * 1000).toISOString().slice(0, 10) === iso);
  return i < 0 ? null : d.c[i];
};

const load = () => {
  try { const j = JSON.parse(fs.readFileSync(OUT, 'utf8')); return { snaps: j.snaps || [], done: j.done || [] }; }
  catch { return { snaps: [], done: [] }; }
};

const today = new Date().toISOString().slice(0, 10);
const { state, tally } = await runRecord({ state: load(), today, quote, closeOn, log: say });

say(`① 記：新增 ${tally.added} 筆快照（失敗 ${tally.failed} 檔）`);
say(`② 結算：新增 ${tally.settled} 組｜沒有合格快照 ${tally.noSnap}｜拿不到收盤 ${tally.noClose}`);
say(`③ 存檔：快照 ${state.snaps.length} 筆｜結算 ${state.done.length} 組`);

const st = logStats(state.done);
say(`目前結算 ${st.n} 組（門檻 ${st.min}）${st.enough ? '｜可以給結論了' : '｜還不夠，不給結論'}`);

/* ⚠⚠ 一筆都沒記到就<不要寫檔> —— 上游壞掉的那一天把檔案覆蓋成空的，
     等於把之前累積的東西洗掉（[[learning_整包覆蓋的存檔要先確認拿到完整清單]]）。 */
if (!tally.added && !tally.settled) {
  say('⚠ 這一趟什麼都沒記到也沒結算到 —— 不寫檔，避免把累積的東西洗掉。');
  if (tally.fails.length) say('   失敗原因：' + tally.fails.slice(0, 5).join('｜'));
  process.exit(0);
}
if (DRY) { say('（--dry，不寫檔）'); process.exit(0); }
fs.writeFileSync(OUT, JSON.stringify(state, null, 1));
say(`寫好了 ${OUT}`);
