/* HomeLoanMate consolidated script */
/* Utilities */
function roundToStep(value, step) { return Math.round(value / step) * step; }
function ensureInterestStep(val) { const s = roundToStep(parseFloat(val||0), 0.05); return parseFloat(s.toFixed(2)); }
function formatAUD(val) {
  return (val||0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 });
}

/* Sticky Summary */
function updateStickySummary(opts){
  try{
    const bar = document.getElementById('stickySummary');
    if(!bar) return;
    const l1 = document.getElementById('stickyLine1');
    const l2 = document.getElementById('stickyLine2');
    const cta = document.getElementById('stickyCta');
    if(!opts){ bar.hidden = true; return; }
    if(l1) l1.innerHTML = opts.line1 || '';
    if(l2) l2.innerHTML = opts.line2 || '';
    if(cta && opts.ctaHref) cta.href = opts.ctaHref;
    bar.hidden = false;
  }catch(e){}
}

function __sFmtAUD(x){
  try { return (x||0).toLocaleString('en-AU', {style:'currency',currency:'AUD',maximumFractionDigits:0}); }
  catch(e){ return '$' + Math.round(x||0).toLocaleString(); }
}

function updateStickyBudgetBar({ monthlyIncome, monthlyExpenses, repayment }){
  const remaining = Math.max(0, (monthlyIncome||0) - (monthlyExpenses||0) - (repayment||0));
  const shortfall = Math.max(0, -((monthlyIncome||0) - (monthlyExpenses||0) - (repayment||0)));

  // scale segments against income (or sum if income is 0)
  const base = Math.max(1, monthlyIncome || (monthlyExpenses + repayment + remaining));

  const pctRepay = Math.min(100, Math.max(0, (repayment / base) * 100));
  const pctExp   = Math.min(100, Math.max(0, (monthlyExpenses / base) * 100));
  const pctLeft  = Math.min(100, Math.max(0, (remaining / base) * 100));
  const pctShort = Math.min(100, Math.max(0, (shortfall / base) * 100));

  const segRepay = document.getElementById('sSegRepay');
  const segExp   = document.getElementById('sSegExp');
  const segLeft  = document.getElementById('sSegLeft');
  const segShort = document.getElementById('sSegShort');
  const sAmtRepay= document.getElementById('sAmtRepay');
  const sAmtExp  = document.getElementById('sAmtExp');
  const sAmtLeft = document.getElementById('sAmtLeft');
  const sShortWrap=document.getElementById('sShortWrap');
  const sAmtShort= document.getElementById('sAmtShort');

  if (!segRepay || !segExp || !segLeft) return; // not on this page / not rendered

  segRepay.style.width = pctRepay + '%';
  segExp.style.width   = pctExp + '%';
  segLeft.style.width  = pctLeft + '%';
  segShort.style.width = pctShort + '%';
  segShort.style.display = pctShort > 0 ? 'block' : 'none';

  if (sAmtRepay) sAmtRepay.textContent = __sFmtAUD(repayment);
  if (sAmtExp)   sAmtExp.textContent   = __sFmtAUD(monthlyExpenses);
  if (sAmtLeft)  sAmtLeft.textContent  = __sFmtAUD(remaining);

  if (sShortWrap){
    if (pctShort > 0){
      sShortWrap.style.display = '';
      if (sAmtShort) sAmtShort.textContent = __sFmtAUD(shortfall);
    } else {
      sShortWrap.style.display = 'none';
    }
  }
}


/* Charts (Borrowing Power page) */
let borrowingChart=null, repaymentChart=null;
function initBorrowingCharts(){
  const ctx1 = document.getElementById('borrowingChart')?.getContext('2d');
  const ctx2 = document.getElementById('repaymentChart')?.getContext('2d');
  if (ctx1 && !borrowingChart){
    borrowingChart = new Chart(ctx1, {
      type: 'bar',
      data: { labels: ['Borrowing Power','With Buffer'], datasets: [{ data: [0,0] }] },
      options: { responsive: true, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } }
    });
  }
  if (ctx2 && !repaymentChart){
    repaymentChart = new Chart(ctx2, {
      type: 'bar',
      data: { labels: ['P&I','Interest Only'], datasets: [{ data: [0,0] }] },
      options: { responsive: true, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } }
    });
  }
}
function updateBorrowingCharts(bp, bpBuffer, piMonthly, ioMonthly){
  if (borrowingChart){ borrowingChart.data.datasets[0].data = [bp, bpBuffer]; borrowingChart.update(); }
  if (repaymentChart){ repaymentChart.data.datasets[0].data = [piMonthly, ioMonthly]; repaymentChart.update(); }
}

