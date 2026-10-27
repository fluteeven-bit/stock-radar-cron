// 同板塊對照：個股所屬產業 → 追蹤該板塊的 ETF（用來看板塊資金流向與量能）
const US_SECTOR = {
  Technology: ['XLK', '科技類股'],
  'Financial Services': ['XLF', '金融類股'],
  Healthcare: ['XLV', '醫療保健'],
  'Consumer Cyclical': ['XLY', '非必需消費'],
  'Consumer Defensive': ['XLP', '必需消費'],
  Energy: ['XLE', '能源類股'],
  Industrials: ['XLI', '工業類股'],
  'Basic Materials': ['XLB', '原物料'],
  Utilities: ['XLU', '公用事業'],
  'Real Estate': ['XLRE', '房地產'],
  'Communication Services': ['XLC', '通訊服務'],
};
const US_INDUSTRY = [
  [/semiconductor/i, ['SMH', '半導體']],
  [/biotechnolog/i, ['XBI', '生技']],
  [/software|information technology services/i, ['IGV', '軟體']],
  [/aerospace|defense/i, ['ITA', '航太國防']],
  [/oil|gas|petroleum/i, ['XLE', '能源類股']],
  [/bank/i, ['KRE', '銀行類股']],
  [/gold|silver|mining/i, ['GDX', '金礦類股']],
  [/airline/i, ['JETS', '航空類股']],
  [/retail/i, ['XRT', '零售類股']],
];
const TW_INDUSTRY = [
  [/semiconductor/i, ['00891.TW', '台股半導體']],
  [/electronic|computer|hardware|technology|software/i, ['0052.TW', '台股電子科技']],
  [/bank|insurance|financial|capital markets/i, ['0055.TW', '台股金融']],
  [/steel|chemical|cement|material/i, ['0050.TW', '台灣50（傳產為主的大盤代表）']],
];

// 回傳 { symbol, name } 或 null
export function sectorOf(fundamentals, mk) {
  if (!fundamentals) return null;
  const { sector, industry } = fundamentals;
  const table = mk === 'TW' ? TW_INDUSTRY : US_INDUSTRY;
  for (const [re, val] of table) {
    if ((industry && re.test(industry)) || (sector && re.test(sector))) return { symbol: val[0], name: val[1] };
  }
  if (mk === 'TW') return sector ? { symbol: '0050.TW', name: '台灣50（大型股代表）' } : null;
  const hit = sector && US_SECTOR[sector];
  return hit ? { symbol: hit[0], name: hit[1] } : null;
}
