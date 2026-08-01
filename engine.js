// TCO計算エンジン(純関数のみ・DOM非依存)

const DEFAULT_SETTINGS = {
  fuelCorrection: 0.85,      // 実燃費 = WLTC × 0.85
  importMaintFactor: 1.5,    // 輸入車の整備費係数
  elecPricePerKwh: 31,       // EVの電気単価(円/kWh)
};

// ---- 税金・法定費用 --------------------------------------------------------

// 自動車税(年額・2019年10月以降の新規登録車の税率)。EVは1,000cc以下区分扱い(25,000円)
function autoTax(cc, isEv) {
  if (isEv) return 25000;
  if (cc <= 660) return 10800;             // 軽自動車税
  if (cc <= 1000) return 25000;
  if (cc <= 1500) return 30500;
  if (cc <= 2000) return 36000;
  if (cc <= 2500) return 43500;
  if (cc <= 3000) return 50000;
  if (cc <= 3500) return 57000;
  if (cc <= 4000) return 65500;
  if (cc <= 4500) return 75500;
  if (cc <= 6000) return 87000;
  return 110000;
}

// 重量税(車検1回=2年分)。軽は定額、普通車は0.5tごと。エコカー減税は半額に簡略化
// carAge: 車検時点の車齢。13年超/18年超で重課(EVは対象外)
function weightTaxPerShaken(weightKg, isKei, ecoFlag, carAge = 0, isEv = false) {
  let base;
  if (isKei) {
    base = !isEv && carAge > 18 ? 8800 : !isEv && carAge > 13 ? 8200 : 6600;
  } else {
    const perHalfTonYear = !isEv && carAge > 18 ? 6300 : !isEv && carAge > 13 ? 5700 : 4100;
    base = Math.ceil(weightKg / 500) * perHalfTonYear * 2;
  }
  return ecoFlag ? Math.round(base / 2) : base;
}

// 自賠責保険料(24ヶ月/36ヶ月・2023年度料率の概算)
const JIBAISEKI = { m24: 17650, m36: 23690, m24kei: 17540, m36kei: 23520 };

// ---- 残価率 ---------------------------------------------------------------

// 車齢yearsAge時点の残価率(%)。0年=100%、3/5/7/10年テーブルの4点線形補間、10年超は年-2pt(下限5%)
function residualRate(resid, yearsAge) {
  if (yearsAge > 10) return Math.max(resid.y10 - 2 * (yearsAge - 10), 5);
  const pts = [
    [0, 100],
    [3, resid.y3],
    [5, resid.y5],
    [7, resid.y7],
    [10, resid.y10],
  ];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (yearsAge <= x1) return y0 + ((y1 - y0) * (yearsAge - x0)) / (x1 - x0);
  }
  return resid.y10;
}

// 走行距離補正: 年1万km基準。総走行が基準を超えた分、1万kmごとに-3pt(下限5%)
function mileageAdjustedRate(rate, totalKm, yearsAge) {
  const excess = totalKm - yearsAge * 10000;
  if (excess <= 0) return Math.max(rate, 5);
  const steps = Math.floor(excess / 10000);
  return Math.max(rate - 3 * steps, 5);
}

// ---- 車検 -----------------------------------------------------------------

// 保有期間中の車検回数(購入時の初回登録分は除く)。新車: 3年目→以降2年ごと。中古: 2年ごと
// 保有終了年ちょうどの車検は受けずに手放す前提で t < years
function shakenYears(years, isUsed) {
  const list = [];
  let t = isUsed ? 2 : 3;
  while (t < years) {
    list.push(t);
    t += 2;
  }
  return list;
}

// ---- 燃料費(購入・リース共通) --------------------------------------------

function fuelCost(car, annualKm, fuelPrice, years, settings = DEFAULT_SETTINGS) {
  if (car.ev) return (annualKm / car.kmPerKwh) * settings.elecPricePerKwh * years;
  const realFuelEcon = car.wltc * settings.fuelCorrection;
  return (annualKm / realFuelEcon) * fuelPrice * years;
}

// ---- リース計算 -----------------------------------------------------------

// params: { monthly(月額円), bonus(ボーナス払い円/回・年2回), years(契約年数),
//           kmLimit(契約走行距離上限km/年), overageRate(超過単価円/km, 既定8),
//           annualKm(実走行km/年),
//           car, fuelPrice, insuranceAnnual, parkingMonthly (実質総額の算出用) }
// リースは税金・車検・自賠責込み/任意保険・駐車場・燃料は別、が一般的な契約。
// 満了時に車は返却されるため資産は0円。
function calcLease(params, settings = DEFAULT_SETTINGS) {
  const { monthly, bonus = 0, years, kmLimit, overageRate = 8, annualKm, car, insuranceAnnual = 0, parkingMonthly = 0 } = params;
  const overage = Math.max(0, annualKm - kmLimit) * overageRate * years;
  const leaseTotal = monthly * 12 * years + bonus * 2 * years + overage;
  const fuelPrice = car && car.fuelPrice != null ? car.fuelPrice : params.fuelPrice;
  const fuel = car ? fuelCost(car, annualKm, fuelPrice, years, settings) : 0;
  const effectiveTotal = leaseTotal + insuranceAnnual * years + parkingMonthly * 12 * years + fuel;
  return {
    leaseTotal: Math.round(leaseTotal),
    overage: Math.round(overage),
    fuel: Math.round(fuel),
    effectiveTotal: Math.round(effectiveTotal),
  };
}

