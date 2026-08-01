// 計算エンジンのコンソール検証: node test.js
const { CARS, USED_MARGIN } = require("./data.js");
const { calcAll, calcTCO, calcLease, autoTax, weightTaxPerShaken, residualRate, mileageAdjustedRate, shakenYears } = require("./engine.js");

const man = (n) => (n / 10000).toFixed(1) + "万";

// --- 単体チェック ---
console.log("== 単体チェック ==");
console.assert(autoTax(660) === 10800, "軽の自動車税");
console.assert(autoTax(1490) === 30500, "1.5L税額");
console.assert(autoTax(2493) === 43500, "2.5L税額");
console.assert(weightTaxPerShaken(1040, false, false) === 3 * 4100 * 2, "重量税1040kg=1.5t区分");
const R = { y3: 60, y5: 48, y7: 35, y10: 14 };
console.assert(residualRate(R, 3) === 60, "残価3年");
console.assert(residualRate(R, 4) === 54, "残価4年補間");
console.assert(Math.abs(residualRate(R, 8) - (35 + (14 - 35) / 3)) < 1e-9, "残価8年は7→10年の補間");
console.assert(residualRate(R, 10) === 14, "残価10年=テーブル値");
console.assert(residualRate(R, 12) === 10, "10年超は年-2pt");
console.assert(residualRate(R, 20) === 5, "下限5%");
console.assert(mileageAdjustedRate(50, 80000, 5) === 41, "5年8万km → -9pt");
console.assert(JSON.stringify(shakenYears(5, false)) === "[3]", "新車5年保有=車検1回");
console.assert(JSON.stringify(shakenYears(7, false)) === "[3,5]", "新車7年=2回");
console.assert(JSON.stringify(shakenYears(5, true)) === "[2,4]", "中古5年=2回");
// 中古3年落ち購入 → 売却残価は「車齢」ベースか
// 5年保有なら車齢8年: residualRate(7→10年区間の補間) - 走行距離補正 で計算されるはず
{
  const car = CARS.find((c) => c.id === "yaris"); // resid 62/50/38
  const o = { years: 5, annualKm: 10000, fuelPrice: 170, parkingMonthly: 0, insuranceAnnual: 60000, sell: true, buyAge: 3 };
  const r = calcTCO(car, o);
  // 車齢8年時点の素の残価率: y7とy10の線形補間 = 38 + (12-38)/3 ≒ 29.33%
  const expectedRate = residualRate(car.resid, 8);
  console.assert(Math.abs(expectedRate - (38 + (12 - 38) / 3)) < 1e-9, "車齢8年の補間値");
  // 総走行 = 前オーナー3万km + 自分5万km = 8万km = 車齢8年×1万km基準ちょうど → 距離補正なし
  console.assert(r.salePrice === Math.round(car.price * expectedRate / 100), "中古売却は車齢8年ベース");
  // 保有年数ベース(5年=50%)で誤計算していないこと
  console.assert(r.salePrice !== Math.round(car.price * 0.5), "保有年数ベースになっていない");
}

// ランクル250の燃料単価は軽油150円/Lで独立しているか(全体設定のガソリン単価に影響されない)
{
  const lc = CARS.find((c) => c.id === "lc250");
  const base = { years: 5, annualKm: 10000, parkingMonthly: 0, insuranceAnnual: 60000, sell: true, buyAge: 0 };
  const r170 = calcTCO(lc, { ...base, fuelPrice: 170 });
  const r200 = calcTCO(lc, { ...base, fuelPrice: 200 });
  console.assert(r170.breakdown.fuel === r200.breakdown.fuel, "LC250の燃料費はopts.fuelPriceに依存しない");
  const expectedFuel = Math.round((10000 / (11.0 * 0.85)) * 150 * 5);
  console.assert(r170.breakdown.fuel === expectedFuel, "LC250の燃料費=軽油150円/Lで計算");
  // 対照: 上書きの無い車は単価変更が反映される
  const yaris = CARS.find((c) => c.id === "yaris");
  console.assert(calcTCO(yaris, { ...base, fuelPrice: 170 }).breakdown.fuel !== calcTCO(yaris, { ...base, fuelPrice: 200 }).breakdown.fuel, "通常車は単価変更が反映");
}

// EV(テスラ モデル3)の計算
{
  const ev = CARS.find((c) => c.id === "model3");
  const base = { years: 5, annualKm: 10000, fuelPrice: 170, parkingMonthly: 0, insuranceAnnual: 60000, sell: true, buyAge: 0 };
  const r = calcTCO(ev, base);
  // 燃料費 = 年1万km ÷ 電費7.0km/kWh × 31円/kWh × 5年(WLTC補正0.85は適用しない)
  const expectedElec = Math.round((10000 / 7.0) * 31 * 5);
  console.assert(r.breakdown.fuel === expectedElec, "EVの燃料費は電費×電気単価で計算");
  // ガソリン単価を変えても電気代は不変
  console.assert(calcTCO(ev, { ...base, fuelPrice: 250 }).breakdown.fuel === expectedElec, "EVはガソリン単価に依存しない");
  // 自動車税はEV区分(1,000cc以下扱い=25,000円/年)
  console.assert(r.breakdown.tax === 25000 * 5, "EVの自動車税は25,000円/年");
  console.assert(autoTax(0, true) === 25000, "autoTax EV区分");
  // cc:0でも軽扱いにならない(重量税が軽の6,600円/2年ベースでない)
  console.assert(weightTaxPerShaken(ev.weight, false, false) === Math.ceil(1760 / 500) * 4100 * 2, "EVの重量税は普通車区分");
}

