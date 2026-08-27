import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const [script, dataText, dutyText, lmiText] = await Promise.all([
  readFile(new URL("../assets/deposit-upfront-costs.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/property_purchase_costs_2026.json", import.meta.url), "utf8"),
  readFile(new URL("../assets/stampDuty.json", import.meta.url), "utf8"),
  readFile(new URL("../assets/lmi_table.json", import.meta.url), "utf8")
]);
const context = { Math, Number, Infinity, window: {} };
vm.runInNewContext(script, context, { filename: "deposit-upfront-costs.js" });

const calculator = context.window.DepositUpfrontCosts;
const data = JSON.parse(dataText);
const dutyTables = JSON.parse(dutyText);
const lmiTable = JSON.parse(lmiText);
const approx = (actual, expected, tolerance = 0.01) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
};

const baseInput = {
  price: 650_000,
  state: "NSW",
  occupancy: "owner_occupier",
  firstHome: false,
  eligibilityConfirmed: false,
  deposit: 130_000,
  savings: 160_000,
  otherCosts: 3_000,
  registrationCosts: 0,
  lmiTreatment: "capitalised"
};

const twentyPercent = calculator.calculate(baseInput, data, dutyTables, lmiTable);
approx(twentyPercent.deposit, 130_000);
approx(twentyPercent.baseLoan, 520_000);
approx(twentyPercent.lvr, 0.8);
approx(twentyPercent.estimatedLmi, 0);
approx(twentyPercent.duty.duty, 23_437);
approx(twentyPercent.totalCashRequired, 156_437);
approx(twentyPercent.savingsPosition, 3_563);

const upfrontLmi = calculator.calculate({ ...baseInput, deposit: 65_000, savings: 70_000, lmiTreatment: "upfront" }, data, dutyTables, lmiTable);
assert.ok(upfrontLmi.estimatedLmi > 0, "A 90% LVR scenario should estimate LMI");
approx(upfrontLmi.loan, upfrontLmi.baseLoan);
approx(upfrontLmi.upfrontLmi, upfrontLmi.estimatedLmi);
assert.ok(upfrontLmi.totalCashRequired > upfrontLmi.deposit + upfrontLmi.duty.duty + upfrontLmi.otherCosts);
assert.ok(upfrontLmi.savingsPosition < 0, "The low-savings scenario should show a shortfall");

const capitalisedLmi = calculator.calculate({ ...baseInput, deposit: 65_000, lmiTreatment: "capitalised" }, data, dutyTables, lmiTable);
assert.ok(capitalisedLmi.loan > capitalisedLmi.baseLoan, "Capitalised LMI should be included in the loan");
approx(capitalisedLmi.upfrontLmi, 0);

const nswFirstHome = calculator.firstHomeDuty({ ...baseInput, firstHome: true, eligibilityConfirmed: true }, data, dutyTables);
approx(nswFirstHome.duty, 0);
assert.equal(nswFirstHome.concessionApplied, true);
const unconfirmedFirstHome = calculator.firstHomeDuty({ ...baseInput, firstHome: true, eligibilityConfirmed: false }, data, dutyTables);
approx(unconfirmedFirstHome.duty, 23_437);
assert.equal(unconfirmedFirstHome.concessionApplied, false);

const victoriaConcession = calculator.firstHomeDuty({ ...baseInput, price: 650_000, state: "VIC", firstHome: true, eligibilityConfirmed: true }, data, dutyTables);
approx(victoriaConcession.generalDuty, 34_070);
approx(victoriaConcession.duty, 11_356.666666666666, 0.02);
const queenslandConcession = calculator.firstHomeDuty({ ...baseInput, price: 730_000, state: "QLD", firstHome: true, eligibilityConfirmed: true }, data, dutyTables);
approx(queenslandConcession.duty, 6_555);
const westernAustraliaConcession = calculator.firstHomeDuty({ ...baseInput, price: 700_000, state: "WA", firstHome: true, eligibilityConfirmed: true }, data, dutyTables);
approx(westernAustraliaConcession.duty, 16_150);

for (const state of ["SA", "TAS", "ACT", "NT"]) {
  const estimate = calculator.firstHomeDuty({ ...baseInput, state, firstHome: true, eligibilityConfirmed: true }, data, dutyTables);
  approx(estimate.duty, estimate.generalDuty);
  assert.equal(estimate.concessionApplied, false, `${state} should retain a conservative general-duty estimate`);
}

const comparisons = calculator.comparisonRows(baseInput, data, dutyTables, lmiTable);
assert.deepEqual(Array.from(comparisons, (row) => row.depositPercent), [5, 10, 20]);
approx(comparisons[0].deposit, 32_500);
approx(comparisons[1].deposit, 65_000);
approx(comparisons[2].deposit, 130_000);

console.log("Deposit and upfront cost tests passed");