//2024 tax table, need to revisit this in one year
const TAX_TABLE_AU_2024 = [
  { upto: 18200,  rate: 0.00, baseAt: 0,     baseTax: 0 },
  { upto: 45000,  rate: 0.16, baseAt: 18200, baseTax: 0 },
  { upto: 135000, rate: 0.30, baseAt: 45000, baseTax: (45000-18200)*0.16 },
  { upto: 190000, rate: 0.37, baseAt: 135000,baseTax: (45000-18200)*0.16 + (135000-45000)*0.30 },
  { upto: Infinity, rate: 0.45, baseAt: 190000, baseTax:
      (45000-18200)*0.16 + (135000-45000)*0.30 + (190000-135000)*0.37 }
];

// Progressive tax on taxable income
function calcIncomeTaxAU(annual, table = TAX_TABLE_AU_2024){
  const y = Math.max(0, Number(annual) || 0);
  for (const b of table){
    if (y <= b.upto){
      return b.baseTax + Math.max(0, y - b.baseAt) * b.rate;
    }
  }
  return 0;
}

// Simple Medicare levy (2% flat). Set to false below if you don't want to include it.
function calcMedicareLevy(annual, include = true){
  if (!include) return 0;
  const y = Math.max(0, Number(annual) || 0);
  return y * 0.02; // (basic approximation; thresholds/phase-ins can be added if needed)
}

function netAnnualIncomeAU(annual, { includeMedicare = true } = {}){
  const tax  = calcIncomeTaxAU(annual);
  const levy = calcMedicareLevy(annual, includeMedicare);
  return Math.max(0, (Number(annual) || 0) - tax - levy);
}






