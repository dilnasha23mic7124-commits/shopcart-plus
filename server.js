require("dotenv").config();
const express = require("express");
const path = require("path");
const { createClient } = require("redis");
const { MongoClient } = require("mongodb");
const { Connection } = require("monetdb");
const neo4j = require("neo4j-driver");

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const MONGODB_DB = process.env.MONGODB_DB || "online_shopping";
const MONETDB_URL = process.env.MONETDB_URL || ""; // mapi:monetdb://user:password@localhost:50000/analytics
const NEO4J_URI = process.env.NEO4J_URI || "";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
const redis = createClient({
  url: REDIS_URL,
  socket: {
    tls: REDIS_URL.startsWith("rediss://") ||
         REDIS_URL.includes("upstash.io")
  }
});
redis.on("error", err => console.error("Redis error:", err.message));
const mongoClient = new MongoClient(MONGODB_URI);
let db, ordersCollection, productsCollection, monetConn = null, monetReady = false;
let neoDriver = null, neoReady = false;

const products = [
  { id:"p1", name:"NovaBook Air Laptop", price:62500, oldPrice:68999, icon:"💻", category:"Electronics", stock:3, rating:4.8, tag:"Bestseller" },
  { id:"p2", name:"SilentClick Wireless Mouse", price:1200, icon:"🖱️", category:"Accessories", stock:18, rating:4.5 },
  { id:"p3", name:"PixelPro 5G Phone", price:28000, oldPrice:30999, icon:"📱", category:"Electronics", stock:7, rating:4.7, tag:"Price drop" },
  { id:"p4", name:"Pulse ANC Earbuds", price:3500, oldPrice:3999, icon:"🎧", category:"Audio", stock:5, rating:4.6, tag:"Deal" },
  { id:"p5", name:"FitTrack Smart Watch", price:8500, icon:"⌚", category:"Wearables", stock:12, rating:4.4 },
  { id:"p6", name:"Mechanical RGB Keyboard", price:3200, icon:"⌨️", category:"Accessories", stock:9, rating:4.7 },
  { id:"p7", name:"UltraView 27-inch Monitor", price:14500, icon:"🖥️", category:"Electronics", stock:4, rating:4.6 },
  { id:"p8", name:"20,000mAh Power Bank", price:1800, icon:"🔋", category:"Accessories", stock:22, rating:4.3 },
  { id:"p9", name:"Studio Bluetooth Speaker", price:4200, oldPrice:4999, icon:"🔊", category:"Audio", stock:6, rating:4.5 },
  { id:"p10", name:"DSLR Creator Camera", price:45900, icon:"📷", category:"Electronics", stock:4, rating:4.8 },
  { id:"p11", name:"Portable Mini Projector", price:12999, icon:"📽️", category:"Electronics", stock:8, rating:4.2 },
  { id:"p12", name:"Ergo Office Chair", price:8999, icon:"🪑", category:"Home", stock:11, rating:4.5 },
  { id:"p13", name:"Minimal Desk Lamp", price:1499, icon:"💡", category:"Home", stock:20, rating:4.3 },
  { id:"p14", name:"Everyday Backpack", price:2199, icon:"🎒", category:"Fashion", stock:14, rating:4.4 },
  { id:"p15", name:"Classic Running Shoes", price:3499, oldPrice:4299, icon:"👟", category:"Fashion", stock:6, rating:4.6, tag:"Price drop" },
  { id:"p16", name:"Cotton Hoodie", price:1799, icon:"🧥", category:"Fashion", stock:16, rating:4.2 },
  { id:"p17", name:"Stainless Steel Bottle", price:699, icon:"🥤", category:"Lifestyle", stock:30, rating:4.5 },
  { id:"p18", name:"Yoga Mat + Strap", price:1299, icon:"🧘", category:"Fitness", stock:13, rating:4.4 },
  { id:"p19", name:"Resistance Band Set", price:799, icon:"🏋️", category:"Fitness", stock:24, rating:4.3 },
  { id:"p20", name:"Skincare Essentials Kit", price:1599, icon:"🧴", category:"Beauty", stock:10, rating:4.4 },
  { id:"p21", name:"Ceramic Coffee Mug Set", price:999, icon:"☕", category:"Home", stock:17, rating:4.5 },
  { id:"p22", name:"Smart Home Plug", price:1099, icon:"🔌", category:"Electronics", stock:19, rating:4.1 },
  { id:"p23", name:"Gaming Controller", price:2999, icon:"🎮", category:"Gaming", stock:5, rating:4.7 },
  { id:"p24", name:"Premium Notebook Set", price:499, icon:"📓", category:"Stationery", stock:28, rating:4.2 },
  { id:"p25", name:"Floral Midi Dress", price:1899, icon:"👗", category:"Women", stock:12, rating:4.7, tag:"New" },
  { id:"p26", name:"Everyday Tote Bag", price:1299, icon:"👜", category:"Women", stock:16, rating:4.5 },
  { id:"p27", name:"Glow Beauty Bundle", price:999, icon:"💄", category:"Beauty", stock:14, rating:4.6 },
  { id:"p28", name:"Men's Casual Shirt", price:1499, icon:"👔", category:"Men", stock:18, rating:4.5 },
  { id:"p29", name:"Classic Analog Watch", price:2299, icon:"⌚", category:"Men", stock:9, rating:4.6 },
  { id:"p30", name:"Kids' Building Blocks", price:799, icon:"🧱", category:"Kids", stock:20, rating:4.8, tag:"Family pick" },
  { id:"p31", name:"Kids' Colorful Backpack", price:899, icon:"🎒", category:"Kids", stock:15, rating:4.4 },
  { id:"p32", name:"Adjustable Dumbbells", price:3499, icon:"🏋️", category:"Fitness", stock:7, rating:4.7 },
  { id:"p33", name:"JBL Portable Speaker", price:4999, icon:"🔊", category:"Audio", stock:8, rating:4.8 },
  { id:"p34", name:"Over-Ear Studio Headphones", price:2799, icon:"🎧", category:"Audio", stock:11, rating:4.6 },
  { id:"p35", name:"Kitchen Utensil Set", price:1199, icon:"🍳", category:"Lifestyle", stock:13, rating:4.4 },
  { id:"p36", name:"Compact Travel Umbrella", price:599, icon:"☂️", category:"Lifestyle", stock:22, rating:4.3 }
];
let customers = [
  { id:"C101", name:"Aarav Sharma", createdAt:new Date().toISOString() },
  { id:"C102", name:"Priya Reddy", createdAt:new Date().toISOString() },
  { id:"C103", name:"Arjun Kumar", createdAt:new Date().toISOString() }
];
let customersCollection;
const cartKey = id => `cart:${id}`;

