import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const script = await readFile(new URL("../script_not_minified.js", import.meta.url), "utf8");
const taxBands = JSON.parse(await readFile(new URL("../assets/au_tax_bands_2025_2026.json", import.meta.url), "utf8"));
const stampDuty = JSON.parse(await readFile(new URL("../assets/stampDuty.json", import.meta.url), "utf8"));
const lmiTable = JSON.parse(await readFile(new URL("../assets/lmi_table.json", import.meta.url), "utf8"));
const depTable = JSON.parse(await readFile(new URL("../assets/dependants_cost_table.json", import.meta.url), "utf8"));

const context = {
  Intl,
  Number,
  Math,
  setTimeout: () => {},
  localStorage: {
    getItem: () => null,
    setItem: () => {}
  },
  document: {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({ appendChild: () => {}, set value(_) {}, set textContent(_) {} }),
    head: { appendChild: () => {} },
    body: { classList: { add: () => {}, remove: () => {} } },
    addEventListener: () => {}
  },
  window: {
    addEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {} })
  }
};
context.globalThis = context;
vm.runInNewContext(script, context, { filename: "script_not_minified.js" });

const HLM = context.window.HLM;
context.window.STAMP_DUTY_TABLES = stampDuty;

function approx(actual, expected, tolerance = 1) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

assert.equal(taxBands.financial_year, "2026-2027");
assert.equal(HLM.calculateAnnualTax(18_200, taxBands.brackets), 0);
approx(HLM.calculateAnnualTax(80_000, taxBands.brackets), 14_520, 0.01);
approx(HLM.calculateAnnualTax(150_000, taxBands.brackets), 36_570, 0.01);
approx(HLM.estimateNetAnnualIncome(80_000, taxBands.brackets, false), 65_480, 0.01);
approx(HLM.estimateNetAnnualIncome(80_000, taxBands.brackets, true), 63_880, 0.01);

approx(HLM.monthlyPI(400_000, 5.6, 30), 2296.32, 0.01);
approx(HLM.monthlyIO(400_000, 5.6), 1866.67, 0.01);

const repayment = HLM.amortize({ amount: 400_000, annualRatePct: 5.6, years: 30 });
approx(repayment.perPayment, 2296.32, 0.01);
approx(repayment.totalInterest, 426_674, 200);

const extraRepayment = HLM.amortize({ amount: 400_000, annualRatePct: 5.6, years: 30, extraPerPeriod: 200 });
assert.ok(extraRepayment.schedule.length < repayment.schedule.length);
assert.ok(extraRepayment.totalInterest < repayment.totalInterest);

const noCardCapacity = HLM.maxBorrowing({
  netMonthlyIncome: 6_000,
  monthlyExpenses: 2_500,
  otherMonthlyDebts: 0,
  creditCardLimits: 0,
  annualRatePct: 5.6,
  years: 30,
  bufferPct: 3
});
const cardCapacity = HLM.maxBorrowing({
  netMonthlyIncome: 6_000,
  monthlyExpenses: 2_500,
  otherMonthlyDebts: 0,
  creditCardLimits: 20_000,
  annualRatePct: 5.6,
  years: 30,
  bufferPct: 3
});
assert.ok(cardCapacity < noCardCapacity);