// 経年重課(13年超: 自動車税15%増・重量税重課、18年超: 重量税さらに重課。EV対象外)
{
  const base = { annualKm: 10000, fuelPrice: 170, parkingMonthly: 0, insuranceAnnual: 60000, sell: false, buyAge: 0 };
  const yaris = CARS.find((c) => c.id === "yaris"); // 1490cc = 30,500円/年

  // 新車15年保有: 車齢14,15年の2年分が15%重課
  const r15 = calcTCO(yaris, { ...base, years: 15 });
  console.assert(r15.breakdown.tax === Math.round(30500 * 13 + 30500 * 1.15 * 2), "自動車税13年超15%重課(新車15年)");
  // 新車13年保有: 重課なし(車齢13は「13年超」でない)
  const r13 = calcTCO(yaris, { ...base, years: 13 });
  console.assert(r13.breakdown.tax === 30500 * 13, "車齢13年ちょうどは重課なし");
  // 中古3年落ち12年保有: 車齢13超は保有11,12年目(車齢14,15)の2年分
  const rU = calcTCO(yaris, { ...base, years: 12, buyAge: 3 });
  console.assert(rU.breakdown.tax === Math.round(30500 * 10 + 30500 * 1.15 * 2), "中古は車齢ベースで重課判定");

  // 重量税: 1000kg=1.0t区分。通常8,200円/2年 → 13年超22,800円... の区分単価で判定
  console.assert(weightTaxPerShaken(1000, false, false, 10) === 2 * 4100 * 2, "重量税 通常");
  console.assert(weightTaxPerShaken(1000, false, false, 14) === 2 * 5700 * 2, "重量税 13年超重課");
  console.assert(weightTaxPerShaken(1000, false, false, 19) === 2 * 6300 * 2, "重量税 18年超重課");
  console.assert(weightTaxPerShaken(900, true, false, 14) === 8200, "軽の13年超重課");
  console.assert(weightTaxPerShaken(1760, false, false, 14, true) === 4 * 4100 * 2, "EVは重量税重課の対象外");

  // 中古15年保有の車検(2,4,...,14年目)のうち車齢13超(11年目=車齢14以降)は重課単価が乗る
  const heavy = calcTCO(yaris, { ...base, years: 15, buyAge: 3 });
  const normal = calcTCO(yaris, { ...base, years: 15, buyAge: 0 });
  console.assert(heavy.breakdown.shaken > 0 && normal.breakdown.shaken > 0, "車検内訳が計算される");

  // EVは自動車税の重課なし
  const ev = CARS.find((c) => c.id === "model3");
  console.assert(calcTCO(ev, { ...base, years: 15 }).breakdown.tax === 25000 * 15, "EVは自動車税重課なし");
}

// 7年落ち購入 + 5年保有 = 車齢12年の残価と重課
{
  const car = CARS.find((c) => c.id === "yaris"); // resid 62/50/38/12, 30,500円/年
  const o = { years: 5, annualKm: 10000, fuelPrice: 170, parkingMonthly: 0, insuranceAnnual: 60000, sell: true, buyAge: 7 };
  const r = calcTCO(car, o);
  // 取得価格 = 新車価格 × 7年残価率38% × 店頭マージン1.15
  console.assert(r.acquisition === Math.round(car.price * 0.38 * 1.15), "7年落ちの取得価格=7年残価率×マージン");
  // 売却時車齢12年: 残価率 = y10(12%) - 2pt×2年 = 8%。総走行12万km=車齢12年×1万km基準で距離補正なし
  console.assert(residualRate(car.resid, 12) === 8, "車齢12年=10年超カーブ(y10-2pt/年)");
  console.assert(r.salePrice === Math.round(car.price * 0.08), "売却残価は車齢12年ベース");
  // 自動車税: 保有各年の車齢は8〜12年 → 13年超なし、重課ゼロ
  console.assert(r.breakdown.tax === 30500 * 5, "車齢12年までは自動車税重課なし");
  // 対照: 7年落ち+8年保有(車齢最大15年)は車齢14,15年の2年分が15%重課
  const r8 = calcTCO(car, { ...o, years: 8, sell: false });
  console.assert(r8.breakdown.tax === Math.round(30500 * 6 + 30500 * 1.15 * 2), "7年落ち購入でも車齢14年以降は重課");
  // 重量税: 7年落ち購入の初回車検は2年後(保有2年目=車齢9年)から。車齢13超の車検(保有8年時点の車検=車齢13,15…)
  console.assert(JSON.stringify(shakenYears(5, true)) === "[2,4]", "中古は初回車検2年後(既存仕様維持)");
}

