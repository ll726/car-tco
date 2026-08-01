// 車種データ(残価率は2026-08時点のWeb掲載相場を参考に更新済み。買取相場ベースの概算)
// price: 新車価格(円) / cc: 排気量 / weight: 車重kg / wltc: km/L
// resid: 残価率% {y3, y5, y7} / import: 輸入車 / fuelPrice: 燃料単価上書き(円/L)
const DATA_DATE = "2026年8月"; // データ基準日(残価率・税額・自賠責料率の確認時点)

const CARS = [
  { id: "jimny",    name: "スズキ ジムニー",            price: 1900000, cc: 660,  weight: 1040, wltc: 16.6, resid: { y3: 92, y5: 82, y7: 68, y10: 45 }, import: false, note: "残価最強クラス" },
  { id: "nbox",     name: "ホンダ N-BOX",               price: 1650000, cc: 660,  weight: 950,  wltc: 21.5, resid: { y3: 70, y5: 55, y7: 42, y10: 15 }, import: false, note: "軽の売れ筋" },
  { id: "yaris",    name: "トヨタ ヤリス",              price: 1800000, cc: 1490, weight: 1000, wltc: 21.6, resid: { y3: 62, y5: 50, y7: 38, y10: 12 }, import: false, note: "ガソリン想定" },
  { id: "fit",      name: "ホンダ フィット",            price: 2000000, cc: 1496, weight: 1120, wltc: 24.5, resid: { y3: 62, y5: 47, y7: 34, y10: 12 }, import: false, note: "e:HEV" },
  { id: "corollax", name: "トヨタ カローラクロス",      price: 2750000, cc: 1798, weight: 1400, wltc: 26.4, resid: { y3: 80, y5: 68, y7: 50, y10: 22 }, import: false, note: "HV" },
  { id: "alphard",  name: "トヨタ アルファード",        price: 5550000, cc: 2493, weight: 2110, wltc: 17.7, resid: { y3: 75, y5: 66, y7: 55, y10: 32 }, import: false, note: "残価率高い代表" },
  { id: "lc250",    name: "トヨタ ランドクルーザー250", price: 5450000, cc: 2754, weight: 2330, wltc: 11.0, resid: { y3: 85, y5: 75, y7: 62, y10: 40 }, import: false, fuelPrice: 150, note: "ディーゼル(軽油150円/L)" },
  { id: "serena",   name: "日産 セレナ",                price: 3100000, cc: 1433, weight: 1780, wltc: 19.3, resid: { y3: 62, y5: 48, y7: 34, y10: 12 }, import: false, note: "e-POWER" },
  { id: "cclass",   name: "メルセデス・ベンツ Cクラス", price: 6900000, cc: 1494, weight: 1690, wltc: 16.2, resid: { y3: 50, y5: 35, y7: 22, y10: 8 }, import: true,  note: "値落ち大の代表" },
  { id: "bmw3",     name: "BMW 3シリーズ",              price: 6300000, cc: 1998, weight: 1640, wltc: 13.5, resid: { y3: 48, y5: 33, y7: 20, y10: 8 }, import: true,  note: "同上" },
];

if (typeof module !== "undefined") module.exports = { CARS, DATA_DATE };
