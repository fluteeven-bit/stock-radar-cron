# stock-radar-cron

進場雷達的雲端排程：開盤時間每 5 分鐘呼叫一次監控 API。網址與金鑰存在 GitHub Secret，不在這個倉庫裡。

網站：https://evan-stock-radar.vercel.app

## 排程

- `monitor.yml` —— 進場雷達監控的**備援**（主力是 Cloudflare Workers Cron，每 5 分鐘）。
- `insider-cluster.yml` —— 每天掃 SEC Form 4，**同一家公司有 4 位以上不同的高管或董事各自在公開市場買進**就推播一則。沒有達標的日子**一則都不發**。

### 判斷不在這個倉庫裡

`scan-clusters.mjs` 每次跑之前，從 https://evan-stock-radar.vercel.app/lib/ 把判斷用的那幾支抓下來再跑
（`sec.js` / `insider.js` / `insider-flow.js` / `cluster-alert.js`）——
所以推播用的那套判斷，**跟網站上看到的是同一份**。這個倉庫只負責 I/O 與排程。

手動跑：Actions → 內部人集群買入 → Run workflow（可以勾「只印不發」、改門檻與窗）。
