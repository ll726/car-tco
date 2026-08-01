// 車種データ(残価率は2026-08時点のWeb掲載相場を参考に更新済み。買取相場ベースの概算)
// segment: 軽 / コンパクト / ミニバン / SUV / セダン・その他 / 輸入・EV
// EV車は ev: true + kmPerKwh(電費)。燃料費は 電気単価31円/kWh で計算(engine.js)
// price: 新車価格(円) / cc: 排気量 / weight: 車重kg / wltc: km/L
// resid: 残価率% {y3, y5, y7} / import: 輸入車 / fuelPrice: 燃料単価上書き(円/L)
const DATA_DATE = "2026年8月"; // データ基準日(残価率・税額・自賠責料率の確認時点)

const CARS = [
  { id: "jimny", segment: "軽",    name: "スズキ ジムニー",            price: 1900000, cc: 660,  weight: 1040, wltc: 16.6, resid: { y3: 92, y5: 82, y7: 68, y10: 45 }, import: false, note: "残価最強クラス" },
  { id: "nbox", segment: "軽",     name: "ホンダ N-BOX",               price: 1650000, cc: 660,  weight: 950,  wltc: 21.5, resid: { y3: 70, y5: 55, y7: 42, y10: 15 }, import: false, note: "軽の売れ筋" },
  { id: "yaris", segment: "コンパクト",    name: "トヨタ ヤリス",              price: 1800000, cc: 1490, weight: 1000, wltc: 21.6, resid: { y3: 62, y5: 50, y7: 38, y10: 12 }, import: false, note: "ガソリン想定" },
  { id: "fit", segment: "コンパクト",      name: "ホンダ フィット",            price: 2000000, cc: 1496, weight: 1120, wltc: 24.5, resid: { y3: 62, y5: 47, y7: 34, y10: 12 }, import: false, note: "e:HEV" },
  { id: "corollax", segment: "SUV", name: "トヨタ カローラクロス",      price: 2750000, cc: 1798, weight: 1400, wltc: 26.4, resid: { y3: 80, y5: 68, y7: 50, y10: 22 }, import: false, note: "HV" },
  { id: "alphard", segment: "ミニバン",  name: "トヨタ アルファード",        price: 5550000, cc: 2493, weight: 2110, wltc: 17.7, resid: { y3: 75, y5: 66, y7: 55, y10: 32 }, import: false, note: "残価率高い代表" },
  { id: "lc250", segment: "SUV",    name: "トヨタ ランドクルーザー250", price: 5450000, cc: 2754, weight: 2330, wltc: 11.0, resid: { y3: 85, y5: 75, y7: 62, y10: 40 }, import: false, fuelPrice: 150, note: "ディーゼル(軽油150円/L)" },
  { id: "serena", segment: "ミニバン",   name: "日産 セレナ",                price: 3100000, cc: 1433, weight: 1780, wltc: 19.3, resid: { y3: 62, y5: 48, y7: 34, y10: 12 }, import: false, note: "e-POWER" },
  { id: "cclass", segment: "輸入・EV",   name: "メルセデス・ベンツ Cクラス", price: 6900000, cc: 1494, weight: 1690, wltc: 16.2, resid: { y3: 50, y5: 35, y7: 22, y10: 8 }, import: true,  note: "値落ち大の代表" },
  { id: "bmw3", segment: "輸入・EV",     name: "BMW 3シリーズ",              price: 6300000, cc: 1998, weight: 1640, wltc: 13.5, resid: { y3: 48, y5: 33, y7: 20, y10: 8 }, import: true,  note: "同上" },
  { id: "prius", segment: "セダン・その他", name: "トヨタ プリウス",         price: 2750000, cc: 1986, weight: 1360, wltc: 32.6, resid: { y3: 64, y5: 50, y7: 38, y10: 15 }, import: false, note: "2.0 HV" },
  { id: "sienta", segment: "ミニバン",   name: "トヨタ シエンタ",            price: 2300000, cc: 1490, weight: 1330, wltc: 28.2, resid: { y3: 65, y5: 50, y7: 36, y10: 13 }, import: false, note: "HV" },
  { id: "harrier", segment: "SUV",      name: "トヨタ ハリアー",            price: 3500000, cc: 2487, weight: 1680, wltc: 22.3, resid: { y3: 78, y5: 58, y7: 47, y10: 18 }, import: false, note: "HV" },
  { id: "voxy", segment: "ミニバン",    name: "トヨタ ヴォクシー",          price: 3090000, cc: 1797, weight: 1670, wltc: 23.0, resid: { y3: 72, y5: 58, y7: 48, y10: 18 }, import: false, note: "HV" },
  { id: "crownsp", segment: "セダン・その他", name: "トヨタ クラウンスポーツ", price: 5900000, cc: 2487, weight: 1770, wltc: 21.3, resid: { y3: 62, y5: 46, y7: 33, y10: 12 }, import: false, note: "HV" },
  { id: "note", segment: "コンパクト",  name: "日産 ノート",                price: 2300000, cc: 1198, weight: 1220, wltc: 28.4, resid: { y3: 55, y5: 42, y7: 28, y10: 10 }, import: false, note: "e-POWER" },
  { id: "cx5", segment: "SUV",          name: "マツダ CX-5",                price: 2900000, cc: 2188, weight: 1680, wltc: 17.4, resid: { y3: 60, y5: 44, y7: 30, y10: 11 }, import: false, fuelPrice: 150, note: "ディーゼル(軽油150円/L)" },
  { id: "roadster", segment: "セダン・その他", name: "マツダ ロードスター",  price: 2900000, cc: 1496, weight: 1010, wltc: 16.8, resid: { y3: 74, y5: 65, y7: 52, y10: 32 }, import: false, note: "スポーツで残価堅い" },
  { id: "forester", segment: "SUV",     name: "スバル フォレスター",        price: 3100000, cc: 1795, weight: 1570, wltc: 13.6, resid: { y3: 68, y5: 52, y7: 38, y10: 14 }, import: false, note: "1.8ターボ" },
  { id: "spacia", segment: "軽",        name: "スズキ スペーシア",          price: 1550000, cc: 658,  weight: 850,  wltc: 23.9, resid: { y3: 65, y5: 50, y7: 35, y10: 12 }, import: false, note: "軽ハイトワゴン" },
  { id: "tanto", segment: "軽",         name: "ダイハツ タント",            price: 1500000, cc: 658,  weight: 900,  wltc: 21.9, resid: { y3: 60, y5: 46, y7: 32, y10: 10 }, import: false, note: "軽ハイトワゴン" },
  { id: "delica", segment: "ミニバン",  name: "三菱 デリカD:5",             price: 4050000, cc: 2267, weight: 1930, wltc: 12.6, resid: { y3: 75, y5: 58, y7: 44, y10: 22 }, import: false, fuelPrice: 150, note: "ディーゼル(軽油150円/L)" },
  { id: "vezel", segment: "SUV",        name: "ホンダ ヴェゼル",            price: 2500000, cc: 1496, weight: 1350, wltc: 25.0, resid: { y3: 66, y5: 52, y7: 38, y10: 14 }, import: false, note: "e:HEV" },
  { id: "nx", segment: "SUV",           name: "レクサス NX",                price: 5000000, cc: 2487, weight: 1850, wltc: 19.9, resid: { y3: 72, y5: 62, y7: 45, y10: 18 }, import: false, note: "350h HV" },
  { id: "model3", segment: "輸入・EV",  name: "テスラ モデル3",             price: 5300000, cc: 0, weight: 1760, wltc: 0, ev: true, kmPerKwh: 7.0, resid: { y3: 48, y5: 33, y7: 20, y10: 8 }, import: true, note: "EV(電費7.0km/kWh・電気31円/kWh)" },
];

if (typeof module !== "undefined") module.exports = { CARS, DATA_DATE };
