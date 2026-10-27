/* ───────── 🔔 每天掃「好幾個人一起買」，有才推播 ─────────

   ⚠⚠ 這個檔<只有 I/O 管線>：抓 SEC 每日索引、逐份打開、算完丟給 ntfy。
     <所有判斷都不在這裡> —— 代碼算不算公開市場買進、附註算不算「事先排定的計畫」、
     誰算高管董事、幾個人才算集群、推播要寫什麼字，全部來自
     https://evan-stock-radar.vercel.app/lib/*.js（跟網站<跑的是同一份>）。
     在這裡自己抄一份判斷，就是 [[learning_測試自己抄一份判斷邏輯]] 那個坑：
     抄本跟產品遲早會分岔，而且分岔的時候<兩邊都不會紅燈>。

   ⚠ 為什麼跑在 GitHub Actions 而不是 Vercel：
     Vercel 一支函式只有 60 秒，而且額度已經 12/12 滿了。
     這件事一天要打開約 470 份申報（冷啟動 7 天約 3,300 份），60 秒做不完。
     這個倉庫是公開的 → Actions 分鐘數免費。

   ⚠ GitHub 的排程<不準時>（實測會晚 2–7 小時）。不要緊：
     規則是「窗內人數<今天>第一次達標」，幾點跑出來的答案都一樣，
     而且<沒有去重紀錄要維護>。晚幾小時收到，比沒收到好。

   用法：
     node scan-clusters.mjs            正常跑（有達標的才發）
     node scan-clusters.mjs --dry      只印不發
     node scan-clusters.mjs --days=14  改窗（預設讀 lib 裡的 ALERT.WIN）
*/
import fs from 'node:fs';
import path from 'node:path';

const SITE = process.env.SITE_BASE || 'https://evan-stock-radar.vercel.app';
const UA = { 'User-Agent': process.env.SEC_UA || 'stock-radar-cron (contact via evan-stock-radar.vercel.app)' };
const DRY = process.argv.includes('--dry');
const argNum = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? Number(hit.slice(k.length + 3)) || d : d;
};
const CACHE = path.resolve(process.env.SEC_CACHE || '.secache');
const say = (...a) => console.log(...a);
const nap = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── ① 把判斷用的那幾支 lib 從網站抓下來 ──
   ⚠ 抓不到就<整個停掉，不要往下跑> —— 少一支 lib 會讓判斷悄悄變成另一套。 */
const LIBS = ['cache.js', 'insider.js', 'sectors.js', 'sec.js', 'insider-flow.js', 'cluster-alert.js'];
async function pullLibs() {
  fs.mkdirSync('lib', { recursive: true });
  for (const f of LIBS) {
    const r = await fetch(`${SITE}/lib/${f}`);
    if (!r.ok) throw new Error(`抓不到 ${SITE}/lib/${f}：HTTP ${r.status}`);
    const t = await r.text();
    if (!/export/.test(t)) throw new Error(`${f} 看起來不是程式（可能是錯誤頁）`);
    fs.writeFileSync(path.join('lib', f), t);
  }
  say(`判斷用的 lib 抓好了（${LIBS.length} 支，來源 ${SITE}）`);
}

/* ── ② SEC：限速 6 次/秒，失敗退避重試；抓過的存進快取 ── */
let last = 0, nReq = 0, nHit = 0, nFail = 0;
async function slot() {
  const at = Math.max(Date.now(), last + 1000 / 6);
  last = at;
  const w = at - Date.now();
  if (w > 0) await nap(w);
}
async function grab(url, key) {
  const f = key ? path.join(CACHE, key) : null;
  if (f && fs.existsSync(f)) { nHit++; return fs.readFileSync(f, 'utf8'); }
  for (let i = 0; i < 4; i++) {
    await slot();
    let r = null;
    try { r = await fetch(url, { headers: UA }); } catch { r = null; }
    nReq++;
    if (r && r.ok) {
      const t = await r.text();
      if (f) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); }
      return t;
    }
    if (r && r.status === 404) return null;                 // 真的沒有這一天（週末、假日）
    if (r && r.status !== 429 && r.status !== 403 && r.status < 500) return null;
    await nap(600 * (i + 1) * (i + 1));
  }
  nFail++;
  return null;
}

const isWeekend = (d) => [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay());
const shift = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

function parseIdx(txt) {
  const out = new Map();
  for (const L of String(txt).split(/\r?\n/)) {
    const m = L.match(/^(\S+)\s+(.+?)\s{2,}(\d+)\s+(\d{8})\s+(edgar\/data\/\S+?)\s*$/);
    if (!m || m[1] !== '4') continue;
    const acc = (m[5].match(/(\d{10}-\d{2}-\d{6})\.txt$/) || [])[1];
    if (acc && !out.has(acc)) out.set(acc, m[5]);
  }
  return out;
}