// 実質価格: 新車値引きと中古マージン係数
{
  const yaris = CARS.find((c) => c.id === "yaris"); // discount 180,000円
  const o = { years: 5, annualKm: 10000, fuelPrice: 170, parkingMonthly: 0, insuranceAnnual: 60000, sell: true, buyAge: 0 };
  // 新車 = 定価 - 値引き相場
  console.assert(calcTCO(yaris, o).acquisition === yaris.price - 180000, "新車取得価格=定価-値引き");
  // 値引き0円の車(LC250)は定価のまま
  const lc = CARS.find((c) => c.id === "lc250");
  console.assert(calcTCO(lc, o).acquisition === lc.price, "値引き0円は定価");
  // 中古3年落ち = 定価 × 3年残価率(買取) × USED_MARGIN。売却側にはマージンを掛けない
  const u = calcTCO(yaris, { ...o, buyAge: 3 });
  console.assert(u.acquisition === Math.round(yaris.price * 0.62 * USED_MARGIN), "中古取得=買取残価×1.15");
  console.assert(u.salePrice === Math.round(yaris.price * (residualRate(yaris.resid, 8) / 100)), "売却は買取ベースのまま");
  console.assert(USED_MARGIN === 1.15, "USED_MARGIN定数");
}

// リース計算
{
  const nbox = CARS.find((c) => c.id === "nbox");
  // ボーナス併用: 月5,500円+ボーナス38,500円×年2回×7年(超過なし)
  const l1 = calcLease({ monthly: 5500, bonus: 38500, years: 7, kmLimit: 12000, annualKm: 10000 });
  console.assert(l1.leaseTotal === 5500 * 12 * 7 + 38500 * 2 * 7, "リース総額=月額+ボーナス年2回");
  console.assert(l1.overage === 0, "上限内は超過金なし");
  // 走行超過: 年15,000km走行・上限12,000km → 超過3,000km×8円×7年
  const l2 = calcLease({ monthly: 5500, bonus: 38500, years: 7, kmLimit: 12000, annualKm: 15000 });
  console.assert(l2.overage === 3000 * 8 * 7, "超過金=超過km×8円×年数");
  console.assert(l2.leaseTotal === l1.leaseTotal + l2.overage, "超過金は総額に加算");
  // 実質総額 = リース総額 + 保険 + 駐車場 + 燃料(既存fuelCostロジック)
  const l3 = calcLease({ monthly: 5500, bonus: 38500, years: 7, kmLimit: 12000, annualKm: 10000, car: nbox, fuelPrice: 170, insuranceAnnual: 60000, parkingMonthly: 10000 });
  const expFuel = Math.round((10000 / (21.5 * 0.85)) * 170 * 7);
  console.assert(l3.fuel === expFuel, "リースの燃料費は既存ロジック");
  console.assert(l3.effectiveTotal === Math.round(l1.leaseTotal + 60000 * 7 + 10000 * 12 * 7 + (10000 / (21.5 * 0.85)) * 170 * 7), "リース実質総額");
}

console.log("assert完了(エラー表示が無ければOK)");

// --- 標準条件: 5年・年1万km・売却あり・新車 ---
const opts = { years: 5, annualKm: 10000, fuelPrice: 170, parkingMonthly: 0, insuranceAnnual: 60000, sell: true, buyAge: 0 };
console.log("\n== 5年・1万km/年・売却・新車 年あたりコスト順 ==");
for (const r of calcAll(CARS, opts)) {
  const b = r.breakdown;
  console.log(
    `${r.car.name.padEnd(16, "　")} 総額${man(r.total).padStart(7)} 年${man(r.perYear).padStart(6)} | 減価${man(b.depreciation)} 税${man(b.tax)} 車検${man(b.shaken)} 燃料${man(b.fuel)} 消耗${man(b.consumables)}`
  );
}

// --- 乗りつぶし10年 ---
const opts2 = { ...opts, years: 10, sell: false };
console.log("\n== 10年乗りつぶし 年あたりコスト順(上位5) ==");
for (const r of calcAll(CARS, opts2).slice(0, 5)) console.log(`${r.car.name.padEnd(16, "　")} 年${man(r.perYear)}`);

// --- 中古3年落ち5年 ---
const opts3 = { ...opts, buyAge: 3 };
console.log("\n== 中古3年落ち購入・5年・売却 年あたりコスト順(上位5) ==");
for (const r of calcAll(CARS, opts3).slice(0, 5)) console.log(`${r.car.name.padEnd(16, "　")} 取得${man(r.acquisition)} 売却${man(r.salePrice)} 年${man(r.perYear)}`);

// --- 詳細1件(ジムニー) ---
console.log("\n== ジムニー詳細(5年・売却) ==");
console.log(JSON.stringify(calcTCO(CARS[0], opts), null, 2));
