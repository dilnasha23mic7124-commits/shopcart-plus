const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function request(url, options={}) { const r=await fetch(url,{headers:{"Content-Type":"application/json"},...options}); const d=await r.json(); if(!r.ok) throw new Error(d.error||"Request failed"); return d; }
let customers=[];
async function loadCustomers(){
  try {
    const [list,stats]=await Promise.all([request('/api/customers'),request('/api/customer-stats')]); customers=list;
    document.getElementById('total-customers').textContent=stats.totalCustomers;
    document.getElementById('ordered-customers').textContent=stats.customersWithOrders;
    document.getElementById('total-orders').textContent=stats.totalOrders;
    renderCustomers();
  } catch(e) { document.getElementById('customer-list').innerHTML=`<div class="empty">${esc(e.message)}<br>Check that the server and MongoDB are running.</div>`; }
}
function renderCustomers(){
  const q=document.getElementById('customer-search').value.trim().toLowerCase();
  const list=customers.filter(c=>`${c.name} ${c.id}`.toLowerCase().includes(q));
  document.getElementById('customer-list').innerHTML=list.length?list.map(c=>`<article class="customer-row"><div class="avatar">${esc((c.name||'?').trim().charAt(0).toUpperCase())}</div><div class="customer-row-main"><strong>${esc(c.name)}</strong><span>${esc(c.id)}</span></div><div class="customer-date"><span>Registered</span><b>${c.createdAt?new Date(c.createdAt).toLocaleDateString(): '—'}</b></div></article>`).join(''):'<div class="empty">No customers match this search.</div>';
}
document.getElementById('customer-search').addEventListener('input',renderCustomers);
document.getElementById('register-form').addEventListener('submit',async e=>{
  e.preventDefault(); const input=document.getElementById('new-name'); const msg=document.getElementById('register-message');
  try { const d=await request('/api/customers',{method:'POST',body:JSON.stringify({name:input.value.trim(),familyCode:document.getElementById('new-family-code').value.trim()})}); msg.textContent=d.existing?`${d.customer.name} is already registered.`:`Welcome ${d.customer.name}! Your customer ID is ${d.customer.id}.`; msg.className='form-message success'; if(!d.existing)input.value=''; await loadCustomers(); }
  catch(err){msg.textContent=err.message;msg.className='form-message error';}
});
loadCustomers();
