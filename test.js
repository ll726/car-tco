// 計算エンジンのコンソール検証: node test.js
const { CARS } = require("./data.js");
const { calcAll, calcTCO, autoTax, weightTaxPerShaken, residualRate, mileageAdjustedRate, shakenYears } = require("./engine.js");

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
  const o = { years: 5, annualKm: 10000, fuelPrice: 170, parkingMonthly: 0, insuranceAnnual: 60000, sell: true, used: true };
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
  const base = { years: 5, annualKm: 10000, parkingMonthly: 0, insuranceAnnual: 60000, sell: true, used: false };
  const r170 = calcTCO(lc, { ...base, fuelPrice: 170 });
  const r200 = calcTCO(lc, { ...base, fuelPrice: 200 });
  console.assert(r170.breakdown.fuel === r200.breakdown.fuel, "LC250の燃料費はopts.fuelPriceに依存しない");
  const expectedFuel = Math.round((10000 / (11.0 * 0.85)) * 150 * 5);
  console.assert(r170.breakdown.fuel === expectedFuel, "LC250の燃料費=軽油150円/Lで計算");
  // 対照: 上書きの無い車は単価変更が反映される
  const yaris = CARS.find((c) => c.id === "yaris");
  console.assert(calcTCO(yaris, { ...base, fuelPrice: 170 }).breakdown.fuel !== calcTCO(yaris, { ...base, fuelPrice: 200 }).breakdown.fuel, "通常車は単価変更が反映");
}

console.log("assert完了(エラー表示が無ければOK)");

// --- 標準条件: 5年・年1万km・売却あり・新車 ---
const opts = { years: 5, annualKm: 10000, fuelPrice: 170, parkingMonthly: 0, insuranceAnnual: 60000, sell: true, used: false };
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
const opts3 = { ...opts, used: true };
console.log("\n== 中古3年落ち購入・5年・売却 年あたりコスト順(上位5) ==");
for (const r of calcAll(CARS, opts3).slice(0, 5)) console.log(`${r.car.name.padEnd(16, "　")} 取得${man(r.acquisition)} 売却${man(r.salePrice)} 年${man(r.perYear)}`);

// --- 詳細1件(ジムニー) ---
console.log("\n== ジムニー詳細(5年・売却) ==");
console.log(JSON.stringify(calcTCO(CARS[0], opts), null, 2));
