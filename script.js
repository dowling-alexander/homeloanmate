(function(){
  const AUD = new Intl.NumberFormat('en-AU',{style:'currency', currency:'AUD', maximumFractionDigits:0});
  const PCT = n => (n*100).toFixed(2)+'%';
  const clamp = (v,min,max)=>Math.max(min, Math.min(max, v));
  const toNumber = v => isNaN(+v) ? 0 : +v;

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

  function minMonthlyExpenseFor(dependants, table){
    const key = String(Math.max(0, Math.min(6, dependants)));
    return table.minimum_monthly_expense_floor[key] ?? 2000;
  }
  const cardMonthlyCommitment = limits => limits * 0.03;

  function maxBorrowing({ netMonthlyIncome, monthlyExpenses, otherMonthlyDebts, creditCardLimits, annualRatePct, years, bufferPct = 3.0 }){
    const periods = 12;
    const testRate = (annualRatePct + bufferPct)/100/periods;
    const nper = years*periods;
    const capacity = Math.max(0, netMonthlyIncome - monthlyExpenses - otherMonthlyDebts - cardMonthlyCommitment(creditCardLimits));
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
          const taxable = Math.min(price, max) - (b.over ?? lastMax);
          if(taxable>0){ duty = (b.base ?? duty) + taxable * b.rate; }
          lastMax = max;
        }
      }
      return Math.max(0, duty);
    }
    return 0;
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

      return { over, upTo, base, rate: rate ?? 0 };
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
    const expensesSlider = qs('#expensesSlider'), expensesInput = qs('#expensesInput');
    const dependants = qs('#dependants');
    const otherDebtsSlider = qs('#otherDebtsSlider'), otherDebts = qs('#otherDebts');
    const rateSlider = qs('#rateSlider'), rate = qs('#rate');
    const term = qs('#term'); fillYears(term);
    const propertyPrice = qs('#propertyPrice'), deposit = qs('#deposit');
    const state = qs('#state');
    const capitaliseLMI = qs('#capitaliseLMI');
    const rememberInputs = qs('#rememberInputs');
    const recalcBtn = qs('#recalculateBtn');
    qsa('.info-btn').forEach(btn=>{ const id = btn.getAttribute('aria-controls'); if(id) toggleTooltip(btn, id); });
    bindSliderPair(incomeSlider, incomeInput, 0, 300000, 1000);
    bindSliderPair(expensesSlider, expensesInput, 0, 20000, 50);
    bindSliderPair(otherDebtsSlider, otherDebts, 0, 10000, 50);
    bindSliderPair(rateSlider, rate, 0, 10, 0.01);
    const [taxBands, depTable, lmiTable, stampDutyRaw] = await Promise.all([
      fetch('/assets/au_tax_bands_2025_2026.json').then(r=>r.json()),
      fetch('/assets/dependants_cost_table.json').then(r=>r.json()),
      fetch('/assets/lmi_table.json').then(r=>r.json()),
	  fetch('/assets/stampDuty.json').then(r=>r.json())
    ]);
	
	// 🔧 NEW: build canonical state -> [bands] map used by getStampDuty
	window.STAMP_DUTY_TABLES = normaliseStampDutyTables(stampDutyRaw);
	
    capitaliseLMI.checked = !!lmiTable.capitalise_by_default;
    const restored = restoreIfExists(LS_KEYS.bp, rememberInputs);
    if(restored){
      Object.entries(restored).forEach(([id,val])=>{ const el = qs('#'+id); if(el){ if(el.type==='checkbox') el.checked=!!val; else el.value = val; } });
      if(incomeSlider) incomeSlider.value = incomeInput.value;
      if(expensesSlider) expensesSlider.value = expensesInput.value;
      if(otherDebtsSlider) otherDebtsSlider.value = otherDebts.value;
      if(rateSlider) rateSlider.value = rate.value;
    }
    const out = {
      maxLoanBuffered: qs('#maxLoanBuffered'),
      maxLoanActual: qs('#maxLoanActual'),
      monthlyPI: qs('#monthlyPI'),
      monthlyIO: qs('#monthlyIO'),
      lvr: qs('#lvr'),
      lmi: qs('#lmi'),
      stampDuty: qs('#stampDuty')
    };
    function render(){
      const grossAnnual = +incomeInput.value || 0;
	  const annualTax = calculateAnnualTax(grossAnnual, taxBands.brackets);
      const netAnnual = grossAnnual - annualTax;
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
      const ccLimits = 0;
      const annualRate = parseFloat(parseFloat(rate.value).toFixed(2));
      const years = parseInt(term.value,10);
      const BUFFER_PCT = 3.0;
	  const price = +propertyPrice.value || 0;
	  const dep   = +deposit.value || 0;

		const maxBuffered = maxBorrowing({
		  netMonthlyIncome: netMonthly,
		  monthlyExpenses: monthlyExp,
		  otherMonthlyDebts: otherDebtsVal,
		  creditCardLimits: ccLimits,
		  annualRatePct: annualRate,
		  years,
		  bufferPct: BUFFER_PCT
		});
      const maxActual = maxBorrowing({
		  netMonthlyIncome: netMonthly,
		  monthlyExpenses: monthlyExp,
		  otherMonthlyDebts: otherDebtsVal,
		  creditCardLimits: ccLimits,
		  annualRatePct: annualRate,
		  years,
		  bufferPct: 0
		});
      const base = calcLVR({price, deposit: dep, lmiCapitalised: 0});
      let lmiEstimate = estimateLMI({loan: base.loan, lvr: base.lvr, lmiTable});
      if(capitaliseLMI.checked && lmiEstimate>0){
        const withLMI = calcLVR({price, deposit: dep, lmiCapitalised: lmiEstimate});
        const lvr2 = withLMI.lvr;
        const lmi2 = estimateLMI({loan: withLMI.loan, lvr: lvr2, lmiTable});
        lmiEstimate = lmi2;
      }
      const duty = getStampDuty({price, state: state.value});
      const monthlyPiAmt = monthlyPI(maxActual, annualRate, years);
      const monthlyIoAmt = monthlyIO(maxActual, annualRate);
      out.maxLoanBuffered.textContent = maxBuffered? AUD.format(Math.round(maxBuffered)) : '—';
      out.maxLoanActual.textContent   = maxActual?   AUD.format(Math.round(maxActual))   : '—';
      out.monthlyPI.textContent       = monthlyPiAmt? AUD.format(Math.round(monthlyPiAmt)) : '—';
      out.monthlyIO.textContent       = monthlyIoAmt? AUD.format(Math.round(monthlyIoAmt)) : '—';
      out.lvr.textContent             = price>0 ? PCT(base.lvr) : '—';
      out.lmi.textContent             = lmiEstimate>0 ? AUD.format(Math.round(lmiEstimate)) : '—';
      out.stampDuty.textContent       = duty>0 ? AUD.format(Math.round(duty)) : '—';
	saveIfOptIn(LS_KEYS.bp, {
	  incomeInput: incomeInput.value,
	  expensesInput: expensesInput.value,
	  dependants: dependants.value,
	  otherDebts: otherDebts.value,
	  rate: rate.value,
	  term: term.value,
	  propertyPrice: propertyPrice.value,
	  deposit: deposit.value,
	  state: state.value,
	  capitaliseLMI: capitaliseLMI.checked
	}, rememberInputs);
    }
    form.addEventListener('input', render);
    recalcBtn?.addEventListener('click', render);
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
    const loanAmount = document.querySelector('#loanAmount');
    const rRate = document.querySelector('#rRate');
    const rTerm = document.querySelector('#rTerm'); (function(){rTerm.innerHTML=''; for(let i=1;i<=30;i++){const o=document.createElement('option');o.value=String(i);o.textContent=String(i);rTerm.appendChild(o);} rTerm.value='30';})();
    const frequency = document.querySelector('#frequency');
    const loanType = document.querySelector('#loanType');
    const ioYears = document.querySelector('#ioYears');
    const extra = document.querySelector('#extra');
    const remember = document.querySelector('#rememberRepay');
    const perRepay = document.querySelector('#perRepay');
    const totalInterest = document.querySelector('#totalInterest');
    const totalPaid = document.querySelector('#totalPaid');
    const compare = document.querySelector('#compare');
    const calcBtn = document.querySelector('#calcRepayBtn');
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
      const canvas = document.getElementById('balanceChart');
      if(canvas){
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
      }
      if(remember && remember.checked){
        localStorage.setItem('hlm_rp_inputs', JSON.stringify({
          loanAmount: loanAmount.value, rRate: rRate.value, rTerm: rTerm.value,
          frequency: frequency.value, loanType: loanType.value, ioYears: ioYears.value, extra: extra.value
        }));
      }
    }
    form.addEventListener('input', render);
    calcBtn?.addEventListener('click', render);
    render();
  }

  window.addEventListener('DOMContentLoaded', ()=>{ initBorrowingPower(); initRepayments(); initMenu()});
  window.HLM = { pmt, amortize, calculateAnnualTax, minMonthlyExpenseFor, maxBorrowing, monthlyPI, monthlyIO, calcLVR, estimateLMI, getStampDuty, periodsPer };
})();