approx(HLM.getStampDuty({ price: 650_000, state: "NSW" }), 23_437, 0.01);
approx(HLM.getStampDuty({ price: 4_000_000, state: "NSW" }), 203_237, 0.01);
approx(HLM.getStampDuty({ price: 650_000, state: "VIC" }), 34_070, 0.01);
approx(HLM.getStampDuty({ price: 1_000_000, state: "VIC" }), 55_000, 0.01);
approx(HLM.getStampDuty({ price: 850_000, state: "QLD" }), 31_275, 0.01);
approx(HLM.getStampDuty({ price: 650_000, state: "SA" }), 29_580, 0.01);
approx(HLM.getStampDuty({ price: 650_000, state: "WA" }), 24_890, 0.01);
approx(HLM.getStampDuty({ price: 650_000, state: "TAS" }), 24_622.5, 0.01);
approx(HLM.getStampDuty({ price: 650_000, state: "ACT" }), 17_880, 0.01);
approx(HLM.getStampDuty({ price: 1_500_000, state: "ACT" }), 68_100, 0.01);
approx(HLM.getStampDuty({ price: 500_000, state: "NT" }), 23_928.6025, 0.01);
approx(HLM.getStampDuty({ price: 650_000, state: "NT" }), 32_175, 0.01);
approx(HLM.getStampDuty({ price: 3_500_000, state: "NT" }), 201_250, 0.01);

const firstHomeDuty = HLM.getStampDutyEstimate({ price: 650_000, state: "NSW", buyerType: "first_home" });
approx(firstHomeDuty.duty, 0, 0.01);
assert.match(firstHomeDuty.note, /NSW first-home buyer estimate/);

const unconfirmedFirstHomeDuty = HLM.getStampDutyEstimate({
  price: 650_000,
  state: "NSW",
  buyerType: "first_home",
  eligibilityConfirmed: false
});
approx(unconfirmedFirstHomeDuty.duty, 23_437, 0.01);
assert.match(unconfirmedFirstHomeDuty.note, /confirm/);

approx(HLM.getStampDutyEstimate({ price: 850_000, state: "NSW", buyerType: "first_home" }).duty, 9_796.75, 0.01);
approx(HLM.getStampDutyEstimate({ price: 990_000, state: "NSW", buyerType: "first_home" }).duty, 37_227.65, 0.01);

const nswFirstHomeAboveThreshold = HLM.getStampDutyEstimate({ price: 1_000_000, state: "NSW", buyerType: "first_home" });
approx(nswFirstHomeAboveThreshold.duty, 39_187, 0.01);
assert.match(nswFirstHomeAboveThreshold.note, /threshold exceeded/);

approx(HLM.getStampDutyEstimate({ price: 1_000_000, state: "NSW", buyerType: "foreign" }).duty, 129_187, 0.01);

approx(HLM.getStampDutyEstimate({ price: 600_000, state: "VIC", buyerType: "first_home" }).duty, 0, 0.01);
approx(HLM.getStampDutyEstimate({ price: 650_000, state: "VIC", buyerType: "first_home" }).duty, 11_356.6667, 0.01);
approx(HLM.getStampDutyEstimate({ price: 750_000, state: "VIC", buyerType: "first_home" }).duty, 40_070, 0.01);

approx(HLM.getStampDutyEstimate({ price: 400_000, state: "VIC", buyerType: "owner_occupier" }).duty, 15_070, 0.01);
approx(HLM.getStampDutyEstimate({ price: 500_000, state: "VIC", buyerType: "owner_occupier" }).duty, 21_970, 0.01);

const foreignDuty = HLM.getStampDutyEstimate({ price: 1_000_000, state: "VIC", buyerType: "foreign" });
approx(foreignDuty.duty, 135_000, 0.01);
assert.match(foreignDuty.note, /8% additional duty/);

const qldFirstHomeDuty = HLM.getStampDutyEstimate({ price: 650_000, state: "QLD", buyerType: "first_home" });
approx(qldFirstHomeDuty.duty, 0, 0.01);
assert.match(qldFirstHomeDuty.note, /QLD first-home buyer estimate/);
approx(HLM.getStampDutyEstimate({ price: 795_000, state: "QLD", buyerType: "first_home" }).duty, 19_890, 0.01);
approx(HLM.getStampDutyEstimate({ price: 950_000, state: "QLD", buyerType: "owner_occupier" }).duty, 28_600, 0.01);
approx(HLM.getStampDutyEstimate({ price: 850_000, state: "QLD", buyerType: "foreign" }).duty, 99_275, 0.01);

