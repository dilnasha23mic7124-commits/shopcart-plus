let products = [];
let currentCategory = "All";
let currentDepartment = "All";
let wishlist = JSON.parse(localStorage.getItem("shopcart-wishlist") || "[]");
const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const money = n => "₹" + Number(n).toLocaleString("en-IN");

async function api(url, options={}) {
  const res = await fetch(url, {headers: {"Content-Type":"application/json"}, ...options});
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

async function init() {
  try {
    products = await api("/api/products");
    const customers = await api("/api/customers");
    const select = document.getElementById("customer");
    select.innerHTML = customers.map((c,i) => `<option value="${safe(c.id)}" ${i === 0 ? "selected" : ""}>${safe(c.name)}</option>`).join("");
    select.addEventListener("change", () => { loadCart(); loadOrders(); });
    renderProducts();
    document.querySelectorAll(".department").forEach(btn => btn.addEventListener("click", () => {
      currentDepartment = btn.dataset.dept;
      document.querySelectorAll(".department").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b.dataset.cat === "All"));
      currentCategory = "All"; renderProducts();
    }));
    setupTheme();
    const recommendSelect = document.getElementById("recommend-product");
    recommendSelect.innerHTML = products.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
    await loadRecommendations();
    await loadCart();
    await loadOrders();
    await loadAnalytics();
    renderWishlist();
  } catch (e) { toast("Start Redis and the server first"); console.error(e); }
}

function renderProducts() {
  const q = document.getElementById("search").value.toLowerCase();
  const lang = localStorage.getItem("shopcart-language") || "en-IN";
  const addLabel = (translations[lang] || {})["add to cart"] || "Add to cart";
  const list = products.filter(p => (currentCategory==="All" || p.category===currentCategory) && (currentDepartment==="All" || p.category===currentDepartment || (currentDepartment==="Women" && /dress|tote|beauty|skincare/i.test(p.name)) || (currentDepartment==="Men" && /men|watch|hoodie|backpack|shoes/i.test(p.name))) && `${p.name} ${p.category}`.toLowerCase().includes(q));
  document.getElementById("products").innerHTML = list.map(p => `
    <article class="product">
      <div class="product-art"><div class="pic">${p.icon}</div>${p.tag ? `<span class="product-tag">${safe(p.tag)}</span>` : ""}<button class="heart ${wishlist.includes(p.id)?"saved":""}" aria-label="Save ${safe(p.name)}" onclick="toggleWishlist('${p.id}')">${wishlist.includes(p.id)?"♥":"♡"}</button></div>
      <span class="cat">${safe(p.category)} · ⭐ ${p.rating || "4.5"}</span>
      <h3>${safe(p.name)}</h3>
      <div class="price">${money(p.price)} ${p.oldPrice ? `<del>${money(p.oldPrice)}</del>` : ""}</div>
      <p class="stock ${p.stock <= 5 ? "low" : ""}">${p.stock <= 5 ? `⚡ Only ${p.stock} left in stock` : `✓ In stock · ${p.stock} available`}</p>
      <button class="add" onclick="addToCart('${p.id}')">${addLabel}</button>
    </article>
  `).join("") || `<div class="empty">No products found. Try another search or category.</div>`;
}

async function addToCart(productId) {
  try {
    const id = document.getElementById("customer").value;
    const result = await api(`/api/cart/${id}/add`, {method:"POST", body:JSON.stringify({productId})});
    toast(result.message);
    await loadCart();
  } catch(e) { toast(e.message); }
}

