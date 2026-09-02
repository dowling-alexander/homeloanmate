(function(){
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', 'G-GKLL8W3BP2');
  window.trackBorrowPowerEvent = function(name, params) {
    window.gtag('event', name, params || {});
  };

  const AUD = new Intl.NumberFormat('en-AU',{style:'currency', currency:'AUD', maximumFractionDigits:0});
  const PCT = n => (n*100).toFixed(2)+'%';
  const clamp = (v,min,max)=>Math.max(min, Math.min(max, v));
  const toNumber = v => isNaN(+v) ? 0 : +v;
  const trackEvent = (name, params={}) => window.trackBorrowPowerEvent?.(name, params);

  // Record meaningful calculator use without sending any financial inputs to GA4.
  function createCalculatorTracking(form, calculatorName){
    let started = false;
    let resultViewed = false;
    let resultTimer;

    function trackStarted(){
      if(started) return;
      started = true;
      trackEvent('calculator_started', { calculator_name: calculatorName });
    }

    function trackResultViewed(){
      if(resultViewed) return;
      resultViewed = true;
      trackEvent('calculator_result_viewed', { calculator_name: calculatorName });
    }

    function scheduleResultViewed(){
      trackStarted();
      window.clearTimeout(resultTimer);
      resultTimer = window.setTimeout(trackResultViewed, 600);
    }

    form.addEventListener('input', scheduleResultViewed);
    form.addEventListener('change', scheduleResultViewed);
    return { trackResultViewed };
  }

  function currentContentType(){
    const path = window.location.pathname;
    if(path.startsWith('/guides/')) return 'guide';
    if(['/', '/repayment-estimator.html', '/negative-gearing-calculator.html', '/refinance-break-even-calculator.html', '/deposit-upfront-costs.html'].includes(path)) return 'calculator';
    return 'site_page';
  }

  function initContentNavigationTracking(){
    const destinations = {
      '/': { name: 'borrowing_power', type: 'calculator' },
      '/repayment-estimator.html': { name: 'repayment_estimator', type: 'calculator' },
      '/negative-gearing-calculator.html': { name: 'negative_gearing', type: 'calculator' },
      '/refinance-break-even-calculator.html': { name: 'refinance_break_even', type: 'calculator' },
      '/deposit-upfront-costs.html': { name: 'deposit_upfront_costs', type: 'calculator' },
      '/guides/first-home-buyer.html': { name: 'first_home_buyer', type: 'hub' },
      '/guides/refinance-home-loan.html': { name: 'refinancing', type: 'hub' },
      '/guides/property-investor-hub.html': { name: 'property_investor', type: 'hub' },
      '/guides/guides-index.html': { name: 'guides_index', type: 'guide_index' }
    };

    document.addEventListener('click', (event) => {
      if(event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('main a[href]');
      if(!link) return;

      const target = new URL(link.href, window.location.href);
      if(target.origin !== window.location.origin) return;
      const destination = destinations[target.pathname];
      if(!destination || target.pathname === window.location.pathname) return;

      trackEvent('content_navigation', {
        destination_name: destination.name,
        destination_type: destination.type,
        source_type: currentContentType()
      });
    });
  }

  /* Accessible slide-in mobile menu */
function initMenu(){
  const btn = document.getElementById('menuToggle');
  const nav = document.getElementById('primaryNav');
  const backdrop = document.getElementById('backdrop');
  if(!btn || !nav || !backdrop) return;

  const open = () => {
    nav.setAttribute('data-open','true');
    backdrop.hidden = false;
    backdrop.setAttribute('data-open','true');
    btn.setAttribute('aria-expanded','true');
    document.body.classList.add('no-scroll');
    const first = nav.querySelector('a'); first && first.focus();
  };

  const close = () => {
    nav.setAttribute('data-open','false');
    backdrop.removeAttribute('data-open');
    btn.setAttribute('aria-expanded','false');
    document.body.classList.remove('no-scroll');
    // Allow fade-out before hide
    window.setTimeout(() => { backdrop.hidden = true; }, 200);
  };

  btn.addEventListener('click', () => {
    const isOpen = nav.getAttribute('data-open') === 'true';
    (isOpen ? close : open)();
  });

  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape'){ close(); btn.focus(); } });
  nav.addEventListener('click', (e) => { if(e.target.matches('a')) close(); });

  // Close if resizing up to desktop
  const mql = window.matchMedia('(min-width: 768px)');
  const onChange = () => { if(mql.matches){ close(); } };
  mql.addEventListener('change', onChange);
}





  function pmt(rate, nper, pv){
    if(rate === 0) return -(pv / nper);
    const pow = Math.pow(1+rate, nper);
    return -(pv * rate * pow) / (pow - 1);
  }
  const periodsPer = { monthly:12, fortnightly:26, weekly:52 };
  const annualPctToMonthly = pct => (pct/100)/12;

  function amortize({amount, annualRatePct, years, frequency='monthly', extraPerPeriod=0, type='pi', ioYears=0}){
    const periods = periodsPer[frequency] || 12;
    const totalPeriods = years * periods;
    const ratePer = (annualRatePct/100)/periods;
    let balance = amount, schedule = [];
    let ioRemaining = (type==='io' ? ioYears*periods : 0);
    const piPayment = ratePer===0 ? (amount/totalPeriods) : -pmt(ratePer, totalPeriods, amount);
    for(let i=1;i<=totalPeriods;i++){
      let interest = balance * ratePer;
      let principal = 0;
      let pay = 0;
      if(ioRemaining>0){ pay = interest + extraPerPeriod; principal = Math.max(0, pay - interest); ioRemaining--; }
      else { pay = piPayment + extraPerPeriod; principal = pay - interest; }
      balance = Math.max(0, balance - principal);
      schedule.push({i, interest, principal, balance, pay});
      if(balance<=0){ break; }
    }
    const totalPaid = schedule.reduce((s,x)=>s+x.pay,0);
    const totalInterest = schedule.reduce((s,x)=>s+x.interest,0);
    return { schedule, totalPaid, totalInterest, perPayment: schedule.length?schedule[0].pay:0 };
  }

  function calculateAnnualTax(income, brackets){
    let tax = 0;
    for(const b of brackets){
      const max = (b.max==null? Number.POSITIVE_INFINITY : b.max);
      if(income > b.min){
        const taxable = Math.min(income, max) - b.over;
        if(taxable>0){ tax = b.base + (taxable * b.rate); }
      }else{ break; }
    }
    return Math.max(0, tax);
  }

  function estimateNetAnnualIncome(income, brackets, includeMedicare=false){
    const gross = Math.max(0, +income || 0);
    const tax = calculateAnnualTax(gross, brackets);
    const medicare = includeMedicare ? gross * 0.02 : 0;
    return Math.max(0, gross - tax - medicare);
  }

  function minMonthlyExpenseFor(dependants, table){
    const key = String(Math.max(0, Math.min(6, dependants)));
    return table.minimum_monthly_expense_floor[key] ?? 2000;
  }
  const cardMonthlyCommitment = (limits, percentPerMonth = 3) => limits * (percentPerMonth / 100);

  function maxBorrowing({ netMonthlyIncome, monthlyExpenses, otherMonthlyDebts, creditCardLimits, annualRatePct, years, bufferPct = 3.0, creditCardCommitmentPercent = 3 }){
    const periods = 12;
    const testRate = (annualRatePct + bufferPct)/100/periods;
    const nper = years*periods;
    const capacity = Math.max(0, netMonthlyIncome - monthlyExpenses - otherMonthlyDebts - cardMonthlyCommitment(creditCardLimits, creditCardCommitmentPercent));
    if(capacity<=0) return 0;
    if(testRate===0) return capacity * nper;
    return capacity * (1 - Math.pow(1+testRate, -nper)) / testRate;
  }
  function monthlyPI(amount, annualRatePct, years){
    const r = annualPctToMonthly(annualRatePct); const n = years*12; return -pmt(r, n, amount);
  }
  function monthlyIO(amount, annualRatePct){ return amount * ((annualRatePct/100)/12); }
  function calcLVR({price, deposit, lmiCapitalised=0}){
    const loan = Math.max(0, price - deposit) + lmiCapitalised;
    const lvr = (loan<=0 || price<=0) ? 0 : (loan / price);
    return { loan, lvr };
  }
  function estimateLMI({loan, lvr, lmiTable}){
    if(lvr<=0.80) return 0;
    for(const band of lmiTable.bands){
      if(lvr>=band.min_lvr && lvr<band.max_lvr){
        for(const r of band.rates){
          const max = r.max_loan==null ? Number.POSITIVE_INFINITY : r.max_loan;
          if(loan>=r.min_loan && loan<max){ return loan * r.rate; }
        }
      }
    }
    return 0;
  }
  function getStampDuty({price, state}){
    if(typeof window.calculateStampDuty === 'function'){
      try { return Math.max(0, window.calculateStampDuty(price, state)); } catch(e){}
    }
    if(window.STAMP_DUTY_TABLES && window.STAMP_DUTY_TABLES[state]){
      const bands = window.STAMP_DUTY_TABLES[state];
      let duty = 0, lastMax = 0;
      for(const b of bands){
        const max = b.upTo ?? Number.POSITIVE_INFINITY;
        if(price>lastMax){
          if(b.formula === 'nt_under_525k' && price <= max){
            const v = price / 1000;
            return Math.max(0, (0.06571441 * v * v) + (15 * v));
          }
          const taxable = b.wholeValue ? price : Math.min(price, max) - (b.over ?? lastMax);
          if(taxable>0){ duty = (b.base ?? duty) + taxable * b.rate; }
          lastMax = max;
        }
      }
      return Math.max(0, duty);
    }
    return 0;
  }

  function getStampDutyEstimate({
    price,
    state,
    buyerType='general',
    propertyType='established',
    eligibilityConfirmed=true,
    foreignOwnershipShare=100
  }){
    const duty = getStampDuty({price, state});
    const p = Math.max(0, +price || 0);
    const foreignShare = clamp(+foreignOwnershipShare || 0, 0, 100) / 100;
    const qldHomeDuty = value => {
      if(value <= 350000) return value * 0.01;
      if(value <= 540000) return 3500 + ((value - 350000) * 0.035);
      if(value <= 1000000) return 10150 + ((value - 540000) * 0.045);
      return 30850 + ((value - 1000000) * 0.0575);
    };
    const qldFirstHomeConcession = value => {
      const concessions = [
        [710000, 17350], [720000, 15615], [730000, 13880], [740000, 12145],
        [750000, 10410], [760000, 8675], [770000, 6940], [780000, 5205],
        [790000, 3470], [800000, 1735]
      ];
      const match = concessions.find(([limit]) => value < limit);
      return match ? match[1] : 0;
    };
    const actOwnerOccupierDuty = value => {
      if(value <= 260000) return value * 0.0028;
      if(value <= 300000) return 728 + ((value - 260000) * 0.022);
      if(value <= 500000) return 1608 + ((value - 300000) * 0.034);
      if(value <= 750000) return 8408 + ((value - 500000) * 0.0432);
      if(value <= 1000000) return 19208 + ((value - 750000) * 0.059);
      if(value <= 1455000) return 33958 + ((value - 1000000) * 0.064);
      return value * 0.0454;
    };
    if(buyerType === 'first_home'){
      if(!eligibilityConfirmed) return { duty, note: 'General duty shown until you confirm that you meet the relevant first-home buyer eligibility and occupancy rules.' };
      if(propertyType === 'vacant_land' || propertyType === 'house_and_land') {
        return { duty, note: 'General duty shown. This estimate does not model vacant-land or house-and-land first-home concessions.' };
      }
      if(state === 'NSW'){
        if(p <= 800000) return { duty: 0, note: 'NSW first-home buyer estimate: full exemption applied for eligible homes up to $800,000.' };
        if(p < 1000000) return { duty: (p - 800000) * 0.195935, note: 'NSW first-home buyer estimate: concessional transfer duty applied for eligible homes under $1 million.' };
        return { duty, note: 'NSW first-home buyer threshold exceeded; general duty shown.' };
      }
      if(state === 'VIC'){
        if(p <= 600000) return { duty: 0, note: 'VIC first-home buyer estimate: full exemption applied for eligible homes up to $600,000.' };
        if(p <= 750000) return { duty: duty * ((p - 600000) / 150000), note: 'VIC first-home buyer estimate: sliding concession applied for eligible homes up to $750,000.' };
        return { duty, note: 'VIC first-home buyer threshold exceeded; general duty shown.' };
      }
      if(state === 'QLD'){
        const adjusted = Math.max(0, qldHomeDuty(p) - qldFirstHomeConcession(p));
        return { duty: adjusted, note: 'QLD first-home buyer estimate: home concession rate plus first-home concession applied where eligible.' };
      }
      if(state === 'SA') {
        if(propertyType !== 'new' && propertyType !== 'off_the_plan') return { duty, note: 'General duty shown. SA first-home relief is modelled only for an eligible new home or off-the-plan apartment.' };
        return { duty: 0, note: 'SA first-home buyer estimate: full stamp duty relief applied for an eligible new home or off-the-plan apartment.' };
      }
      if(state === 'WA'){
        if(p <= 600000) return { duty: 0, note: 'WA first-home owner rate estimate: no duty applied for eligible homes up to $600,000.' };
        if(p <= 800000) return { duty: (p - 600000) * 0.1615, note: 'WA first-home owner rate estimate: concessional rate applied for eligible homes up to $800,000.' };
        return { duty, note: 'WA first-home owner rate threshold exceeded; general duty shown.' };
      }
      if(state === 'TAS') return { duty, note: 'General duty shown. TAS first-home established-home duty exemption ended for settlements after 30 June 2026.' };
      if(state === 'ACT') return { duty: 0, note: 'ACT Home Buyer Concession estimate: no conveyance duty applied assuming eligibility from 1 July 2026.' };
      if(state === 'NT') return { duty, note: 'General duty shown. NT has HomeGrown grants and house-and-land exemptions, but no broad first-home stamp duty concession is modelled.' };
      return { duty, note: 'General duty shown. First-home buyer concessions for this state are not modelled yet.' };
    }
    if(buyerType === 'owner_occupier'){
      if(!eligibilityConfirmed) return { duty, note: 'General duty shown until you confirm that you meet the relevant owner-occupier eligibility and residency rules.' };
      if(state === 'QLD') return { duty: qldHomeDuty(p), note: 'QLD home concession estimate applied for eligible owner-occupier purchases.' };
      if(state === 'VIC'){
        let adjusted = duty;
        if(p >= 130000 && p <= 440000) adjusted = Math.max(0, duty - (p * 0.01));
        else if(p > 440000 && p < 550000) adjusted = Math.max(0, duty - 3100);
        return { duty: adjusted, note: 'VIC principal-place-of-residence concession estimate applied where eligible.' };
      }
      if(state === 'ACT') return { duty: actOwnerOccupierDuty(p), note: 'ACT eligible owner-occupier conveyance duty rate applied.' };
      return { duty, note: 'General duty shown. Owner-occupier concessions for this state are not modelled yet.' };
    }
    if(buyerType === 'foreign'){
      if(state === 'NSW') return { duty: duty + (p * foreignShare * 0.09), note: `NSW foreign purchaser estimate: 9% surcharge purchaser duty applied to the entered ${Math.round(foreignShare * 100)}% foreign ownership share.` };
      if(state === 'VIC') return { duty: duty + (p * foreignShare * 0.08), note: `VIC foreign purchaser estimate: 8% additional duty applied to the entered ${Math.round(foreignShare * 100)}% foreign ownership share.` };
      if(state === 'QLD') return { duty: duty + (p * foreignShare * 0.08), note: `QLD foreign purchaser estimate: 8% additional foreign acquirer duty applied to the entered ${Math.round(foreignShare * 100)}% foreign ownership share.` };
      if(state === 'SA') return { duty: duty + (p * foreignShare * 0.07), note: `SA foreign purchaser estimate: 7% foreign ownership surcharge applied to the entered ${Math.round(foreignShare * 100)}% foreign ownership share.` };
      if(state === 'WA') return { duty: duty + (p * foreignShare * 0.07), note: `WA foreign purchaser estimate: 7% foreign transfer duty applied to the entered ${Math.round(foreignShare * 100)}% foreign ownership share.` };
      if(state === 'TAS') return { duty: duty + (p * foreignShare * 0.08), note: `TAS foreign purchaser estimate: 8% foreign investor duty surcharge applied to the entered ${Math.round(foreignShare * 100)}% foreign ownership share.` };
      if(state === 'ACT') return { duty, note: 'General duty shown. ACT does not currently apply a one-off foreign purchaser stamp duty surcharge.' };
      if(state === 'NT') return { duty, note: 'General duty shown. NT does not currently apply a foreign purchaser stamp duty surcharge.' };
      return { duty, note: 'General duty shown. Foreign purchaser surcharges for this state are not modelled yet.' };
    }
    return { duty, note: 'General/non-concession transfer duty estimate.' };
  }

  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));
  function bindSliderPair(slider, input, min, max, step){
    if(slider){ slider.min=min; slider.max=max; slider.step=step; slider.addEventListener('input',()=>{ input.value = slider.value; }); }
    if(input){ input.addEventListener('blur',()=>{ const v = Math.max(+min, Math.min(+max, +input.value||0)); input.value = v; if(slider) slider.value = v; }); }
  }
  function toggleTooltip(btn, panelId){
    const panel = document.getElementById(panelId);
    if(!panel) return;
    btn.addEventListener('click',()=>{
      const open = panel.getAttribute('data-open') === 'true';
      panel.setAttribute('data-open', String(!open));
      btn.setAttribute('aria-expanded', String(!open));
    });
  }
  function fillYears(select){
    if(!select) return;
    select.innerHTML = '';
    for(let i=1;i<=30;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); select.appendChild(o); }
    select.value='30';
  }
  const LS_KEYS = { bp:'hlm_bp_inputs', rp:'hlm_rp_inputs' };
  function saveIfOptIn(key, data, checkbox){ if(checkbox && checkbox.checked){ localStorage.setItem(key, JSON.stringify(data)); } }
  function restoreIfExists(key, checkbox){
    try{ const raw = localStorage.getItem(key); if(!raw) return null; const parsed = JSON.parse(raw); if(checkbox) checkbox.checked = true; return parsed; }catch{ return null; }
  }
  
  // --- Stamp duty JSON normaliser ---