async function getCart(id) { const raw = await redis.get(cartKey(id)); return raw ? JSON.parse(raw) : []; }
async function saveCart(id, cart) { await redis.set(cartKey(id), JSON.stringify(cart)); await redis.expire(cartKey(id), 1800); }
function sqlString(v) { return "'" + String(v ?? "").replace(/'/g, "''") + "'"; }
function sqlNumber(v) { const n = Number(v); if (!Number.isFinite(n)) throw new Error("Invalid numeric value for analytics"); return String(n); }

async function setupMonetDB() {
  if (!MONETDB_URL) { console.log("MonetDB not configured. Set MONETDB_URL in .env to enable analytics."); return; }
  try {
    monetConn = new Connection(MONETDB_URL);
    await monetConn.connect();
    await monetConn.execute(`CREATE TABLE IF NOT EXISTS sales_orders (order_id VARCHAR(80), customer_id VARCHAR(20), order_date TIMESTAMP, total DECIMAL(12,2), item_count INT)`);
    await monetConn.execute(`CREATE TABLE IF NOT EXISTS sales_order_items (order_id VARCHAR(80), product_id VARCHAR(20), product_name VARCHAR(120), category VARCHAR(80), quantity INT, unit_price DECIMAL(12,2), line_total DECIMAL(12,2))`);
    monetReady = true;
    console.log("MonetDB connected; analytics tables are ready.");
  } catch (err) {
    monetReady = false;
    console.error("MonetDB connection/setup failed:", err.message);
    console.error("The shop will still run, but analytics need a working MonetDB connection.");
    try { if (monetConn) await monetConn.close(); } catch (_) {}
    monetConn = null;
  }
}
async function syncOrderToMonet(order, customerId) {
  if (!monetReady) return false;
  // Delete first so retrying a sync does not duplicate an order's analytical rows.
  await monetConn.execute(`DELETE FROM sales_order_items WHERE order_id = ${sqlString(order.id)}`);
  await monetConn.execute(`DELETE FROM sales_orders WHERE order_id = ${sqlString(order.id)}`);
  await monetConn.execute(`INSERT INTO sales_orders VALUES (${sqlString(order.id)}, ${sqlString(customerId)}, ${sqlString(order.date.replace('T',' ').replace('Z',''))}, ${sqlNumber(order.total)}, ${sqlNumber(order.items.reduce((n,i)=>n+i.qty,0))})`);
  for (const item of order.items) {
    await monetConn.execute(`INSERT INTO sales_order_items VALUES (${sqlString(order.id)}, ${sqlString(item.id)}, ${sqlString(item.name)}, ${sqlString(item.category)}, ${sqlNumber(item.qty)}, ${sqlNumber(item.price)}, ${sqlNumber(item.qty * item.price)})`);
  }
  return true;
}

async function setupNeo4j() {
  if (!NEO4J_URI || !NEO4J_PASSWORD) {
    console.log("Neo4j not configured. Set NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD to enable graph recommendations.");
    return;
  }
  try {
    neoDriver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
    await neoDriver.verifyConnectivity();
    const session = neoDriver.session();
    try {
      for (const p of products) {
        await session.run(
          "MERGE (p:Product {id:$id}) SET p.name=$name, p.category=$category, p.price=$price, p.icon=$icon",
          { id:p.id, name:p.name, category:p.category, price:p.price, icon:p.icon }
        );
      }
      await session.run(`MATCH (a:Product), (b:Product) WHERE a.id < b.id AND a.category = b.category MERGE (a)-[:RELATED_TO {reason:'same category'}]-(b)`);
      neoReady = true;
      console.log("Neo4j connected; product recommendation graph is ready.");
    } finally { await session.close(); }
  } catch (err) {
    neoReady = false;
    console.error("Neo4j connection/setup failed:", err.message);
    if (neoDriver) { try { await neoDriver.close(); } catch (_) {} }
    neoDriver = null;
  }
}

function rowsOf(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  if (result && Array.isArray(result.data)) return result.data;
  return [];
}

app.get("/api/products", async (req, res) => res.json(products));
app.get("/api/customers", async (req, res) => {
  try { if (customersCollection) { const stored = await customersCollection.find({}).sort({createdAt:1}).toArray(); if (stored.length) customers = stored.map(({_id,...c})=>c); } res.json(customers); }
  catch(e) { res.status(500).json({error:"Could not load customers"}); }
});
app.post("/api/customers", async (req,res) => {
  try {
    const name = String(req.body.name || "").trim().replace(/\s+/g," ");
    if (name.length < 2 || name.length > 60) return res.status(400).json({error:"Enter a name between 2 and 60 characters."});
    const existing = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return res.json({customer:existing, existing:true});
    const familyCode = String(req.body.familyCode || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0,24);
    const customer = {id:"C" + Date.now().toString().slice(-8), name, ...(familyCode ? {familyCode} : {}), createdAt:new Date().toISOString()};
    if (customersCollection) await customersCollection.insertOne(customer);
    customers.push(customer);
    res.status(201).json({customer, existing:false});
  } catch(e) { res.status(500).json({error:"Could not register customer"}); }
});
app.get("/api/customer-stats", async (req,res) => {
  try {
    const list = customersCollection ? await customersCollection.find({}).toArray() : customers;
    const orders = ordersCollection ? await ordersCollection.find({}).toArray() : [];
    const unique = new Set(orders.map(o=>o.customerId));
    res.json({totalCustomers:list.length, customersWithOrders:unique.size, totalOrders:orders.length, recentCustomers:list.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,12).map(({_id,...c})=>c)});
  } catch(e) { res.status(500).json({error:"Could not load customer statistics"}); }
});
app.get("/api/project-dashboard", async (req,res) => {
  try {
    const allOrders = ordersCollection ? await ordersCollection.find({}).sort({date:-1}).limit(200).toArray() : [];
    const allCustomers = customersCollection ? await customersCollection.find({}).toArray() : customers;
    const totalRevenue = allOrders.reduce((sum,o)=>sum+Number(o.total||0),0);
    const paymentMethods = allOrders.reduce((acc,o)=>{const key=o.paymentMethod||"Not recorded";acc[key]=(acc[key]||0)+1;return acc;},{});
    res.json({
      stats:{products:products.length,customers:allCustomers.length,orders:allOrders.length,revenue:totalRevenue,averageOrder:allOrders.length?totalRevenue/allOrders.length:0},
      services:{redis:redis.isOpen,mongodb:!!db,monetdb:monetReady,neo4j:neoReady},
      paymentMethods,
      recentOrders:allOrders.slice(0,12).map(o=>({id:o.id,customerName:o.customerName||o.customerId,total:Number(o.total||0),date:o.date,status:o.status||"PLACED",paymentMethod:o.paymentMethod||"Not recorded",couponCode:o.couponCode||"—",familyDiscount:Number(o.familyDiscount||0)}))
    });
  } catch(e) { console.error("Project dashboard error:",e.message); res.status(500).json({error:"Could not load project dashboard"}); }
});
app.get("/api/status", (req,res) => res.json({ redis: redis.isOpen, mongodb: !!db, monetdb: monetReady, neo4j: neoReady }));
app.get("/api/recommendations/:productId", async (req,res) => {
  const product = products.find(p => p.id === req.params.productId);
  if (!product) return res.status(404).json({error:"Product not found"});
  try {
    if (neoReady) {
      const session = neoDriver.session();
      try {
        const result = await session.run("MATCH (p:Product {id:$id})-[:RELATED_TO]-(r:Product) WHERE r.id <> $id RETURN r.id AS id, r.name AS name, r.category AS category, r.price AS price, r.icon AS icon ORDER BY r.name LIMIT 4", {id: product.id});
        const items = result.records.map(record => ({id:record.get("id"),name:record.get("name"),category:record.get("category"),price:record.get("price"),icon:record.get("icon")}));
        return res.json({source:"Neo4j graph", connected:true, recommendations:items});
      } finally { await session.close(); }
    }
    const items = products.filter(p => p.id !== product.id && p.category === product.category).slice(0,4);
    return res.json({source:"Category fallback (Neo4j not connected)", connected:false, recommendations:items});
  } catch (err) {
    console.error("Recommendation query failed:", err.message);
    return res.status(500).json({error:"Could not load recommendations"});
  }
});
app.get("/api/cart/:customerId", async (req, res) => {
  try { const id=req.params.customerId; const customer=customers.find(c=>c.id===id); if(!customer) return res.status(404).json({error:"Customer not found"}); const cart=await getCart(id); const total=cart.reduce((s,x)=>s+x.price*x.qty,0); const ttl=await redis.ttl(cartKey(id)); res.json({customer,cart,total,ttl}); }
  catch(e){res.status(500).json({error:"Could not load cart"});}
});
app.post("/api/cart/:customerId/add", async (req,res)=>{
  try { const id=req.params.customerId; if(!customers.some(c=>c.id===id)) return res.status(404).json({error:"Customer not found"}); const product=products.find(p=>p.id===req.body.productId); if(!product) return res.status(404).json({error:"Product not found"}); const cart=await getCart(id); const item=cart.find(x=>x.id===product.id); if(item)item.qty+=1;else cart.push({...product,qty:1}); await saveCart(id,cart); res.json({message:`${product.name} added`,cart}); }
  catch(e){res.status(500).json({error:"Could not update cart"});}
});
app.patch("/api/cart/:customerId/item/:productId", async(req,res)=>{
  try {const cart=await getCart(req.params.customerId);const item=cart.find(x=>x.id===req.params.productId);if(!item)return res.status(404).json({error:"Item not found"});item.qty=Math.max(1,Math.min(99,Number(req.body.qty)||1));await saveCart(req.params.customerId,cart);res.json({cart});}
  catch(e){res.status(500).json({error:"Could not update quantity"});}
});
app.delete("/api/cart/:customerId/item/:productId",async(req,res)=>{try{const id=req.params.customerId;const cart=(await getCart(id)).filter(x=>x.id!==req.params.productId);await saveCart(id,cart);res.json({cart});}catch(e){res.status(500).json({error:"Could not remove item"});}});
app.delete("/api/cart/:customerId",async(req,res)=>{try{await redis.del(cartKey(req.params.customerId));res.json({message:"Cart cleared"});}catch(e){res.status(500).json({error:"Could not clear cart"});}});
app.post("/api/checkout/:customerId",async(req,res)=>{
  try {
    const id=req.params.customerId; const customer=customers.find(c=>c.id===id); if(!customer)return res.status(404).json({error:"Customer not found"});
    const cart=await getCart(id);if(!cart.length)return res.status(400).json({error:"Cart is empty"});
    const subtotal=cart.reduce((sum,item)=>sum+item.price*item.qty,0);
    const paymentMethod=String(req.body.paymentMethod||"COD");
    const allowedPayments=["GPay / UPI (demo)","Credit / Debit card (demo)","Cash on delivery"];
    if(!allowedPayments.includes(paymentMethod)) return res.status(400).json({error:"Choose a supported payment method."});
    const couponCode=String(req.body.couponCode||"").trim().toUpperCase();
    const couponRules={
      "WELCOME50":{min:500,type:"fixed",value:50,label:"₹50 off orders of ₹500+"},
      "SAVE100":{min:1000,type:"fixed",value:100,label:"₹100 off orders of ₹1,000+"},
      "SAVE10":{min:2000,type:"percent",value:10,label:"10% off orders of ₹2,000+"},
      "FESTIVE15":{min:3000,type:"percent",value:15,label:"15% off festive orders of ₹3,000+"}
    };
    let couponDiscount=0;
    if(couponCode){const rule=couponRules[couponCode];if(!rule)return res.status(400).json({error:"That coupon code is not valid. Try WELCOME50, SAVE100, SAVE10 or FESTIVE15."});if(subtotal<rule.min)return res.status(400).json({error:`${couponCode} requires a cart subtotal of ₹${rule.min.toLocaleString("en-IN")} or more.`});couponDiscount=rule.type==="fixed"?rule.value:Math.round(subtotal*rule.value/100);}
    const familyCode=String(customer.familyCode||"").trim().toUpperCase();
    const familyMembers=familyCode?customers.filter(c=>String(c.familyCode||"").trim().toUpperCase()===familyCode):[];
    const familyEligible=familyMembers.length>=2 && subtotal>=1000;
    const familyDiscount=familyEligible?Math.round(subtotal*0.05):0;
    const automaticDiscount=subtotal>=2000?Math.round(subtotal*0.10):0;
    const discount=Math.min(Math.round(subtotal*0.30),automaticDiscount+couponDiscount+familyDiscount);
    const delivery=subtotal>=1000?0:79;
    const total=Math.max(0,subtotal+delivery-discount);
    const order={id:"ORD-"+Date.now(),customerId:id,customerName:customer.name,items:cart,subtotal,automaticDiscount,couponCode:couponCode||null,couponDiscount,familyCode:familyEligible?familyCode:null,familyMembersQualified:familyEligible?familyMembers.length:0,familyDiscount,discount,delivery,total,paymentMethod,paymentStatus:paymentMethod==="Cash on delivery"?"PAY ON DELIVERY":"DEMO ONLY - NOT CHARGED",date:new Date().toISOString(),status:"PLACED"};
    await ordersCollection.insertOne(order);
    let analyticsSynced=false, analyticsWarning=null;
    try { analyticsSynced=await syncOrderToMonet(order,id); }
    catch(err){analyticsWarning="Order saved to MongoDB, but MonetDB sync failed: "+err.message;console.error(analyticsWarning);}
    await redis.del(cartKey(id));
    res.json({message:"Order placed successfully",order,analyticsSynced,analyticsWarning});
  } catch(e){console.error("Checkout error:",e);res.status(500).json({error:"Checkout failed. Check MongoDB connection."});}
});
app.get("/api/orders/:customerId",async(req,res)=>{try{const orders=await ordersCollection.find({customerId:req.params.customerId}).sort({date:-1}).limit(20).toArray();res.json(orders);}catch(e){res.status(500).json({error:"Could not load orders"});}});

app.get("/api/analytics/summary",async(req,res)=>{
  if(!monetReady)return res.status(503).json({available:false,error:"MonetDB analytics is not connected. Configure MONETDB_URL and restart the server."});
  try {
    const summary=rowsOf(await monetConn.execute(`SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS total_revenue, COALESCE(AVG(total), 0) AS average_order_value FROM sales_orders`));
    const today=rowsOf(await monetConn.execute(`SELECT COUNT(*) AS today_orders, COALESCE(SUM(total), 0) AS today_revenue FROM sales_orders WHERE CAST(order_date AS DATE) = CURRENT_DATE`));
    const monthly=rowsOf(await monetConn.execute(`SELECT EXTRACT(YEAR FROM order_date) AS sales_year, EXTRACT(MONTH FROM order_date) AS sales_month, SUM(total) AS revenue, COUNT(*) AS orders FROM sales_orders GROUP BY EXTRACT(YEAR FROM order_date), EXTRACT(MONTH FROM order_date) ORDER BY sales_year, sales_month`));
    const top=rowsOf(await monetConn.execute(`SELECT product_name, SUM(quantity) AS units_sold, SUM(line_total) AS revenue FROM sales_order_items GROUP BY product_name ORDER BY units_sold DESC LIMIT 5`));
    res.json({available:true,summary:summary[0]||{order_count:0,total_revenue:0,average_order_value:0},today:today[0]||{today_orders:0,today_revenue:0},monthly,topProducts:top});
  } catch(e){console.error("Analytics query failed:",e);res.status(500).json({available:false,error:"MonetDB analytics query failed: "+e.message});}
});
app.post("/api/analytics/sync-existing",async(req,res)=>{
  if(!monetReady)return res.status(503).json({error:"MonetDB is not connected. Configure MONETDB_URL and restart."});
  try {const all=await ordersCollection.find({}).toArray();let synced=0;for(const order of all){await syncOrderToMonet(order,order.customerId||"UNKNOWN");synced++;}res.json({message:"Existing MongoDB orders synchronized to MonetDB",synced});}
  catch(e){console.error(e);res.status(500).json({error:"Could not synchronize existing orders: "+e.message});}
});

async function seedDemoCart(){const demo={C101:[{...products[0],qty:1},{...products[1],qty:1}],C102:[{...products[2],qty:1},{...products[3],qty:1}],C103:[{...products[4],qty:1}]};for(const id of Object.keys(demo)){if(!(await redis.exists(cartKey(id))))await saveCart(id,demo[id]);}}
async function start(){
  await redis.connect();
  await mongoClient.connect(); db=mongoClient.db(MONGODB_DB); ordersCollection=db.collection("orders");productsCollection=db.collection("products");customersCollection=db.collection("customers");
  await ordersCollection.createIndex({id:1},{unique:true}); await ordersCollection.createIndex({customerId:1,date:-1});
  const storedCustomers = await customersCollection.find({}).toArray();
  if (!storedCustomers.length) await customersCollection.insertMany(customers);
  else {
    const friendlyNames = ["Aarav Sharma", "Priya Reddy", "Arjun Kumar", "Meera Patel", "Kiran Rao"];
    customers = storedCustomers.map(({_id,...c}, i)=>({ ...c, name: /^customer\s*\d*$/i.test(c.name || "") ? (friendlyNames[i] || `Shopper ${i+1}`) : c.name }));
    for (const c of customers) await customersCollection.updateOne({id:c.id}, {$set:{name:c.name}});
  }
  await customersCollection.createIndex({id:1},{unique:true});
  await productsCollection.bulkWrite(products.map(p=>({updateOne:{filter:{id:p.id},update:{$set:p},upsert:true}})));
  console.log(`MongoDB connected (${MONGODB_DB}); product catalog synchronized.`);
  await setupMonetDB(); await setupNeo4j(); await seedDemoCart();
  app.listen(PORT,()=>console.log(`Shop running at http://localhost:${PORT}`));
}
start().catch(err=>{console.error("Startup failed:",err);process.exit(1);});
process.on("SIGINT",async()=>{try{if(redis.isOpen)await redis.quit();if(monetConn)await monetConn.close();if(neoDriver)await neoDriver.close();await mongoClient.close();}finally{process.exit(0);}});