/* Borrowing Power page logic */
function bindBorrowingPower(){
  const incomeSlider = document.getElementById('incomeSlider');
  const incomeInput = document.getElementById('incomeInput');
  const expensesSlider = document.getElementById('expensesSlider');
  const expensesInput = document.getElementById('expensesInput');
  const interestSlider = document.getElementById('interestSlider');
  const interestInput = document.getElementById('interestInput');
  const termSlider = document.getElementById('termSlider');
  const termInput = document.getElementById('termInput');
  const bufferToggle = document.getElementById('bufferToggle');
  const resultsDiv = document.getElementById('results');

  if(!incomeSlider || !incomeInput || !resultsDiv) return; // not on this page

  const syncInputs = (slider, input, isDecimal=false) => {
    if(!slider || !input) return;
    slider.addEventListener('input', () => {
      input.value = isDecimal ? ensureInterestStep(slider.value).toFixed(2) : slider.value;
      calculateBorrowing();
    });
    input.addEventListener('input', () => {
      slider.value = input.value;
      calculateBorrowing();
    });
  };

  // Interest snapping
  if (interestSlider) { interestSlider.step = 0.05; }
  interestSlider?.addEventListener('change', ()=>{
    const snapped = ensureInterestStep(interestSlider.value||0);
    interestSlider.value = snapped;
    if (interestInput) interestInput.value = snapped.toFixed(2);
    calculateBorrowing();
  });
  interestInput?.addEventListener('change', ()=>{
    const snapped = ensureInterestStep(interestInput.value||0);
    interestInput.value = snapped.toFixed(2);
    if (interestSlider) interestSlider.value = snapped;
    calculateBorrowing();
  });

  // Wire pairs
  syncInputs(incomeSlider, incomeInput);
  syncInputs(expensesSlider, expensesInput);
  syncInputs(interestSlider, interestInput, true);
  syncInputs(termSlider, termInput);

function calculateBorrowing(){
  // income input is ANNUAL; expenses are MONTHLY
  const income = parseFloat(incomeInput.value || '0');
// Net (after-tax) income per month
  const netAnnual      = netAnnualIncomeAU(income, { includeMedicare: true });
  const monthlyIncome  = Math.max(0, netAnnual / 12);
  const monthlyExpenses = Math.max(0, parseFloat(expensesInput.value || '0'));
  const interest = ensureInterestStep(interestInput.value || 0);
  const years = parseFloat(termInput.value || '30');
  const buffer = !!(bufferToggle && bufferToggle.checked);

  const monthlyRate = (interest / 100) / 12;
  const n = years * 12;
  const affordable = Math.max(0, monthlyIncome - monthlyExpenses);

  let borrowingPower = 0;
  if (monthlyRate > 0 && n > 0){
    const f = Math.pow(1 + monthlyRate, n);
    const paymentFactor = (monthlyRate * f) / (f - 1);
    borrowingPower = affordable / paymentFactor;
  } else {
    // 0% fallback: payment * months
    borrowingPower = affordable * n;
  }

  const borrowingPowerWithBuffer = borrowingPower * 0.97;

  // Repayments derived from the same principal
  const f = Math.pow(1 + monthlyRate, n);
  const paymentFactor = (monthlyRate > 0 && n > 0) ? (monthlyRate * f) / (f - 1) : 0;
  const piMonthly = (monthlyRate > 0 && n > 0) ? (borrowingPower * paymentFactor)
                                               : (n > 0 ? borrowingPower / n : affordable);
  const ioMonthly = borrowingPower * monthlyRate;

  if (resultsDiv) {
    resultsDiv.innerHTML =
      `Borrowing Power: $${borrowingPower.toFixed(0)}<br />
       Borrowing Power (With Buffer): $${borrowingPowerWithBuffer.toFixed(0)}<br />
       Monthly Repayment (P&I): $${piMonthly.toFixed(0)}<br />
       Monthly Repayment (Interest Only): $${ioMonthly.toFixed(0)}`;
  }

  // keep if you still have the old charts; otherwise delete this line
  if (typeof updateBorrowingCharts === 'function') {
    updateBorrowingCharts(borrowingPower, borrowingPowerWithBuffer, piMonthly, ioMonthly);
  }

  if (typeof updateStickySummary === 'function') {
    updateStickySummary({
      line1: `Borrowing Power: $${borrowingPower.toFixed(0)}`,
      line2: `P&I est: $${piMonthly.toFixed(0)}`
    });
  }

  // NEW: sticky mini “budget bar”
  if (typeof updateStickyBudgetBar === 'function') {
    updateStickyBudgetBar({
      monthlyIncome,
      monthlyExpenses,
      repayment: piMonthly
    });
  }
}

  initBorrowingCharts();
  calculateBorrowing();
}

/* State-based Stamp Duty */
function calculateStampDuty(price, state){ return 0; }
// Alias for estimator module
function calcStampDuty(amount, state){ return calculateStampDuty(amount, state); }

