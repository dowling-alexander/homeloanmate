(function (root) {
  function amount(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function percentage(value) {
    return Math.max(0, Math.min(100, amount(value)));
  }

  function calculateGeneralDuty(price, state, tables) {
    const value = amount(price);
    const bands = tables && tables[state];
    if (!bands || !value) return 0;
    let duty = 0;
    let lastMax = 0;
    for (const band of bands) {
      const maximum = band.upTo == null ? Number.POSITIVE_INFINITY : band.upTo;
      if (value <= lastMax) break;
      if (band.formula === "nt_under_525k" && value <= maximum) {
        const thousands = value / 1000;
        return Math.max(0, (0.06571441 * thousands * thousands) + (15 * thousands));
      }
      const taxable = band.wholeValue ? value : Math.min(value, maximum) - (band.over == null ? lastMax : band.over);
      if (taxable > 0) duty = (band.base == null ? duty : band.base) + (taxable * band.rate);
      lastMax = maximum;
    }
    return Math.max(0, duty);
  }

  function qldHomeConcessionDuty(value) {
    if (value <= 350000) return value * 0.01;
    if (value <= 540000) return 3500 + ((value - 350000) * 0.035);
    if (value <= 1000000) return 10150 + ((value - 540000) * 0.045);
    return 30850 + ((value - 1000000) * 0.0575);
  }

  function firstHomeDuty(input, data, dutyTables) {
    const price = amount(input.price);
    const state = input.state || "NSW";
    const generalDuty = calculateGeneralDuty(price, state, dutyTables);
    const rule = data.jurisdictions[state] && data.jurisdictions[state].firstHome;
    if (!input.firstHome) return { duty: generalDuty, generalDuty, concessionApplied: false, note: "General transfer duty estimate." };
    if (input.occupancy !== "owner_occupier") {
      return { duty: generalDuty, generalDuty, concessionApplied: false, note: "General duty shown because first-home duty concessions generally require an owner-occupied purchase." };
    }
    if (!input.eligibilityConfirmed) {
      return { duty: generalDuty, generalDuty, concessionApplied: false, note: "General duty shown until you confirm that you meet the relevant first-home buyer and occupancy requirements." };
    }
    if (!rule || rule.status !== "modelled") {
      return { duty: generalDuty, generalDuty, concessionApplied: false, note: rule ? rule.note : "General duty shown. A first-home concession is not modelled for this state." };
    }
    if (price <= rule.exemptionUpTo) {
      return { duty: 0, generalDuty, concessionApplied: true, note: `Estimated ${state} first-home exemption applied. ${rule.note}` };
    }
    if (state === "NSW" && price < rule.concessionBelow) {
      return { duty: (price - rule.exemptionUpTo) * rule.concessionRate, generalDuty, concessionApplied: true, note: `Estimated NSW first-home concessional duty applied. ${rule.note}` };
    }
    if (state === "VIC" && price <= rule.concessionUpTo) {
      return { duty: generalDuty * ((price - rule.exemptionUpTo) / (rule.concessionUpTo - rule.exemptionUpTo)), generalDuty, concessionApplied: true, note: `Estimated Victorian first-home sliding concession applied. ${rule.note}` };
    }
    if (state === "QLD" && price <= rule.concessionUpTo) {
      const match = rule.concessionBands.find(([limit]) => price < limit);
      const concession = match ? match[1] : 0;
      return { duty: Math.max(0, qldHomeConcessionDuty(price) - concession), generalDuty, concessionApplied: true, note: `Estimated Queensland home and first-home concession applied. ${rule.note}` };
    }
    if (state === "WA" && price <= rule.concessionUpTo) {
      return { duty: (price - rule.exemptionUpTo) * rule.concessionRate, generalDuty, concessionApplied: true, note: `Estimated WA First Home Owner Rate of Duty applied. ${rule.note}` };
    }
    return { duty: generalDuty, generalDuty, concessionApplied: false, note: `General duty shown because the entered price is outside the modelled ${state} first-home concession range. ${rule.note}` };
  }

  function estimateLmi(loan, lvr, table) {
    if (lvr <= 0.8 || !table || !Array.isArray(table.bands)) return 0;
    for (const band of table.bands) {
      if (lvr >= band.min_lvr && lvr < band.max_lvr) {
        for (const rate of band.rates) {
          const maximum = rate.max_loan == null ? Number.POSITIVE_INFINITY : rate.max_loan;
          if (loan >= rate.min_loan && loan < maximum) return loan * rate.rate;
        }
      }
    }
    return 0;
  }

  function calculate(input, data, dutyTables, lmiTable) {
    const price = amount(input.price);
    const deposit = Math.min(price, amount(input.deposit));
    const baseLoan = Math.max(0, price - deposit);
    const baseLvr = price > 0 ? baseLoan / price : 0;
    const lmiTreatment = input.lmiTreatment === "upfront" ? "upfront" : "capitalised";
    let estimatedLmi = estimateLmi(baseLoan, baseLvr, lmiTable);
    let loan = baseLoan;
    if (lmiTreatment === "capitalised" && estimatedLmi > 0) {
      const loanWithLmi = baseLoan + estimatedLmi;
      const lvrWithLmi = price > 0 ? loanWithLmi / price : 0;
      const revisedLmi = estimateLmi(loanWithLmi, lvrWithLmi, lmiTable);
      if (revisedLmi > 0) estimatedLmi = revisedLmi;
      loan = baseLoan + estimatedLmi;
    }
    const lvr = price > 0 ? loan / price : 0;
    const duty = firstHomeDuty(input, data, dutyTables);
    const registrationCosts = amount(input.registrationCosts);
    const otherCosts = amount(input.otherCosts);
    const upfrontLmi = lmiTreatment === "upfront" ? estimatedLmi : 0;
    const totalCashRequired = deposit + duty.duty + registrationCosts + otherCosts + upfrontLmi;
    const savings = amount(input.savings);
    const savingsPosition = savings - totalCashRequired;
    const lmiOutOfRange = baseLvr >= 0.95;
    return {
      price,
      deposit,
      depositPercent: price > 0 ? (deposit / price) * 100 : 0,
      baseLoan,
      loan,
      lvr,
      duty,
      registrationCosts,
      otherCosts,
      estimatedLmi,
      lmiTreatment,
      upfrontLmi,
      capitalisedLmi: lmiTreatment === "capitalised" ? estimatedLmi : 0,
      totalCashRequired,
      savings,
      savingsPosition,
      lmiOutOfRange
    };
  }

  function comparisonRows(input, data, dutyTables, lmiTable) {
    return [5, 10, 20].map((depositPercent) => {
      const result = calculate({ ...input, deposit: amount(input.price) * (depositPercent / 100) }, data, dutyTables, lmiTable);
      return { depositPercent, ...result };
    });
  }

  root.DepositUpfrontCosts = { amount, percentage, calculateGeneralDuty, firstHomeDuty, estimateLmi, calculate, comparisonRows };
})(window);
