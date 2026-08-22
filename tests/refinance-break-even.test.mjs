import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const script = await readFile(new URL("../assets/refinance-break-even.js", import.meta.url), "utf8");
const context = { Math, Number, window: {} };
vm.runInNewContext(script, context, { filename: "refinance-break-even.js" });

const calculator = context.window.RefinanceBreakEven;
const approx = (actual, expected, tolerance = 0.01) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
};

approx(calculator.monthlyPayment(500_000, 6.6, 25), 3407.35);
approx(calculator.monthlyPayment(120_000, 0, 10), 1000);

const lowerRate = calculator.compare({
  balance: 500_000,
  currentRate: 6.6,
  currentTerm: 25,
  currentAnnualFee: 0,
  newRate: 6.1,
  newTerm: 25,
  newAnnualFee: 0,
  switchingCosts: 1200,
  cashback: 0
});
assert.ok(lowerRate.monthlyCashflowChange > 150);
assert.ok(lowerRate.breakEvenMonths !== null && lowerRate.breakEvenMonths < 12);
assert.ok(lowerRate.fiveYear.saving > 0);

const longerTerm = calculator.compare({
  balance: 500_000,
  currentRate: 6.6,
  currentTerm: 25,
  currentAnnualFee: 0,
  newRate: 6.6,
  newTerm: 30,
  newAnnualFee: 0,
  switchingCosts: 0,
  cashback: 0
});
assert.ok(longerTerm.monthlyCashflowChange > 0, "A longer term should lower the immediate repayment");
assert.ok(longerTerm.lifetimeSaving < 0, "A longer term at the same rate should cost more over the life of the loan");

console.log("Refinance break-even tests passed");
