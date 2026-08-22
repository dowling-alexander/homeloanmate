(function (root) {
  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function monthlyPayment(balance, annualRatePct, years) {
    const principal = Math.max(0, number(balance));
    const months = Math.max(1, Math.round(number(years) * 12));
    const monthlyRate = Math.max(0, number(annualRatePct)) / 1200;
    if (monthlyRate === 0) return principal / months;
    return principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
  }

  function loanPosition(balance, annualRatePct, years, monthsElapsed) {
    const principal = Math.max(0, number(balance));
    const termMonths = Math.max(1, Math.round(number(years) * 12));
    const elapsedMonths = Math.max(0, Math.min(termMonths, Math.floor(number(monthsElapsed))));
    const monthlyRate = Math.max(0, number(annualRatePct)) / 1200;
    const payment = monthlyPayment(principal, annualRatePct, years);
    let remaining = principal;
    let totalPaid = 0;

    for (let month = 0; month < elapsedMonths && remaining > 0.005; month += 1) {
      const interest = remaining * monthlyRate;
      const amountPaid = Math.min(payment, remaining + interest);
      totalPaid += amountPaid;
      remaining = Math.max(0, remaining + interest - amountPaid);
    }

    return { payment, remaining, totalPaid, elapsedMonths, termMonths };
  }

  function totalLoanInterest(balance, annualRatePct, years) {
    const position = loanPosition(balance, annualRatePct, years, Math.round(number(years) * 12));
    return Math.max(0, position.totalPaid - Math.max(0, number(balance)));
  }

  function compare(inputs) {
    const balance = Math.max(0, number(inputs.balance));
    const currentTerm = Math.max(1, number(inputs.currentTerm));
    const newTerm = Math.max(1, number(inputs.newTerm));
    const currentAnnualFee = Math.max(0, number(inputs.currentAnnualFee));
    const newAnnualFee = Math.max(0, number(inputs.newAnnualFee));
    const netSwitchingCost = Math.max(0, number(inputs.switchingCosts)) - Math.max(0, number(inputs.cashback));

    const current = loanPosition(balance, inputs.currentRate, currentTerm, 0);
    const proposed = loanPosition(balance, inputs.newRate, newTerm, 0);

    function costAt(months) {
      const currentPosition = loanPosition(balance, inputs.currentRate, currentTerm, months);
      const proposedPosition = loanPosition(balance, inputs.newRate, newTerm, months);
      const currentFees = currentAnnualFee * Math.min(months, currentPosition.termMonths) / 12;
      const proposedFees = newAnnualFee * Math.min(months, proposedPosition.termMonths) / 12;
      const stayCost = currentPosition.totalPaid + currentPosition.remaining + currentFees;
      const refinanceCost = proposedPosition.totalPaid + proposedPosition.remaining + proposedFees + netSwitchingCost;

      return {
        months,
        saving: stayCost - refinanceCost,
        currentBalance: currentPosition.remaining,
        proposedBalance: proposedPosition.remaining
      };
    }

    const maximumMonths = Math.max(current.termMonths, proposed.termMonths);
    let breakEvenMonths = null;
    for (let month = 0; month <= maximumMonths; month += 1) {
      if (costAt(month).saving >= -0.005) {
        breakEvenMonths = month;
        break;
      }
    }

    const currentLifetimeCost = totalLoanInterest(balance, inputs.currentRate, currentTerm) + currentAnnualFee * currentTerm;
    const proposedLifetimeCost = totalLoanInterest(balance, inputs.newRate, newTerm) + newAnnualFee * newTerm + netSwitchingCost;

    return {
      currentPayment: current.payment,
      proposedPayment: proposed.payment,
      monthlyCashflowChange: (current.payment + currentAnnualFee / 12) - (proposed.payment + newAnnualFee / 12),
      netSwitchingCost,
      breakEvenMonths,
      currentLifetimeCost,
      proposedLifetimeCost,
      lifetimeSaving: currentLifetimeCost - proposedLifetimeCost,
      oneYear: costAt(12),
      twoYear: costAt(24),
      fiveYear: costAt(60)
    };
  }

  root.RefinanceBreakEven = { monthlyPayment, loanPosition, totalLoanInterest, compare };
})(window);
