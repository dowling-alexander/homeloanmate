import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const script = await readFile(new URL("../assets/first-home-schemes.js", import.meta.url), "utf8");
const context = { Math, Number, Object, window: {} };
vm.runInNewContext(script, context, { filename: "first-home-schemes.js" });

const calculator = context.window.FirstHomeSchemes;
assert.equal(calculator.capFor(calculator.FIVE_PERCENT_CAPS, "NSW", "capital_regional"), 1500000);
assert.equal(calculator.capFor(calculator.HELP_TO_BUY_CAPS, "NSW", "capital_regional"), 1300000);

const fivePercentEligible = calculator.assess({
  applicantType: "single",
  state: "VIC",
  area: "other",
  propertyType: "existing",
  income: 160000,
  price: 600000,
  deposit: 30000,
  bankLoan: 570000
});
assert.equal(fivePercentEligible.fivePercent.numbersFit, true);
assert.equal(fivePercentEligible.helpToBuy.checks.income, false);

const helpToBuyEligible = calculator.assess({
  applicantType: "single",
  state: "NSW",
  area: "capital_regional",
  propertyType: "existing",
  income: 103000,
  price: 800000,
  deposit: 16000,
  bankLoan: 544000
});
assert.equal(helpToBuyEligible.helpToBuy.numbersFit, true);
assert.equal(helpToBuyEligible.helpToBuy.governmentContributionNeeded, 240000);
assert.equal(helpToBuyEligible.helpToBuy.maximumPurchasePrice, 800000);

const helpToBuyShortfall = calculator.assess({
  applicantType: "single",
  state: "NSW",
  area: "capital_regional",
  propertyType: "existing",
  income: 90000,
  price: 800000,
  deposit: 16000,
  bankLoan: 500000
});
assert.equal(helpToBuyShortfall.helpToBuy.checks.contribution, false);

console.log("First home schemes tests passed");