/* Repayment Estimator */
(function(){
  function monthlyRepayment(P, annualRatePct, years){
    const r = (annualRatePct/100)/12;
    const n = years * 12;
    if (r === 0) return P / (n||1);
    const f = Math.pow(1+r, n);
    return P * (r * f) / (f - 1);
  }
  function bindSync(rangeEl, numberEl, maxFn=null, isInterest=false){
    if(!rangeEl || !numberEl) return;
    const snap = v => isInterest ? ensureInterestStep(parseFloat(v||0)) : Number(v||0);
    rangeEl.addEventListener('input', () => {
      let v = snap(rangeEl.value);
      if (maxFn) v = Math.min(v, maxFn());
      numberEl.value = isInterest ? v.toFixed(2) : v;
    });
    numberEl.addEventListener('input', () => {
      let v = snap(numberEl.value);
      if (maxFn) v = Math.min(v, maxFn());
      numberEl.value = isInterest ? v.toFixed(2) : v;
      rangeEl.value = v;
    });
    if (isInterest){
      [rangeEl, numberEl].forEach(el => el.addEventListener('change', () => {
        const v = snap(el.value);
        rangeEl.value = v;
        numberEl.value = v.toFixed(2);
      }));
    }
  }
  function initRepaymentEstimator(){
    const form = document.getElementById('loan-form');
    const resultDiv = document.getElementById('result');
    const housePrice = document.getElementById('housePrice');
    const housePriceInput = document.getElementById('housePriceInput');
    const deposit = document.getElementById('deposit');
    const depositInput = document.getElementById('depositInput');
    const income = document.getElementById('income');
    const incomeInput = document.getElementById('incomeInput');
    const expenses = document.getElementById('expenses');
    const expensesInput = document.getElementById('expensesInput');
    const interestRate = document.getElementById('interestRate');
    const interestRateInput = document.getElementById('interestRateInput');
    const loanTerm = document.getElementById('loanTerm');
    const loanTermInput = document.getElementById('loanTermInput');
    const stateSelect = document.getElementById('state');
    const chartCanvas = document.getElementById('estimatorChart');
    const ctx = chartCanvas ? chartCanvas.getContext('2d') : null;
    let chart;
    if(!form) return;
    const houseVal = () => Number(housePriceInput?.value || housePrice?.value || 0);
    bindSync(housePrice, housePriceInput);
    bindSync(deposit, depositInput, houseVal);
    bindSync(income, incomeInput);
    bindSync(expenses, expensesInput);
    bindSync(interestRate, interestRateInput, null, true);
    bindSync(loanTerm, loanTermInput);
    function drawChart(repay, incomeAfter){
      if (!ctx || typeof Chart === 'undefined') return;
      if (chart) chart.destroy();
      chart = new Chart(ctx, {
        type: 'bar',
        data: { labels: ['Repayment','Income After Expenses'], datasets: [{ label:'Monthly Amount (AUD)', data:[repay, incomeAfter] }] },
        options: { responsive: true, plugins: { legend: { display:false } }, scales: { y: { beginAtZero: true } } }
      });
    }
    function recompute(e){
      if(e) e.preventDefault();
      const hp = Number(housePriceInput?.value||housePrice?.value||0);
      const dp = Math.min(Number(depositInput?.value||deposit?.value||0), hp);
      const inc = Number(incomeInput?.value||income?.value||0);
      const exp = Number(expensesInput?.value||expenses?.value||0);
      const rate = ensureInterestStep(Number(interestRateInput?.value||interestRate?.value||0));
      const years = Number(loanTermInput?.value||loanTerm?.value||30);
      const state = (stateSelect && stateSelect.value) || 'NSW';
      const loanAmount = Math.max(0, hp - dp);
      const stampDuty = typeof calcStampDuty==='function' ? calcStampDuty(hp, state) : 0;
      const lvr = loanAmount / (hp||1);
      const lmi = lvr > 0.8 ? loanAmount * 0.02 : 0;
      const monthly = monthlyRepayment(loanAmount + lmi + stampDuty, rate, years);
      const after = Math.max(0, (inc/12) - exp);
      const affordability = monthly <= after;
      if (resultDiv){
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <h2>Estimate Summary</h2>
          <p><strong>Loan Amount:</strong> ${ (loanAmount).toLocaleString('en-AU', {style:'currency', currency:'AUD'}) }</p>
          <p><strong>Stamp Duty (${state}):</strong> ${ (stampDuty).toLocaleString('en-AU', {style:'currency', currency:'AUD'}) }</p>
          <p><strong>Loan Mortgage Insurance (LMI):</strong> ${ (lmi).toLocaleString('en-AU', {style:'currency', currency:'AUD'}) }</p>
          <p><strong>Estimated Monthly Repayment:</strong> ${ (monthly).toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) }</p>
          <p><strong>Monthly Income after Expenses:</strong> ${ (after).toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) }</p>
          ${ affordability ? '<p style="color:green;"><strong>Looks affordable.</strong></p>' : '<p style="color:#b22;"><strong>Warning:</strong> Repayments exceed income after expenses.</p>' }
        `;
      }
      if (typeof updateStickySummary==='function') updateStickySummary({ line1:`Monthly Repayment: $${monthly.toFixed(0)}`, line2:`Income after: $${after.toFixed(0)}` });
      drawChart(monthly, after);
    }
    form.addEventListener('submit', recompute);
    ['input','change'].forEach(ev => form.addEventListener(ev, recompute));
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn){
      submitBtn.addEventListener('click', (e)=>{ e.preventDefault(); const evt=new Event('submit',{cancelable:true}); form.dispatchEvent(evt); });
    }
    recompute();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRepaymentEstimator);
  } else {
    initRepaymentEstimator();
  }
})();

// Bootstraps for Borrowing Power
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindBorrowingPower);
} else {
  bindBorrowingPower();
}
