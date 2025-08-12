document.querySelectorAll('[data-include]').forEach(el=>{
  const url = el.getAttribute('data-include');
  fetch(url).then(r=>r.text()).then(html=>{ el.innerHTML = html; });
});