async function loadCart() {
  const id = document.getElementById("customer").value;
  const data = await api(`/api/cart/${id}`);
  document.getElementById("cart-title").textContent = `${data.customer.name}'s Cart`;
  const familyInput = document.getElementById("family-code");
  if (familyInput) familyInput.value = data.customer.familyCode || "";
  document.getElementById("subtotal").textContent = money(data.total);
  const discount = data.total >= 2000 ? Math.round(data.total * 0.10) : 0;
  const delivery = data.total >= 1000 || data.total === 0 ? 0 : 79;
  document.getElementById("discount").textContent = "−" + money(discount);
  document.getElementById("delivery").textContent = delivery === 0 ? "FREE" : money(delivery);
  document.getElementById("total").textContent = money(Math.max(0, data.total + delivery - discount));
  updateRewards(data.total);
  document.getElementById("ttl").textContent = data.ttl > 0 ? `Expires in ${formatTTL(data.ttl)}` : "Cart not started";

  const box = document.getElementById("cart-items");
  if (!data.cart.length) {
    box.innerHTML = `<div class="empty">Your cart is empty.<br>Add a product to get started.</div>`;
    return;
  }
  box.innerHTML = data.cart.map(item => `
    <div class="cart-item">
      <div class="mini">${item.icon}</div>
      <div class="item-info"><h4>${safe(item.name)}</h4><div class="muted">${money(item.price)} each</div>${item.stock <= 5 ? `<div class="cart-stock">⚡ Only ${item.stock} left in stock</div>` : ""}</div>
      <div class="qty">
        <button onclick="changeQty('${item.id}', ${item.qty-1})">−</button>
        <b>${item.qty}</b>
        <button onclick="changeQty('${item.id}', ${item.qty+1})">+</button>
      </div>
      <b>${money(item.price * item.qty)}</b>
      <button class="remove" onclick="removeItem('${item.id}')">Remove</button>
    </div>
  `).join("");
}

function updateRewards(total) {
  const next = total < 1000 ? 1000 : total < 2000 ? 2000 : 2000;
  const percent = Math.min(100, total / 2000 * 100);
  document.getElementById("reward-progress").style.width = percent + "%";
  document.querySelector(".truck").style.left = percent + "%";
  document.getElementById("reward-label").textContent = total >= 2000 ? "All rewards unlocked!" : total >= 1000 ? "Free shipping unlocked" : "Free shipping at ₹1,000";
  document.getElementById("reward-message").textContent = total >= 2000 ? "🎉 10% off + a free sample unlocked!" : total >= 1000 ? `Only ${money(2000-total)} more to unlock 10% off + a free sample.` : `Add ${money(1000-total)} more to unlock free shipping.`;
  document.getElementById("tier-shipping").textContent = total >= 1000 ? "✓ Free shipping unlocked" : "○ Free shipping · ₹1,000";
  document.getElementById("tier-gift").textContent = total >= 2000 ? "✓ 10% off + free sample unlocked" : "○ 10% off + free sample · ₹2,000";
}

async function changeQty(productId, qty) {
  if (qty < 1) return removeItem(productId);
  const id = document.getElementById("customer").value;
  await api(`/api/cart/${id}/item/${productId}`, {method:"PATCH", body:JSON.stringify({qty})});
  loadCart();
}

async function removeItem(productId) {
  const id = document.getElementById("customer").value;
  await api(`/api/cart/${id}/item/${productId}`, {method:"DELETE"});
  toast("Item removed");
  loadCart();
}

async function clearCart() {
  const id = document.getElementById("customer").value;
  await api(`/api/cart/${id}`, {method:"DELETE"});
  toast("Cart cleared");
  loadCart();
}

async function checkout() {
  const id = document.getElementById("customer").value;
  try {
    const data = await api(`/api/checkout/${id}`, {method:"POST", body:JSON.stringify({
      paymentMethod:document.getElementById("payment-method").value,
      couponCode:document.getElementById("coupon-code").value.trim()
    })});
    document.getElementById("success-order").textContent = `${data.order.id} · ${money(data.order.total)} · ${data.order.paymentMethod} · ${data.order.paymentStatus}`;
    document.getElementById("coupon-code").value = "";
    document.getElementById("coupon-message").textContent = "Try WELCOME50, SAVE100, SAVE10 or FESTIVE15.";
    document.getElementById("success-modal").classList.remove("hidden");
    launchConfetti();
    if (data.analyticsWarning) console.warn(data.analyticsWarning);
    loadCart(); loadOrders(); loadAnalytics();
  } catch(e) { toast(e.message); }
}