const saFirstHomeDuty = HLM.getStampDutyEstimate({ price: 650_000, state: "SA", buyerType: "first_home", propertyType: "new" });
approx(saFirstHomeDuty.duty, 0, 0.01);
assert.match(saFirstHomeDuty.note, /eligible new home/);
const saEstablishedFirstHomeDuty = HLM.getStampDutyEstimate({
  price: 650_000,
  state: "SA",
  buyerType: "first_home",
  propertyType: "established"
});
approx(saEstablishedFirstHomeDuty.duty, 29_580, 0.01);
assert.match(saEstablishedFirstHomeDuty.note, /new home/);
approx(HLM.getStampDutyEstimate({ price: 650_000, state: "SA", buyerType: "foreign" }).duty, 75_080, 0.01);
approx(HLM.getStampDutyEstimate({
  price: 850_000,
  state: "QLD",
  buyerType: "foreign",
  foreignOwnershipShare: 50
}).duty, 65_275, 0.01);

approx(HLM.getStampDutyEstimate({ price: 600_000, state: "WA", buyerType: "first_home" }).duty, 0, 0.01);
approx(HLM.getStampDutyEstimate({ price: 700_000, state: "WA", buyerType: "first_home" }).duty, 16_150, 0.01);
approx(HLM.getStampDutyEstimate({ price: 850_000, state: "WA", buyerType: "first_home" }).duty, 34_890.5, 0.01);
approx(HLM.getStampDutyEstimate({ price: 650_000, state: "WA", buyerType: "foreign" }).duty, 70_390, 0.01);

const tasFirstHomeDuty = HLM.getStampDutyEstimate({ price: 650_000, state: "TAS", buyerType: "first_home" });
approx(tasFirstHomeDuty.duty, 24_622.5, 0.01);
assert.match(tasFirstHomeDuty.note, /ended/);
approx(HLM.getStampDutyEstimate({ price: 650_000, state: "TAS", buyerType: "foreign" }).duty, 76_622.5, 0.01);

approx(HLM.getStampDutyEstimate({ price: 1_500_000, state: "ACT", buyerType: "first_home" }).duty, 0, 0.01);
approx(HLM.getStampDutyEstimate({ price: 650_000, state: "ACT", buyerType: "owner_occupier" }).duty, 14_888, 0.01);
const actForeignDuty = HLM.getStampDutyEstimate({ price: 650_000, state: "ACT", buyerType: "foreign" });
approx(actForeignDuty.duty, 17_880, 0.01);
assert.match(actForeignDuty.note, /does not currently apply/);

const ntFirstHomeDuty = HLM.getStampDutyEstimate({ price: 650_000, state: "NT", buyerType: "first_home" });
approx(ntFirstHomeDuty.duty, 32_175, 0.01);
assert.match(ntFirstHomeDuty.note, /no broad first-home stamp duty concession/);
const ntForeignDuty = HLM.getStampDutyEstimate({ price: 650_000, state: "NT", buyerType: "foreign" });
approx(ntForeignDuty.duty, 32_175, 0.01);
assert.match(ntForeignDuty.note, /does not currently apply/);

assert.equal(HLM.minMonthlyExpenseFor(0, depTable), 2000);
assert.equal(HLM.minMonthlyExpenseFor(8, depTable), 4400);

const lvr = HLM.calcLVR({ price: 650_000, deposit: 130_000 });
approx(lvr.loan, 520_000, 0.01);
approx(lvr.lvr, 0.8, 0.00001);
assert.equal(HLM.estimateLMI({ loan: lvr.loan, lvr: lvr.lvr, lmiTable }), 0);

const highLvr = HLM.calcLVR({ price: 650_000, deposit: 65_000 });
assert.ok(HLM.estimateLMI({ loan: highLvr.loan, lvr: highLvr.lvr, lmiTable }) > 0);

console.log("Calculator tests passed");
