(function (root) {
  const FIVE_PERCENT_CAPS = {
    NSW: { capital_regional: 1500000, other: 800000 },
    VIC: { capital_regional: 950000, other: 650000 },
    QLD: { capital_regional: 1000000, other: 700000 },
    WA: { capital_regional: 850000, other: 600000 },
    SA: { capital_regional: 900000, other: 500000 },
    TAS: { capital_regional: 700000, other: 550000 },
    ACT: { capital_regional: 1000000, other: 1000000 },
    NT: { capital_regional: 750000, other: 600000 }
  };

  const HELP_TO_BUY_CAPS = {
    NSW: { capital_regional: 1300000, other: 800000 },
    VIC: { capital_regional: 950000, other: 650000 },
    QLD: { capital_regional: 1000000, other: 700000 },
    WA: { capital_regional: 850000, other: 600000 },
    SA: { capital_regional: 900000, other: 500000 },
    TAS: { capital_regional: 700000, other: 550000 },
    ACT: { capital_regional: 1000000, other: 1000000 },
    NT: { capital_regional: 600000, other: 600000 }
  };

  const HELP_TO_BUY_INCOME_CAPS = {
    single: 103000,
    joint: 165000,
    single_parent: 165000
  };

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function capFor(caps, state, area) {
    const stateCaps = caps[state] || caps.NSW;
    return stateCaps[area] || stateCaps.other;
  }

  function assess(input) {
    const applicantType = input.applicantType || "single";
    const state = input.state || "NSW";
    const area = input.area || "capital_regional";
    const propertyType = input.propertyType || "existing";
    const income = number(input.income);
    const price = number(input.price);
    const deposit = number(input.deposit);
    const bankLoan = number(input.bankLoan);
    const depositRate = price > 0 ? deposit / price : 0;

    const fivePercentMinimumRate = applicantType === "single_parent" ? 0.02 : 0.05;
    const fivePercentCap = capFor(FIVE_PERCENT_CAPS, state, area);
    const fivePercentChecks = {
      price: price > 0 && price <= fivePercentCap,
      deposit: price > 0 && depositRate >= fivePercentMinimumRate
    };

    const helpIncomeCap = HELP_TO_BUY_INCOME_CAPS[applicantType] || HELP_TO_BUY_INCOME_CAPS.single;
    const helpCap = capFor(HELP_TO_BUY_CAPS, state, area);
    const maximumGovernmentRate = propertyType === "new" ? 0.4 : 0.3;
    const governmentContributionNeeded = Math.max(0, price - deposit - bankLoan);
    const maximumGovernmentContribution = price * maximumGovernmentRate;
    const helpChecks = {
      income: income > 0 && income <= helpIncomeCap,
      price: price > 0 && price <= helpCap,
      deposit: price > 0 && depositRate >= 0.02,
      contribution: governmentContributionNeeded > 0 && governmentContributionNeeded <= maximumGovernmentContribution
    };
    const maximumHelpToBuyPrice = Math.min(
      helpCap,
      (deposit + bankLoan) / Math.max(0.01, 1 - maximumGovernmentRate)
    );

    return {
      applicantType,
      propertyType,
      price,
      deposit,
      bankLoan,
      depositRate,
      fivePercent: {
        cap: fivePercentCap,
        minimumDepositRate: fivePercentMinimumRate,
        minimumDeposit: price * fivePercentMinimumRate,
        checks: fivePercentChecks,
        numbersFit: Object.values(fivePercentChecks).every(Boolean)
      },
      helpToBuy: {
        cap: helpCap,
        incomeCap: helpIncomeCap,
        minimumDeposit: price * 0.02,
        maximumGovernmentRate,
        maximumGovernmentContribution,
        governmentContributionNeeded,
        maximumPurchasePrice: Math.max(0, maximumHelpToBuyPrice),
        checks: helpChecks,
        numbersFit: Object.values(helpChecks).every(Boolean)
      }
    };
  }

  root.FirstHomeSchemes = { assess, capFor, FIVE_PERCENT_CAPS, HELP_TO_BUY_CAPS, HELP_TO_BUY_INCOME_CAPS };
})(window);
