const cash=n=>"₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function loadProjectDashboard(){
 const error=document.getElementById("dashboard-error");error.classList.add("hidden");
 try{
  const d=await fetch("/api/project-dashboard").then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error||"Request failed");return x;});
  const services=[ ["Redis","Cart storage","redis"],["MongoDB","Products, customers and orders","mongodb"],["MonetDB","Analytical reporting","monetdb"],["Neo4j","Graph recommendations","neo4j"] ];
  document.getElementById("service-grid").innerHTML=services.map(([name,desc,key])=>`<article class="service-card"><span>${name}</span><strong class="${d.services[key]?"status-up":"status-down"}">${d.services[key]?"Connected":"Not connected"}</strong><small>${desc}</small></article>`).join("");
  const s=d.stats;const values=[["Products",s.products],["Customers",s.customers],["Orders",s.orders],["Recorded revenue",cash(s.revenue)],["Average order",cash(s.averageOrder)]];
  document.getElementById("project-metrics").innerHTML=values.map(([label,value])=>`<article><span>${label}</span><strong>${value}</strong></article>`).join("");
  const orders=d.recentOrders||[];document.getElementById("recent-orders").innerHTML=orders.length?orders.map(o=>`<tr><td>${esc(o.id)}</td><td>${esc(o.customerName)}</td><td>${cash(o.total)}</td><td>${esc(o.paymentMethod)}</td><td>${esc(o.couponCode)}${o.familyDiscount?`<small>Family −${cash(o.familyDiscount)}</small>`:""}</td><td>${new Date(o.date).toLocaleDateString()}</td></tr>`).join(""):'<tr><td colspan="6">No orders have been placed yet.</td></tr>';
  const entries=Object.entries(d.paymentMethods||{});document.getElementById("payment-mix").innerHTML=entries.length?entries.map(([name,count])=>`<div class="payment-row"><span>${esc(name)}</span><strong>${count}</strong><div class="payment-track"><i style="width:${Math.min(100,count/Math.max(...entries.map(x=>x[1]))*100)}%"></i></div></div>`).join(""):'<p class="muted">Payment data will appear after the first order.</p>';
 }catch(e){error.textContent=e.message+". Make sure the Node server and MongoDB are running.";error.classList.remove("hidden");}
}
loadProjectDashboard();