async function loadOrders() {
  const id = document.getElementById("customer").value;
  const orders = await api(`/api/orders/${id}`);
  document.getElementById("orders").innerHTML = orders.length ? orders.slice(0,5).map(o => `
    <div class="order">
      <div><div class="order-id">${o.id}</div><div class="order-date">${new Date(o.date).toLocaleString()}</div></div>
      <div class="order-total">${money(o.total)}</div>
    </div>
  `).join("") : `<div class="empty">No orders yet.</div>`;
}

function formatTTL(sec) {
  const m = Math.floor(sec/60), s = sec%60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function toast(message) {
  const t = document.getElementById("toast");
  t.textContent = message; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2200);
}

document.getElementById("search").addEventListener("input", renderProducts);
document.querySelectorAll(".filter").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".filter").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".department").forEach(b=>b.classList.toggle("active",b.dataset.dept==="All"));
  btn.classList.add("active"); currentDepartment="All"; currentCategory = btn.dataset.cat; renderProducts();
}));

function setupTheme(){
  const saved=localStorage.getItem("shopcart-theme") || "light";
  document.documentElement.dataset.theme=saved;
  const btn=document.getElementById("theme-toggle");
  const paint=()=>{btn.textContent=document.documentElement.dataset.theme==="dark"?"☀️ Light mode":"🌙 Dark mode";};
  paint();
  btn.addEventListener("click",()=>{const next=document.documentElement.dataset.theme==="dark"?"light":"dark";document.documentElement.dataset.theme=next;localStorage.setItem("shopcart-theme",next);paint();});
}
function closeSuccess(){document.getElementById("success-modal").classList.add("hidden");document.getElementById("products").scrollIntoView({behavior:"smooth"});}
function launchConfetti(){
  const box=document.getElementById("confetti");box.innerHTML="";
  for(let i=0;i<36;i++){const bit=document.createElement("i");bit.style.setProperty("--x",`${Math.random()*100}%`);bit.style.setProperty("--delay",`${Math.random()*.5}s`);bit.textContent=["✦","●","✧","★"][i%4];box.appendChild(bit);}
  setTimeout(()=>box.innerHTML="",2600);
}
init();


async function loadAnalytics() {
  const status = document.getElementById("analytics-status");
  if (!status) return;
  try {
    const data = await api("/api/analytics/summary");
    if (!data.available) {
      status.textContent = data.error || "MonetDB analytics is unavailable.";
      document.getElementById("analytics-cards").innerHTML = "";
      document.getElementById("monthly-sales").innerHTML = "<p class='muted'>Connect MonetDB to view reports.</p>";
      document.getElementById("top-products").innerHTML = "<p class='muted'>Connect MonetDB to view reports.</p>";
      return;
    }
    status.textContent = "Live analytical results from MonetDB. Orders are stored in MongoDB; Redis manages carts.";
    const s = data.summary || {};
    document.getElementById("analytics-cards").innerHTML = [
      ["Total orders", Number(s.order_count || 0).toLocaleString("en-IN")],
      ["Total revenue", money(s.total_revenue || 0)],
      ["Average order", money(s.average_order_value || 0)]
    ].map(([label,value]) => `<div class="analytics-card"><span>${label}</span><strong>${value}</strong></div>`).join("");
    const months = data.monthly || [];
    document.getElementById("monthly-sales").innerHTML = months.length ? months.map(m => `<div class="analytics-row"><span>${String(m.sales_year)}-${String(m.sales_month).padStart(2,"0")}</span><b>${money(m.revenue)}</b><small>${m.orders} orders</small></div>`).join("") : "<p class='muted'>No sales yet. Place an order to populate analytics.</p>";
    const top = data.topProducts || [];
    document.getElementById("top-products").innerHTML = top.length ? top.map((p,i) => `<div class="analytics-row"><span>${i+1}. ${p.product_name}</span><b>${Number(p.units_sold || 0)} sold</b><small>${money(p.revenue || 0)}</small></div>`).join("") : "<p class='muted'>No sales yet. Place an order to populate analytics.</p>";
  } catch (e) { status.textContent = e.message || "Could not load analytics."; }
}