async function main() {
  await pullLibs();
  const { parseForm4Xml } = await import('./lib/sec.js');
  const { collapse, roleOf } = await import('./lib/insider.js');
  const { roleClassOf } = await import('./lib/insider-flow.js');
  const { clusterAlerts, alertMessage, ALERT } = await import('./lib/cluster-alert.js');

  const WIN = argNum('days', ALERT.WIN);
  const MIN = argNum('people', ALERT.MIN_PEOPLE);

  /* 窗：往回找 WIN 個<有索引的平日>。⚠ 索引要往回多找幾天（遇到假日會 404）。 */
  const today = process.env.SCAN_TODAY || new Date().toISOString().slice(0, 10);
  const idx = [];
  for (let d = today, tried = 0; idx.length < WIN && tried < WIN + 8; d = shift(d, -1), tried++) {
    if (isWeekend(d)) continue;
    const q = `QTR${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
    const txt = await grab(
      `https://www.sec.gov/Archives/edgar/daily-index/${d.slice(0, 4)}/${q}/form.${d.replace(/-/g, '')}.idx`,
      `idx/form.${d.replace(/-/g, '')}.idx`);
    if (txt == null) { say(`　${d}：沒有索引（假日）`); continue; }
    const accs = parseIdx(txt);
    idx.push({ d, accs });
    say(`　${d}：Form 4 ${accs.size} 件`);
  }
  if (!idx.length) { say('⚠ 一天索引都拿不到 —— 不發推播（這是問不到，不是沒有人買）'); process.exit(0); }
  idx.sort((a, b) => (a.d < b.d ? -1 : 1));
  const day = idx[idx.length - 1].d;                        // 「今天」＝最新有索引的那一天
  say(`窗 ${idx[0].d} → ${day}（${idx.length} 個交易日），門檻 ${MIN} 位`);

  /* ── ③ 逐份打開（每日索引不含交易代碼，所以非開不可）── */
  const jobs = [];
  for (const { d, accs } of idx) for (const [acc, file] of accs) jobs.push({ d, acc, file });
  say(`要打開 ${jobs.length} 份`);
  const rows = [];
  let unread = 0, done = 0;
  const WORKERS = 6;
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    for (;;) {
      const job = jobs.shift();
      if (!job) return;
      const txt = await grab(`https://www.sec.gov/Archives/${job.file}`, `f4/${job.acc}.txt`);
      if (++done % 500 === 0) say(`　　${done} 份…（讀不到 ${unread}）`);
      if (txt == null) { unread++; continue; }
      let trades = [];
      try { trades = parseForm4Xml(txt); } catch { unread++; continue; }
      const sym = String((txt.match(/<issuerTradingSymbol>([^<]*)</) || [])[1] || '')
        .trim().toUpperCase().split(/[,;\s]+/)[0];
      const name = (txt.match(/<issuerName>([^<]*)</) || [])[1] || sym;
      if (!sym || sym === 'NONE' || sym === 'N/A') continue;
      for (const t of trades) rows.push({ ...t, accession: job.acc, sym, issuer: name, filed: job.d });
    }
  }));
  say(`收到 ${rows.length} 列，讀不到 ${unread} 份（請求 ${nReq}、快取命中 ${nHit}、失敗 ${nFail}）`);

  /* ── ④ 判斷（全部走抓下來的那幾支 lib）── */
  const ps = rows.filter((r) => r.code === 'P' && Number(r.shares) > 0);
  const buys = collapse(ps)
    .filter((t) => !t.plan)                                   // 事先排定的計畫自動買的不算
    .map((t) => {
      const r = roleOf(t);
      const after = Number(t.after), sh = Number(t.shares);
      const before = after > 0 && after >= sh ? after - sh : null;
      return {
        sym: t.sym, name: t.issuer, who: t.owner, role: r.label, rk: r.key, rc: roleClassOf(t),
        filed: t.filed, acc: t.accession, sh: Math.round(sh),
        px: t.price ? Math.round(t.price * 100) / 100 : null,
        v: Math.round(Number(t.value) || 0),
        upPct: before > 0 ? sh / before : null,
        newPos: before === 0,
      };
    });
  say(`有效買進 ${buys.length} 筆（其中高管董事 ${buys.filter((b) => b.rc === 'exec').length} 筆）`);

  const fires = clusterAlerts(buys, { day, win: WIN, minPeople: MIN });
  if (!fires.length) {
    say(`✅ 今天（${day}）沒有達標的 —— <不發推播>。沒事就不要響。`);
    return;
  }
  for (const f of fires) say(`🔔 ${f.sym} ${f.people} 位（今天新增 ${f.freshN}）$${f.v} ${f.names.join('／')}`);

  const msg = alertMessage(fires, { day, base: SITE, win: WIN, minPeople: MIN });
  say(`\n── 推播內容 ──\n${msg.title}\n${msg.body}\n點擊 → ${msg.url}`);

  /* ── ⑤ 發 ── */
  const topic = process.env.NTFY_TOPIC;
  if (DRY) { say('\n--dry：不發'); return; }
  if (!topic) { say('\n⚠ 沒有 NTFY_TOPIC，不發（這是設定沒給，不是沒有訊號）'); process.exit(1); }
  const r = await fetch('https://ntfy.sh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic, title: msg.title, message: msg.body,
      tags: ['detective'], priority: 3, click: msg.url,
    }),
  });
  say(r.ok ? '✅ 發出去了' : `⚠ ntfy 回 ${r.status}`);
  if (!r.ok) process.exit(1);
}

main().catch((e) => { console.error('⚠ 掛了：', e.message); process.exit(1); });