// ---- メイン計算 -----------------------------------------------------------

// car: data.jsの1要素
// opts: { years, annualKm, fuelPrice, parkingMonthly, insuranceAnnual, sell(bool), buyAge(購入時車齢: 0=新車) }
function calcTCO(car, opts, settings = DEFAULT_SETTINGS) {
  const { years, annualKm, parkingMonthly, insuranceAnnual, sell } = opts;
  const buyAge = opts.buyAge || 0;
  const used = buyAge > 0;
  const fuelPrice = car.fuelPrice != null ? car.fuelPrice : opts.fuelPrice;
  const isKei = !car.ev && car.cc <= 660; // EVはcc:0でも軽扱いにしない
  const maintFactor = car.import ? settings.importMaintFactor : 1;

  // 取得価格
  //  新車 = 新車価格 - 値引き相場
  //  中古 = 新車価格 × 購入時車齢の残価率(買取ベース) × 店頭マージン係数
  //  売却側は買取ベース残価率のまま(マージン係数は掛けない)
  const usedMargin = typeof USED_MARGIN !== "undefined" ? USED_MARGIN : 1.15;
  const acquisition = used
    ? car.price * (residualRate(car.resid, buyAge) / 100) * usedMargin
    : car.price - (car.discount || 0);

  // 売却価格(車齢 = 購入時車齢 + 保有年数)
  const carAgeAtSale = years + buyAge;
  const totalKmOnCar = annualKm * years + buyAge * 10000; // 中古は前オーナー年1万km想定
  let salePrice = 0;
  if (sell) {
    let rate = residualRate(car.resid, carAgeAtSale);
    rate = mileageAdjustedRate(rate, totalKmOnCar, carAgeAtSale);
    salePrice = car.price * (rate / 100);
  }

  // 自動車税(初度登録13年超は15%重課。EVは対象外)。保有t年目の車齢 = 中古なら+3
  const taxBase = autoTax(car.cc, !!car.ev);
  let taxTotal = 0;
  const ageOffset = buyAge;
  for (let t = 1; t <= years; t++) {
    const carAge = ageOffset + t;
    taxTotal += !car.ev && carAge > 13 ? taxBase * 1.15 : taxBase;
  }

  // 車検(重量税+自賠責は購入時の初回分も payment としてカウント)
  const shakens = shakenYears(years, used);
  const initialJibai = used ? (isKei ? JIBAISEKI.m24kei : JIBAISEKI.m24) : (isKei ? JIBAISEKI.m36kei : JIBAISEKI.m36);
  const perShakenJibai = isKei ? JIBAISEKI.m24kei : JIBAISEKI.m24;
  // 重量税は車検時点の車齢で重課判定(新車初回=車齢0で3年分、中古初回=車齢3)
  const wtInitial = used
    ? weightTaxPerShaken(car.weight, isKei, !!car.eco, buyAge, !!car.ev)
    : Math.round(weightTaxPerShaken(car.weight, isKei, !!car.eco, 0, !!car.ev) * 1.5);
  const wtShakens = shakens.reduce(
    (sum, t) => sum + weightTaxPerShaken(car.weight, isKei, !!car.eco, ageOffset + t, !!car.ev),
    0
  );
  const legalTotal = wtInitial + initialJibai + wtShakens + shakens.length * perShakenJibai;

  // 車検整備費(法定費用除く)
  const maintBase = isKei ? 40000 : car.import ? 90000 : 60000;
  const shakenMaint = shakens.length * maintBase * maintFactor;

  // 燃料費(EVは電費×電気単価、それ以外はWLTC×補正×燃料単価)
  const fuelTotal = fuelCost(car, annualKm, fuelPrice, years, settings);

  // 任意保険・駐車場
  const insuranceTotal = insuranceAnnual * years;
  const parkingTotal = parkingMonthly * 12 * years;

  // 消耗品: タイヤ(4万kmごと・距離比例)+ オイル等(年15,000円、輸入車は係数)
  const ownKm = annualKm * years;
  const tireUnit = isKei ? 40000 : car.import ? 100000 : 60000;
  const tireTotal = (ownKm / 40000) * tireUnit;
  const oilTotal = 15000 * maintFactor * years;
  const consumableTotal = tireTotal + oilTotal;

  const depreciation = acquisition - salePrice;
  const total =
    depreciation + taxTotal + legalTotal + shakenMaint + fuelTotal + insuranceTotal + parkingTotal + consumableTotal;

  return {
    car,
    acquisition: Math.round(acquisition),
    salePrice: Math.round(salePrice),
    breakdown: {
      depreciation: Math.round(depreciation),
      tax: Math.round(taxTotal),
      shaken: Math.round(legalTotal + shakenMaint),
      fuel: Math.round(fuelTotal),
      insurance: Math.round(insuranceTotal),
      parking: Math.round(parkingTotal),
      consumables: Math.round(consumableTotal),
    },
    total: Math.round(total),
    perYear: Math.round(total / years),
    shakenCount: shakens.length,
  };
}

function calcAll(cars, opts, settings = DEFAULT_SETTINGS) {
  return cars.map((c) => calcTCO(c, opts, settings)).sort((a, b) => a.perYear - b.perYear);
}

if (typeof module !== "undefined") {
  module.exports = { calcTCO, calcAll, calcLease, fuelCost, autoTax, weightTaxPerShaken, residualRate, mileageAdjustedRate, shakenYears, DEFAULT_SETTINGS };
}
