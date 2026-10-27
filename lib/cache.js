// 公開快取：只放「這個執行個體的記憶體」＋ CDN 的 s-maxage，<完全不碰 Vercel Blob>。
//
// 為什麼：Blob 的免費額度是用「讀取次數」算的，2026-10-01 就是這樣整個 store 被停用，
// 監控、持倉、推播、行事曆一起死掉。而 earnings／sec-tickers／fundamentals／fng／events
// 這幾份<沒有一個是私人資料>，它們只是「省得跟上游重抓」的公開快取 —— 這種東西放 CDN
// 最便宜也最快，放 Blob 等於拿最貴的額度去買最不需要的東西。
//
// 真正該留在 Blob 的只有四份：auth（密碼雜湊）、watchlist（監控清單與持倉）、
// state（推播去重與紀錄）、events-custom（私人備註）。store.js 會直接擋住其他名字。
//
// ⚠ 記憶體快取只在「同一個執行個體」有效，冷啟動就沒了。所以每一支 API 都要同時設
//   s-maxage，讓 CDN 擋掉絕大多數請求；重建成本很高的（財報日要掃 50 天）還要再用
//   「拿 CDN 當共用快取」的做法，見 api/earnings.js。

const mem = new Map();   // key → { at, ttl, p, good }

/**
 * 記憶體快取。ttlMs 內重複呼叫直接拿同一個 Promise（連同時進來的也只會建一次）。
 *
 * build(prev)  prev＝上一份「成功建出來」的值，沒有就是 undefined。
 *              上游只壞一半的時候（例如行事曆的兩個來源壞了一個），
 *              <一定要拿 prev 把舊的補回去>，不然畫面會變成假的空狀態。
 * ttlOf(value) 選填。回傳這一份值該存多久 —— 建出來的東西只有半套時就回短一點，
 *              讓它幾分鐘後自己再試一次，不要用殘缺的版本佔住整個 ttl。
 * 建不起來而且也沒有上一份好的 → 把錯誤丟出去（不要回空值假裝成功）。
 */
export function memoized(key, ttlMs, build, ttlOf) {
  const e = mem.get(key);
  // 取兩者較短的：ttlOf 可以把「只建出半套」的那一份縮短，呼叫端也可以臨時要求更新鮮的
  if (e && Date.now() - e.at < Math.min(e.ttl ?? ttlMs, ttlMs)) return e.p;
  const prev = e ? e.good : undefined;
  const p = Promise.resolve().then(() => build(prev)).then(
    (v) => {
      const ttl = typeof ttlOf === 'function' ? (ttlOf(v) ?? ttlMs) : ttlMs;
      mem.set(key, { at: Date.now(), ttl, p: Promise.resolve(v), good: v });
      return v;
    },
    (err) => {
      if (prev !== undefined) {
        // 給上一份好的，但只撐一分鐘就會再試一次（不要等整個 ttl）
        mem.set(key, { at: Date.now(), ttl: 60000, p: Promise.resolve(prev), good: prev });
        return prev;
      }
      mem.delete(key);
      throw err;
    },
  );
  mem.set(key, { at: Date.now(), ttl: ttlMs, p, good: prev });
  return p;
}

// 這份記憶體快取裡現在有什麼（診斷用，api/monitor.js?probe=1 會回報）
export const memoStat = () => [...mem.entries()].map(([k, e]) => ({ key: k, ageSec: Math.round((Date.now() - e.at) / 1000), has: e.good !== undefined }));

export const memoDrop = (key) => (key ? mem.delete(key) : mem.clear());