async function loadRecommendations() {
  const status = document.getElementById("recommend-status");
  const box = document.getElementById("recommendations");
  if (!status || !box) return;
  try {
    const id = document.getElementById("recommend-product").value;
    const data = await api(`/api/recommendations/${id}`);
    status.textContent = data.connected
      ? "Powered by Neo4j graph relationships between products in the same category."
      : "Neo4j is not connected yet; showing category-based demo suggestions. Configure Neo4j to use graph recommendations.";
    box.innerHTML = data.recommendations.length ? data.recommendations.map(p => `
      <article class="recommend-card"><div class="recommend-icon">${p.icon || "🛍️"}</div><div><strong>${p.name}</strong><div class="muted">${p.category}</div><b>${money(p.price)}</b></div><button class="add" onclick="addToCart('${p.id}')">${addLabel}</button></article>
    `).join("") : "<p class='muted'>No similar products found yet.</p>";
  } catch (e) { status.textContent = e.message || "Could not load recommendations."; }
}


function openCustomerModal(){ document.getElementById("customer-modal").classList.remove("hidden"); document.getElementById("customer-name").focus(); }
function closeCustomerModal(){ document.getElementById("customer-modal").classList.add("hidden"); }
document.getElementById("customer-form").addEventListener("submit", async event => {
  event.preventDefault();
  const name = document.getElementById("customer-name").value.trim();
  try {
    const familyCode = document.getElementById("new-family-code").value.trim();
    const data = await api("/api/customers", {method:"POST", body:JSON.stringify({name, familyCode})});
    const select = document.getElementById("customer");
    let option = [...select.options].find(o => o.value === data.customer.id);
    if (!option) { option = new Option(data.customer.name, data.customer.id); select.add(option); }
    select.value = data.customer.id;
    closeCustomerModal(); document.getElementById("customer-name").value = ""; document.getElementById("new-family-code").value = "";
    await loadCart(); await loadOrders();
    toast(data.existing ? `Welcome back, ${data.customer.name}!` : `Welcome, ${data.customer.name}!`);
  } catch(e) { toast(e.message); }
});
function toggleWishlist(productId){
  wishlist = wishlist.includes(productId) ? wishlist.filter(id=>id!==productId) : [...wishlist,productId];
  localStorage.setItem("shopcart-wishlist", JSON.stringify(wishlist)); renderProducts(); renderWishlist();
}
function renderWishlist(){
  const box = document.getElementById("wishlist"); if(!box) return;
  const saved = products.filter(p=>wishlist.includes(p.id));
  box.innerHTML = saved.length ? saved.map(p=>`<article class="saved-item"><div class="mini">${p.icon}</div><div class="saved-info"><strong>${safe(p.name)}</strong><span>${money(p.price)}</span>${p.oldPrice ? `<em>↓ Price drop · was ${money(p.oldPrice)}</em>` : `<small>We'll flag listed discounts here.</small>`}</div><button class="add" onclick="addToCart('${p.id}')">Move to cart</button><button class="remove" onclick="toggleWishlist('${p.id}')">×</button></article>`).join("") : `<div class="empty">No saved products yet. Tap ♡ on any product to save it here.</div>`;
}


// Language selection: English (India), English (UK), Malayalam, Hindi, Tamil and Telugu.
const translations = {
  "en-IN": {},
  "en-GB": {"shop now":"Shop now →","add to cart":"Add to basket","place order":"Place order","your cart":"Your basket","order summary":"Order summary","search products":"Search products...","project dashboard":"Project dashboard ↗","customers":"Customers ↗","departments":"Departments","recent orders":"Recent orders","your wishlist":"Your wishlist","explore the collection":"Explore the collection","recommended for you":"Recommended for you","payment method":"Payment method","coupon code":"Voucher code","family group code":"Family group code (optional)","free shipping":"Free delivery"},
  "ml": {"shop now":"ഇപ്പോൾ ഷോപ്പ് ചെയ്യൂ →","add to cart":"കാർട്ടിൽ ചേർക്കുക","place order":"ഓർഡർ നൽകുക","your cart":"നിങ്ങളുടെ കാർട്ട്","order summary":"ഓർഡർ സംഗ്രഹം","search products":"ഉൽപ്പന്നങ്ങൾ തിരയുക...","project dashboard":"പ്രോജക്റ്റ് ഡാഷ്ബോർഡ് ↗","customers":"ഉപഭോക്താക്കൾ ↗","departments":"വിഭാഗങ്ങൾ","recent orders":"സമീപകാല ഓർഡറുകൾ","your wishlist":"നിങ്ങളുടെ വിഷ്‌ലിസ്റ്റ്","explore the collection":"ഉൽപ്പന്നങ്ങൾ കാണുക","recommended for you":"നിങ്ങൾക്കായി ശുപാർശ ചെയ്തത്","payment method":"പണമടയ്ക്കുന്ന രീതി","coupon code":"കൂപ്പൺ കോഡ്","family group code":"കുടുംബ ഗ്രൂപ്പ് കോഡ് (ഐച്ഛികം)"},
  "hi": {"shop now":"अभी खरीदें →","add to cart":"कार्ट में जोड़ें","place order":"ऑर्डर करें","your cart":"आपकी कार्ट","order summary":"ऑर्डर सारांश","search products":"उत्पाद खोजें...","project dashboard":"प्रोजेक्ट डैशबोर्ड ↗","customers":"ग्राहक ↗","departments":"श्रेणियाँ","recent orders":"हाल के ऑर्डर","your wishlist":"आपकी विशलिस्ट","explore the collection":"संग्रह देखें","recommended for you":"आपके लिए सुझाव","payment method":"भुगतान का तरीका","coupon code":"कूपन कोड","family group code":"परिवार समूह कोड (वैकल्पिक)"},
  "ta": {"shop now":"இப்போது வாங்குங்கள் →","add to cart":"கூடையில் சேர்","place order":"ஆர்டர் செய்","your cart":"உங்கள் கூடை","order summary":"ஆர்டர் சுருக்கம்","search products":"பொருட்களைத் தேடு...","project dashboard":"திட்ட டாஷ்போர்டு ↗","customers":"வாடிக்கையாளர்கள் ↗","departments":"பிரிவுகள்","recent orders":"சமீபத்திய ஆர்டர்கள்","your wishlist":"விருப்பப் பட்டியல்","explore the collection":"பொருட்களைப் பாருங்கள்","recommended for you":"உங்களுக்கான பரிந்துரைகள்","payment method":"கட்டண முறை","coupon code":"கூப்பன் குறியீடு","family group code":"குடும்பக் குழுக் குறியீடு (விருப்பம்)"},
  "te": {"shop now":"ఇప్పుడే కొనండి →","add to cart":"కార్ట్‌లో చేర్చండి","place order":"ఆర్డర్ చేయండి","your cart":"మీ కార్ట్","order summary":"ఆర్డర్ సారాంశం","search products":"ఉత్పత్తులను వెతకండి...","project dashboard":"ప్రాజెక్ట్ డ్యాష్‌బోర్డ్ ↗","customers":"కస్టమర్లు ↗","departments":"విభాగాలు","recent orders":"ఇటీవలి ఆర్డర్లు","your wishlist":"మీ విష్‌లిస్ట్","explore the collection":"ఉత్పత్తులను చూడండి","recommended for you":"మీ కోసం సూచనలు","payment method":"చెల్లింపు విధానం","coupon code":"కూపన్ కోడ్","family group code":"కుటుంబ గ్రూప్ కోడ్ (ఐచ్ఛికం)"}
};
function applyLanguage(code){
  const dict=translations[code]||{};
  document.documentElement.lang=code==="ml"?"ml":code==="hi"?"hi":code==="ta"?"ta":code==="te"?"te":code;
  document.querySelectorAll("[data-translate]").forEach(el=>{const key=el.dataset.translate;const value=dict[key];if(value)el.textContent=value;});
  document.querySelectorAll("[data-translate-placeholder]").forEach(el=>{const key=el.dataset.translatePlaceholder;if(dict[key])el.placeholder=dict[key];});
  document.querySelectorAll(".add").forEach(el=>{const key="add to cart";if(dict[key])el.textContent=dict[key];});
  const labels={"your wishlist":"Your wishlist","recent orders":"Recent orders"};
  document.querySelectorAll("[data-translate]").forEach(el=>{const key=el.dataset.translate;if(dict[key])el.textContent=dict[key];else if(code==="en-IN"&&labels[key])el.textContent=labels[key];});
  const btn=document.querySelector(".hero .primary");if(btn&&dict["shop now"])btn.textContent=dict["shop now"];
  localStorage.setItem("shopcart-language",code);
}
function previewCoupon(){
  const code=document.getElementById("coupon-code").value.trim().toUpperCase();
  const messages={WELCOME50:"₹50 off on ₹500+",SAVE100:"₹100 off on ₹1,000+",SAVE10:"10% off on ₹2,000+",FESTIVE15:"15% off on ₹3,000+"};
  const box=document.getElementById("coupon-message");
  if(!code){box.textContent="Enter a coupon code first.";return;}
  box.textContent=messages[code]?`${code}: ${messages[code]}. Final eligibility is checked at checkout.`:"Coupon not recognised. Try WELCOME50, SAVE100, SAVE10 or FESTIVE15.";
}
function setupFestivalPortal(){
  const now=new Date();const year=now.getFullYear();
  // Dates are promotional placeholders and should be reviewed each year, especially lunar-calendar festivals.
  const events=[
    {name:"Diwali",date:new Date(year,10,8),icon:"🪔",coupon:"FESTIVE15",copy:"Light up your celebrations with 15% off eligible orders of ₹3,000+."},
    {name:"Christmas",date:new Date(year,11,25),icon:"🎄",coupon:"SAVE10",copy:"Gift-ready deals: use SAVE10 on eligible orders of ₹2,000+."},
    {name:"Eid",date:new Date(year+1,2,10),icon:"🌙",coupon:"SAVE100",copy:"Celebrate together with ₹100 off eligible orders of ₹1,000+."},
    {name:"Onam",date:new Date(year,7,26),icon:"🌼",coupon:"FESTIVE15",copy:"Onam special: use FESTIVE15 on eligible orders of ₹3,000+."}
  ].filter(e=>e.date>=new Date(now.getFullYear(),now.getMonth(),now.getDate())).sort((a,b)=>a.date-b.date);
  let event=events[0];if(!event){event={name:"Festive savings",icon:"🎉",coupon:"SAVE100",copy:"Use SAVE100 for ₹100 off eligible orders of ₹1,000+."};}
  document.getElementById("festival-title").textContent=`${event.icon} ${event.name} offers`;
  document.getElementById("festival-copy").textContent=event.copy;
  document.getElementById("festival-coupon").textContent=event.coupon;
  document.getElementById("coupon-code").value="";
  document.getElementById("festival-portal").classList.remove("hidden");
}
const langSelect=document.getElementById("language-select");
if(langSelect){langSelect.value=localStorage.getItem("shopcart-language")||"en-IN";langSelect.addEventListener("change",()=>applyLanguage(langSelect.value));applyLanguage(langSelect.value);}
setupFestivalPortal();