// Accepts multiple shapes and returns: { NSW:[{over,upTo,base,rate},...], VIC:[...], ... }
function normaliseStampDutyTables(raw){
  if (!raw) return {};

  // 1) Pick the top-level map of states
  //    - If your file is { jurisdictions: { NSW:{bands:[...]}, ... } }
  //    - If your file is already { NSW:[...], VIC:[...], ... }
  //    - If your file is { states: { NSW: {bands:[...]}, ... } }
  const byState =
    raw.jurisdictions || raw.states || raw || {};

  const out = {};

  for (const [state, entry] of Object.entries(byState)) {
    // If entry is already an array of bands, use it as-is
    const bandsRaw = Array.isArray(entry)
      ? entry
      // else prefer .bands, but gracefully fall back to other common keys
      : (entry && (entry.bands || entry.non_ppr_bands || entry.ppr_bands || entry.rates || [])) || [];

    // Map every band to a canonical shape:
    //   over = lower bound, upTo = upper bound (null/∞ ok), base = base duty at lower bound, rate = marginal (0..1)
    const bands = bandsRaw.map(b => {
      // tolerate either {over/upTo} or {min/max}
      const over = (b.over ?? b.min ?? 0);
      let upTo = (b.upTo ?? b.max);
      if (upTo == null) upTo = Number.POSITIVE_INFINITY;

      // tolerate either {rate} (0..1), {percent} (0..100), or {per_100} (# per $100)
      let rate = b.rate;
      if (rate == null && typeof b.percent === 'number') rate = b.percent / 100;
      if (rate == null && typeof b.per_100 === 'number') rate = b.per_100 / 100;

      // base is the accumulated duty at the band start; default to 0 if not provided
      const base = (typeof b.base === 'number') ? b.base : 0;

      // Fixed duty band (e.g., TAS first bracket) — allow "duty" to override
      if (typeof b.duty === 'number') {
        // Encode fixed as base=duty, rate=0, over=0, upTo=over so loop sets duty to base
        return { over, upTo, base: b.duty, rate: 0 };
      }

      return {
        over,
        upTo,
        base,
        rate: rate ?? 0,
        formula: b.formula,
        wholeValue: !!(b.wholeValue ?? b.whole_value)
      };
    });

    // Sort by lower bound just in case
    bands.sort((a,b) => a.over - b.over);

    out[state] = bands;
  }

  return out;
}
  

  
  async function initBorrowingPower(){
    const form = qs('#bp-form'); if(!form) return;
    const incomeSlider = qs('#incomeSlider'), incomeInput = qs('#incomeInput');
    const partnerIncomeSlider = qs('#partnerIncomeSlider'), partnerIncomeInput = qs('#partnerIncomeInput');
    const includeMedicare = qs('#includeMedicare');
    const expensesSlider = qs('#expensesSlider'), expensesInput = qs('#expensesInput');
    const dependants = qs('#dependants');
    const otherDebtsSlider = qs('#otherDebtsSlider'), otherDebts = qs('#otherDebts');
    const creditCardLimitsSlider = qs('#creditCardLimitsSlider'), creditCardLimits = qs('#creditCardLimits');
    const helpDebtMonthlySlider = qs('#helpDebtMonthlySlider'), helpDebtMonthly = qs('#helpDebtMonthly');
    const rateSlider = qs('#rateSlider'), rate = qs('#rate');
    const term = qs('#term'); fillYears(term);
    const propertyPrice = qs('#propertyPrice'), deposit = qs('#deposit');
    const state = qs('#state');
    const buyerType = qs('#buyerType');
    const propertyType = qs('#propertyType');
    const foreignOwnershipShare = qs('#foreignOwnershipShare');
    const eligibilityConfirmed = qs('#eligibilityConfirmed');
    const capitaliseLMI = qs('#capitaliseLMI');
    const rememberInputs = qs('#rememberInputs');
    const recalcBtn = qs('#recalculateBtn');
    qsa('.info-btn').forEach(btn=>{ const id = btn.getAttribute('aria-controls'); if(id) toggleTooltip(btn, id); });
    bindSliderPair(incomeSlider, incomeInput, 0, 300000, 1000);
    bindSliderPair(partnerIncomeSlider, partnerIncomeInput, 0, 300000, 1000);
    bindSliderPair(expensesSlider, expensesInput, 0, 20000, 50);
    bindSliderPair(otherDebtsSlider, otherDebts, 0, 10000, 50);
    bindSliderPair(creditCardLimitsSlider, creditCardLimits, 0, 100000, 500);
    bindSliderPair(helpDebtMonthlySlider, helpDebtMonthly, 0, 3000, 25);
    bindSliderPair(rateSlider, rate, 0, 10, 0.01);
    const assumptions = await fetch('/assets/financial_assumptions.json').then(r=>r.json());
    const [taxBands, depTable, lmiTable, stampDutyRaw] = await Promise.all([
      fetch(assumptions.tax?.tax_bands_file || '/assets/au_tax_bands_2026_2027.json').then(r=>r.json()),
      fetch(assumptions.serviceability?.living_expense_floor_file || '/assets/dependants_cost_table.json').then(r=>r.json()),
      fetch(assumptions.lmi?.data_file || '/assets/lmi_table.json').then(r=>r.json()),
	  fetch('/assets/stampDuty.json').then(r=>r.json())
    ]);
	
	// 🔧 NEW: build canonical state -> [bands] map used by getStampDuty
	window.STAMP_DUTY_TABLES = normaliseStampDutyTables(stampDutyRaw);
	
    capitaliseLMI.checked = !!lmiTable.capitalise_by_default;
    const restored = restoreIfExists(LS_KEYS.bp, rememberInputs);
    if(restored){
      Object.entries(restored).forEach(([id,val])=>{ const el = qs('#'+id); if(el){ if(el.type==='checkbox') el.checked=!!val; else el.value = val; } });
      if(incomeSlider) incomeSlider.value = incomeInput.value;
      if(partnerIncomeSlider) partnerIncomeSlider.value = partnerIncomeInput.value;
      if(expensesSlider) expensesSlider.value = expensesInput.value;
      if(otherDebtsSlider) otherDebtsSlider.value = otherDebts.value;
      if(creditCardLimitsSlider) creditCardLimitsSlider.value = creditCardLimits.value;
      if(helpDebtMonthlySlider) helpDebtMonthlySlider.value = helpDebtMonthly.value;
      if(rateSlider) rateSlider.value = rate.value;
    }
    const out = {
      maxLoanBuffered: qs('#maxLoanBuffered'),
      maxLoanActual: qs('#maxLoanActual'),
      netMonthlyIncome: qs('#netMonthlyIncome'),
      assessedLivingExpenses: qs('#assessedLivingExpenses'),
      assessedCommitments: qs('#assessedCommitments'),
      monthlyPI: qs('#monthlyPI'),
      monthlyIO: qs('#monthlyIO'),
      lvr: qs('#lvr'),
      lmi: qs('#lmi'),
      stampDuty: qs('#stampDuty'),
      stampDutyNote: qs('#stampDutyNote'),
      assessmentRate: qs('#assessmentRate'),
      bufferImpact: qs('#bufferImpact'),
      assumptionsReview: qs('#assumptionsReview'),
      expenseFloorHelp: qs('#expenseFloorHelp'),
      purchaseBudgetNote: qs('#purchaseBudgetNote'),
      purchasePlanLink: qs('#purchasePlanLink')
    };
    const BUFFER_PCT = Number(assumptions.serviceability?.rate_buffer_percent) || 3;
    const CREDIT_CARD_COMMITMENT_PCT = Number(assumptions.serviceability?.credit_card_commitment_percent_per_month) || 3;
    if(out.assumptionsReview) out.assumptionsReview.textContent = `Assumptions last reviewed ${assumptions.last_reviewed || 'recently'}.`;
    function render(){
      const grossAnnual = +incomeInput.value || 0;
      const partnerGrossAnnual = +partnerIncomeInput.value || 0;
      const includeMedicareVal = !!includeMedicare?.checked;
      const netAnnual =
        estimateNetAnnualIncome(grossAnnual, taxBands.brackets, includeMedicareVal) +
        estimateNetAnnualIncome(partnerGrossAnnual, taxBands.brackets, includeMedicareVal);
      const netMonthly = netAnnual / 12;
      const depCount = parseInt(dependants.value||'0',10);
      const minFloor = minMonthlyExpenseFor(depCount, depTable);
      let monthlyExp = Math.max(minFloor, +expensesInput.value||0);
      if(netMonthly>0 && monthlyExp > netMonthly){
        monthlyExp = netMonthly;
        expensesInput.value = String(Math.round(monthlyExp));
        if(expensesSlider) expensesSlider.value = expensesInput.value;
      }
      const otherDebtsVal = +otherDebts.value||0;
      const helpDebtMonthlyVal = +helpDebtMonthly.value || 0;
      const ccLimits = +creditCardLimits.value || 0;
      const totalOtherDebts = otherDebtsVal + helpDebtMonthlyVal;
      const monthlyCommitments = monthlyExp + totalOtherDebts + cardMonthlyCommitment(ccLimits, CREDIT_CARD_COMMITMENT_PCT);
      const annualRate = parseFloat(parseFloat(rate.value).toFixed(2));
      const years = parseInt(term.value,10);
	  const price = +propertyPrice.value || 0;
	  const dep   = +deposit.value || 0;



		const maxBuffered = maxBorrowing({
		  netMonthlyIncome: netMonthly,
		  monthlyExpenses: monthlyExp,
		  otherMonthlyDebts: totalOtherDebts,
		  creditCardLimits: ccLimits,
		  annualRatePct: annualRate,
		  years,
		  bufferPct: BUFFER_PCT,
		  creditCardCommitmentPercent: CREDIT_CARD_COMMITMENT_PCT
		});
      const maxActual = maxBorrowing({
		  netMonthlyIncome: netMonthly,
		  monthlyExpenses: monthlyExp,
		  otherMonthlyDebts: totalOtherDebts,
		  creditCardLimits: ccLimits,
		  annualRatePct: annualRate,
		  years,
		  bufferPct: 0,
		  creditCardCommitmentPercent: CREDIT_CARD_COMMITMENT_PCT
		});
      const base = calcLVR({price, deposit: dep, lmiCapitalised: 0});
      let lmiEstimate = estimateLMI({loan: base.loan, lvr: base.lvr, lmiTable});
      if(capitaliseLMI.checked && lmiEstimate>0){
        const withLMI = calcLVR({price, deposit: dep, lmiCapitalised: lmiEstimate});
        const lvr2 = withLMI.lvr;
        const lmi2 = estimateLMI({loan: withLMI.loan, lvr: lvr2, lmiTable});
        lmiEstimate = lmi2;
      }
      const dutyEstimate = getStampDutyEstimate({
        price,
        state: state.value,
        buyerType: buyerType.value,
        propertyType: propertyType.value,
        eligibilityConfirmed: eligibilityConfirmed.checked,
        foreignOwnershipShare: foreignOwnershipShare.value
      });
      const duty = dutyEstimate.duty;
      const monthlyPiAmt = monthlyPI(maxActual, annualRate, years);
      const monthlyIoAmt = monthlyIO(maxActual, annualRate);
      out.maxLoanBuffered.textContent = maxBuffered? AUD.format(Math.round(maxBuffered)) : '—';
      out.maxLoanActual.textContent   = maxActual?   AUD.format(Math.round(maxActual))   : '—';
      out.assessmentRate.textContent = annualRate >= 0 ? `Based on an assessment rate of ${(annualRate + BUFFER_PCT).toFixed(2)}%` : '';
      out.bufferImpact.textContent = maxActual > maxBuffered ? AUD.format(Math.round(maxActual - maxBuffered)) : '—';
      out.netMonthlyIncome.textContent = netMonthly? AUD.format(Math.round(netMonthly)) : '?';
      if(out.assessedLivingExpenses){
        const floorApplied = monthlyExp > (+expensesInput.value || 0);
        out.assessedLivingExpenses.textContent = AUD.format(Math.round(monthlyExp));
        out.assessedLivingExpenses.title = floorApplied ? `Entered expenses were raised to the ${AUD.format(Math.round(minFloor))} household expense floor.` : 'Entered living expenses are above the household expense floor.';
      }
      out.assessedCommitments.textContent = monthlyCommitments? AUD.format(Math.round(monthlyCommitments)) : '?';
      out.monthlyPI.textContent       = monthlyPiAmt? AUD.format(Math.round(monthlyPiAmt)) : '—';
      out.monthlyIO.textContent       = monthlyIoAmt? AUD.format(Math.round(monthlyIoAmt)) : '—';
      out.lvr.textContent             = price>0 ? PCT(base.lvr) : '—';
      out.lmi.textContent             = lmiEstimate>0 ? AUD.format(Math.round(lmiEstimate)) : '—';
      out.stampDuty.textContent       = price>0 ? AUD.format(Math.round(duty)) : '—';
      out.stampDutyNote.textContent   = price>0 ? dutyEstimate.note : '';
      if(out.expenseFloorHelp){
        out.expenseFloorHelp.textContent = `Minimum used for 0 dependants: ${AUD.format(Math.round(minFloor))} per month. This is BorrowPower's household expense floor, not a lender's private HEM figure.`.replace('0 dependants', `${depCount} dependant${depCount === 1 ? '' : 's'}`);
      }
      if(out.purchaseBudgetNote && out.purchasePlanLink){
        const purchasePriceBeforeCosts = maxBuffered + dep;
        out.purchaseBudgetNote.textContent = purchasePriceBeforeCosts > 0
          ? `At this buffered borrowing estimate plus your deposit set aside, the purchase price before duty and other costs is about ${AUD.format(Math.round(purchasePriceBeforeCosts))}. Open the planner to allow for those costs properly.`
          : 'Use your borrowing result, deposit set aside and state to estimate duty and other upfront costs.';
        const params = new URLSearchParams({
          price: String(Math.round(purchasePriceBeforeCosts)),
          loan: String(Math.round(maxBuffered))
        });
        out.purchasePlanLink.href = `/deposit-upfront-costs.html?${params.toString()}`;
      }
	saveIfOptIn(LS_KEYS.bp, {
	  incomeInput: incomeInput.value,
	  partnerIncomeInput: partnerIncomeInput.value,
	  includeMedicare: includeMedicareVal,
	  expensesInput: expensesInput.value,
	  dependants: dependants.value,
	  otherDebts: otherDebts.value,
	  creditCardLimits: creditCardLimits.value,
	  helpDebtMonthly: helpDebtMonthly.value,
	  rate: rate.value,
	  term: term.value,
	  propertyPrice: propertyPrice.value,
	  deposit: deposit.value,
	  state: state.value,
	  buyerType: buyerType.value,
	  propertyType: propertyType.value,
	  foreignOwnershipShare: foreignOwnershipShare.value,
	  eligibilityConfirmed: eligibilityConfirmed.checked,
	  capitaliseLMI: capitaliseLMI.checked
	}, rememberInputs);
    }
    form.addEventListener('input', render);
    const calculatorTracking = createCalculatorTracking(form, 'borrowing_power');
    recalcBtn?.addEventListener('click', () => {
      render();
      calculatorTracking.trackResultViewed();
      trackEvent('calculator_recalculated', { calculator_name: 'borrowing_power' });
    });
    render();
  }

  function lazyLoadChartJs(){
    return new Promise((res, rej)=>{
      if(window.Chart){ res(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      s.defer = true;
      s.onload = ()=>res(); s.onerror = rej; document.head.appendChild(s);
    });
  }
  async function initRepayments(){
    const form = document.querySelector('#repay-form'); if(!form) return;
    const loanAmount = document.querySelector('#loanAmountInput');
    const rRate = document.querySelector('#rRateInput');
    const rTerm = document.querySelector('#rTerm'); 
    const frequency = document.querySelector('#frequency');
    const loanType = document.querySelector('#loanType');
    const ioYears = document.querySelector('#ioYears');
    const extra = document.querySelector('#extraInput');
	
	  // sliders (the “ranges”)
	const loanAmountSlider = document.querySelector('#loanAmountSlider');
	const rRateSlider      = document.querySelector('#rRateSlider');
	const rTermSlider      = document.querySelector('#rTermSlider');
	const ioYearsSlider    = document.querySelector('#ioYearsSlider');
	const extraSlider      = document.querySelector('#extraSlider');
	
    const remember = document.querySelector('#rememberRepay');
    const perRepay = document.querySelector('#perRepay');
    const totalInterest = document.querySelector('#totalInterest');
    const totalPaid = document.querySelector('#totalPaid');
    const compare = document.querySelector('#compare');
    const calcBtn = document.querySelector('#calcRepayBtn');
	
		  // ✅ now it's safe to touch rTermSlider
(function(){
		rTerm.innerHTML = '';
		for (let i = 1; i <= 30; i++){
		  const o = document.createElement('option');
		  o.value = String(i);
		  o.textContent = String(i);
		  rTerm.appendChild(o);
		}
		rTerm.value = '30';
		if (rTermSlider) rTermSlider.value = '30';
	  })();

	  // (bindings etc…)
	
	
	
	  // bind slider pairs for this page
	bindSliderPair(loanAmountSlider, loanAmount, 0, 2000000, 1000);
	bindSliderPair(rRateSlider,      rRate,      0,       15, 0.01);
	bindSliderPair(extraSlider,      extra,      0,     5000,   50);
	bindSliderPair(ioYearsSlider,    ioYears,    0,        5,    1);
	
	
    const restored = (function(key, checkbox){ try{const raw=localStorage.getItem(key); if(!raw) return null; const parsed=JSON.parse(raw); if(checkbox) checkbox.checked=true; return parsed;}catch{return null;} })('hlm_rp_inputs', remember);
    if(restored){ Object.entries(restored).forEach(([id,val])=>{ const el = document.querySelector('#'+id); if(el){ el.value = val; }}); }
    let chart;
    function render(){
      const params = {
        amount: +loanAmount.value||0, annualRatePct: parseFloat(parseFloat(rRate.value).toFixed(2)),
        years: parseInt(rTerm.value,10), frequency: frequency.value, type: loanType.value,
        ioYears: parseInt(ioYears.value,10), extraPerPeriod: +extra.value||0
      };
      const res = amortize(params);
      perRepay.textContent = res.perPayment ? new Intl.NumberFormat('en-AU',{style:'currency', currency:'AUD'}).format(Math.round(res.perPayment)) : '—';
      totalInterest.textContent = AUD.format(Math.round(res.totalInterest));
      totalPaid.textContent = AUD.format(Math.round(res.totalPaid));
      const pi = amortize({...params, type:'pi', ioYears:0, extraPerPeriod:0});
      const io = amortize({...params, type:'io', ioYears: Math.min(params.ioYears, params.years), extraPerPeriod:0});
      const delta = Math.round(io.totalInterest - pi.totalInterest);
      compare.textContent = (delta>=0?'+':'') + AUD.format(Math.abs(delta)) + ' interest vs P&I';
      // const canvas = document.getElementById('balanceChart');
/*       if(canvas){
        const sample = res.schedule.filter((x,idx)=>idx%12===0 || idx===res.schedule.length-1);
        const labels = sample.map(x=>x.i); const data = sample.map(x=>Math.round(x.balance));
        lazyLoadChartJs().then(()=>{
          if(chart){ chart.destroy(); }
          chart = new Chart(canvas.getContext('2d'), {
            type:'line', data:{ labels, datasets:[{ label:'Balance', data }] },
            options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
                      scales:{ y:{ ticks:{ callback:(v)=>AUD.format(v) } } } }
          });
        });
      } */
		if (remember?.checked) {
		  localStorage.setItem('hlm_rp_inputs', JSON.stringify({
			loanAmount: loanAmount.value,
			rRate:      rRate.value,
			rTerm:      rTerm.value,
			frequency:  frequency.value,
			loanType:   loanType.value,
			ioYears:    ioYears.value,
			extra:      extra.value
		  }));
		}
    }
    form.addEventListener('input', render);
    const calculatorTracking = createCalculatorTracking(form, 'repayment_estimator');
    calcBtn?.addEventListener('click', () => {
      render();
      calculatorTracking.trackResultViewed();
      trackEvent('calculator_recalculated', { calculator_name: 'repayment_estimator' });
    });
    render();
  }

  window.addEventListener('DOMContentLoaded', ()=>{ initBorrowingPower(); initRepayments(); initMenu(); initContentNavigationTracking()});
  window.HLM = { pmt, amortize, calculateAnnualTax, estimateNetAnnualIncome, minMonthlyExpenseFor, maxBorrowing, monthlyPI, monthlyIO, calcLVR, estimateLMI, getStampDuty, getStampDutyEstimate, periodsPer };
})();
