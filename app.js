
/* Muhasebe PWA v13 - Mali Tarım (Sezon Bazlı)
   Not: Bayi kayıtları tek bakiyeye dahil edilmez.
*/
const LS_KEY = "mt_v13_data";
const LS_VER = "mt_v13_ver";
const APP_VER = "v13.0.0-2026-01-04";

const PRODUCTS = [
  { id:"all", name:"Tümü" },
  { id:"bugday", name:"Buğday" },
  { id:"mercimek", name:"Mercimek" },
  { id:"misir2", name:"Mısır (2. Ürün)" },
  { id:"pamuk", name:"Pamuk" },
  { id:"sebze", name:"Sebze" },
  { id:"zeytin", name:"Zeytin Bahçesi" },
];

const INCOME_SUBS = {
  bugday:["Buğday Satışı"],
  mercimek:["Mercimek Satışı"],
  misir2:["Mısır Satışı"],
  pamuk:["Pamuk Satışı"],
  sebze:["Sebze Satışı"],
  zeytin:["Salamura Zeytin","Zeytinyağı"],
  all:["Gelir"]
};

// Kategoriler
const CATEGORIES = [
  { id:"tarla", name:"Tarla Gideri" },
  { id:"kisisel", name:"Kişisel Harcama" },
  { id:"ev", name:"Ev Harcaması" },
  { id:"zeytinYat", name:"Zeytin Bahçesi Gideri" },
  { id:"finance", name:"Finans/Nakit Çıkışı" }, // cari ödeme vs.
];

const SUBCATS = {
  tarla:["Tohum","Gübre","İlaç","Mazot","İşçilik (Gün)","Sulama","Elektrik (Tarla)","Nakliye","Hasat / Biçim","Yedek Parça","Diğer Tarla"],
  kisisel:["Sigara","Giyim","Fatura (Kişisel)","Ofis Yemek","Ofis Diğer","Lokanta","Kafe","Büfe","Yakıt (Araç)","Araç Bakım","Araç Vergi & Sigorta","Sağlık","Kişisel Bakım","Kişisel Alışveriş","Kişisel Diğer"],
  ev:["Çiftlik Ev Harcaması","Ev Faturalar","Ev Harçlık","Üniversite","Okul (İlkokul/Lise)","Ev Sağlık","Ev Giyim","Ev Alışveriş","Ev Diğer"],
  zeytinYat:["Arazi Temizleme","Fidan / Dikim","İşçilik","Sulama","Gübre","İlaç","Mazot","Budama","Diğer Zeytin"],
  finance:["Cari Ödeme","Çek Ödemesi","Senet Ödemesi","Diğer Finans"]
};

const LABOR_WORKS = ["Çapa / Ot Temizliği","Sulama","Hasat","Taş Toplama","Diğer"];

const UNIT_BY_SUB = {
  "Mazot":["Litre"],
  "Gübre":["Kg","Ton"],
  "Tohum":["Kg","Ton"],
  "İşçilik (Gün)":["Gün","Kişi","Günlük Ücret"], // special UI
  // others default no unit calc (direct total)
};

const MONEY = new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2});

function todayISO(){
  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function parseNum(x){
  if(x===null||x===undefined) return 0;
  if(typeof x==="number") return x;
  x=String(x).trim();
  if(!x) return 0;
  x=x.replace(/\./g,'').replace(',', '.'); // 1.234,56 -> 1234.56
  const v=parseFloat(x);
  return isNaN(v)?0:v;
}
function fmt(n){ return MONEY.format(n||0); }
function seasonLabel(y){ return `${y}/${y+1}`; }
function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36); }

function load(){
  try{
    const raw=localStorage.getItem(LS_KEY);
    if(!raw) return { tx:[], caris:[], pays:[], cek:[], bayi:[] };
    const data=JSON.parse(raw);
    return Object.assign({ tx:[], caris:[], pays:[], cek:[], bayi:[] }, data);
  }catch(e){
    return { tx:[], caris:[], pays:[], cek:[], bayi:[] };
  }
}
function save(data){
  localStorage.setItem(LS_KEY, JSON.stringify(data));
  localStorage.setItem(LS_VER, APP_VER);
}

let DB = load();

/* UI helpers */
function setSelectOptions(sel, opts){
  sel.innerHTML = "";
  opts.forEach(o=>{
    const opt=document.createElement("option");
    opt.value=o.value ?? o.id;
    opt.textContent=o.label ?? o.name ?? o;
    sel.appendChild(opt);
  });
}
function fillProducts(select){
  setSelectOptions(select, PRODUCTS.filter(p=>p.id!=="all"));
}
function fillProductsWithAll(select){
  setSelectOptions(select, PRODUCTS);
}

function refreshIncomeSubs(){
  const product=document.getElementById("incProduct").value;
  const list=INCOME_SUBS[product] || ["Gelir"];
  setSelectOptions(document.getElementById("incSub"), list.map(x=>({value:x,label:x})));
}
function refreshExpenseSubs(){
  const cat=document.getElementById("expCat").value;
  const subs=SUBCATS[cat] || ["Diğer"];
  setSelectOptions(document.getElementById("expSub"), subs.map(x=>({value:x,label:x})));
  onExpenseSubChanged();
}
function onExpenseSubChanged(){
  const sub=document.getElementById("expSub").value;
  const unitSel=document.getElementById("expUnit");
  const unitRow=document.getElementById("unitRow");
  const qtyRow=document.getElementById("qtyRow");
  const priceRow=document.getElementById("priceRow");
  const labor=document.getElementById("laborBlock");

  labor.classList.add("hidden");

  // default: hide qty/price unless unit calc exists
  const units = UNIT_BY_SUB[sub];
  if(!units || sub==="İlaç"){
    unitRow.classList.add("hidden");
    qtyRow.classList.add("hidden");
    priceRow.classList.add("hidden");
    return;
  }

  if(sub==="İşçilik (Gün)"){
    unitRow.classList.add("hidden");
    qtyRow.classList.add("hidden");
    priceRow.classList.add("hidden");
    labor.classList.remove("hidden");
    return;
  }

  unitRow.classList.remove("hidden");
  qtyRow.classList.remove("hidden");
  priceRow.classList.remove("hidden");
  setSelectOptions(unitSel, units.map(u=>({value:u,label:u})));
}

function recalcIncome(){
  const q=parseNum(document.getElementById("incQty").value);
  const u=parseNum(document.getElementById("incUnit").value);
  const total=q*u;
  if(q>0 && u>0) document.getElementById("incTotal").value = total.toFixed(2);
}
function recalcExpense(){
  const sub=document.getElementById("expSub").value;
  if(sub==="İlaç") return;
  if(sub==="İşçilik (Gün)"){
    const d=parseNum(document.getElementById("labDays").value);
    const p=parseNum(document.getElementById("labPeople").value);
    const w=parseNum(document.getElementById("labWage").value);
    const t=d*p*w;
    if(d>0 && p>0 && w>0) document.getElementById("expTotal").value = t.toFixed(2);
    return;
  }
  const q=parseNum(document.getElementById("expQty").value);
  const u=parseNum(document.getElementById("expUnitPrice").value);
  const total=q*u;
  if(q>0 && u>0) document.getElementById("expTotal").value = total.toFixed(2);
}

/* CRUD */
function addIncome(e){
  e.preventDefault();
  const season=parseInt(document.getElementById("incSeason").value||0,10);
  const product=document.getElementById("incProduct").value;
  const sub=document.getElementById("incSub").value;
  const date=document.getElementById("incDate").value || todayISO();
  const qty=parseNum(document.getElementById("incQty").value);
  const unit=parseNum(document.getElementById("incUnit").value);
  const total=parseNum(document.getElementById("incTotal").value);
  const note=document.getElementById("incNote").value.trim();

  if(!season || season<1900){ alert("Sezon yılı zorunlu."); return; }
  if(!product){ alert("Ürün seç."); return; }
  if(total<=0){ alert("Toplam tutar gir."); return; }

  DB.tx.unshift({
    id:uid(), type:"income",
    season, product,
    category:"Gelir", sub,
    date, amount:total,
    meta:{ qty, unit },
    note
  });
  save(DB);
  e.target.reset();
  document.getElementById("incSeason").value=season;
  document.getElementById("incProduct").value=product;
  refreshIncomeSubs();
  document.getElementById("incDate").value=todayISO();
  renderAll();
}

function addExpense(e){
  e.preventDefault();
  const season=parseInt(document.getElementById("expSeason").value||0,10);
  const product=document.getElementById("expProduct").value;
  const cat=document.getElementById("expCat").value;
  const sub=document.getElementById("expSub").value;
  const date=document.getElementById("expDate").value || todayISO();
  const total=parseNum(document.getElementById("expTotal").value);
  const note=document.getElementById("expNote").value.trim();

  if(!season || season<1900){ alert("Sezon yılı zorunlu."); return; }
  if(!product){ alert("Ürün seç."); return; }
  if(!cat){ alert("Kategori seç."); return; }
  if(total<=0){ alert("Toplam tutar gir."); return; }

  const meta = {};
  if(sub==="İşçilik (Gün)"){
    meta.days=parseNum(document.getElementById("labDays").value);
    meta.people=parseNum(document.getElementById("labPeople").value);
    meta.wage=parseNum(document.getElementById("labWage").value);
    meta.work=document.getElementById("labWork").value;
  }else{
    meta.unit=document.getElementById("expUnit").value || "";
    meta.qty=parseNum(document.getElementById("expQty").value);
    meta.unitPrice=parseNum(document.getElementById("expUnitPrice").value);
  }

  DB.tx.unshift({
    id:uid(), type:"expense",
    season, product,
    category:cat, sub,
    date, amount:total,
    meta, note
  });
  save(DB);
  e.target.reset();
  document.getElementById("expSeason").value=season;
  document.getElementById("expProduct").value=product;
  document.getElementById("expCat").value=cat;
  refreshExpenseSubs();
  document.getElementById("expDate").value=todayISO();
  renderAll();
}

function removeTx(id){
  if(!confirm("Bu kaydı silmek istiyor musun?")) return;
  DB.tx = DB.tx.filter(t=>t.id!==id);
  save(DB);
  renderAll();
}

/* CARİ */
function addCari(e){
  e.preventDefault();
  const season=parseInt(document.getElementById("cSeason").value||0,10);
  const name=document.getElementById("cName").value.trim();
  const type=document.getElementById("cType").value;
  const product=document.getElementById("cProduct").value;
  const sub=document.getElementById("cSub").value;
  const amount=parseNum(document.getElementById("cAmount").value);
  const due=document.getElementById("cDue").value || "";
  const note=document.getElementById("cNote").value.trim();
  if(!season) return alert("Sezon yılı zorunlu.");
  if(amount<=0) return alert("Tutar gir.");
  const id=uid();
  DB.caris.unshift({ id, season, name, type, product, sub, amount, paid:0, due, note, createdAt: todayISO() });

  // Tarımla ilişkili cari kalemleri otomatik tarla giderine yaz (senin istediğin eşleştirme)
  const tarlaMap = ["Gübre","Tohum","İlaç","Mazot","İşçilik"];
  if(tarlaMap.some(x=>sub.toLowerCase().includes(x.toLowerCase()))){
    const mapped = sub==="İşçilik" ? "İşçilik (Gün)" : sub;
    // Burada otomatik gider kaydı "tarla" kategorisinde, alt kalem olarak işlenir
    DB.tx.unshift({
      id:uid(), type:"expense",
      season, product: product || "bugday",
      category:"tarla", sub: mapped==="İşçilik (Gün)"? "İşçilik (Gün)" : mapped,
      date: todayISO(),
      amount: amount,
      meta:{ autoFromCari:true, cariId:id },
      note: `Cari: ${name||"—"} | ${note}`
    });
  }

  save(DB);
  e.target.reset();
  document.getElementById("cSeason").value=season;
  document.getElementById("cProduct").value=product;
  renderAll();
}
function payCari(){
  const cariId=document.getElementById("paySelect").value;
  const amt=parseNum(document.getElementById("payAmount").value);
  const date=document.getElementById("payDate").value || todayISO();
  const note=document.getElementById("payNote").value.trim();
  if(!cariId) return alert("Cari seç.");
  if(amt<=0) return alert("Ödeme tutarı gir.");
  const c=DB.caris.find(x=>x.id===cariId);
  if(!c) return alert("Cari bulunamadı.");
  const remaining = Math.max(0, c.amount - c.paid);
  if(amt>remaining) return alert("Ödeme kalan borçtan büyük olamaz.");
  c.paid += amt;
  DB.pays.unshift({ id:uid(), cariId, season:c.season, date, amount:amt, note });

  // Ödeme tek bakiyeden düşmez; ama finans/nakit çıkışı olarak raporda görünür
  DB.tx.unshift({
    id:uid(), type:"expense",
    season:c.season,
    product: c.product || "bugday",
    category:"finance",
    sub:"Cari Ödeme",
    date,
    amount:amt,
    meta:{ payCari:true, cariId },
    note: `Cari ödeme: ${c.name||"—"} | ${note}`
  });

  save(DB);
  document.getElementById("payAmount").value="";
  document.getElementById("payNote").value="";
  renderAll();
}
function removeCari(id){
  if(!confirm("Bu cari kaydını silmek istiyor musun? (Ödemeler kalabilir)")) return;
  DB.caris = DB.caris.filter(c=>c.id!==id);
  save(DB);
  renderAll();
}

/* Çek/Senet */
function addCek(e){
  e.preventDefault();
  const season=parseInt(document.getElementById("cekSeason").value||0,10);
  const type=document.getElementById("cekType").value;
  const cari=document.getElementById("cekCari").value.trim();
  const amount=parseNum(document.getElementById("cekAmount").value);
  const due=document.getElementById("cekDue").value || "";
  const status=document.getElementById("cekStatus").value;
  const note=document.getElementById("cekNote").value.trim();
  if(!season) return alert("Sezon zorunlu.");
  if(amount<=0) return alert("Tutar gir.");
  DB.cek.unshift({ id:uid(), season, type, cari, amount, due, status, note, createdAt:todayISO() });
  save(DB);
  e.target.reset();
  document.getElementById("cekSeason").value=season;
  renderAll();
}
function removeCek(id){
  if(!confirm("Silinsin mi?")) return;
  DB.cek = DB.cek.filter(x=>x.id!==id);
  save(DB);
  renderAll();
}

/* Bayi */
function addBayi(e){
  e.preventDefault();
  const season=parseInt(document.getElementById("bSeason").value||0,10);
  const type=document.getElementById("bType").value;
  const amount=parseNum(document.getElementById("bAmount").value);
  const date=document.getElementById("bDate").value || todayISO();
  const note=document.getElementById("bNote").value.trim();
  if(!season) return alert("Sezon zorunlu.");
  if(amount<=0) return alert("Tutar gir.");
  DB.bayi.unshift({ id:uid(), season, type, amount, date, note });
  save(DB);
  e.target.reset();
  document.getElementById("bSeason").value=season;
  document.getElementById("bDate").value=todayISO();
  renderAll();
}
function removeBayi(id){
  if(!confirm("Silinsin mi?")) return;
  DB.bayi = DB.bayi.filter(x=>x.id!==id);
  save(DB);
  renderAll();
}

/* REPORT */
function computeTotals(filter){
  let income=0, expense=0, bayiNet=0;
  DB.tx.forEach(t=>{
    if(!filter(t)) return;
    if(t.type==="income") income += t.amount;
    else if(t.type==="expense"){
      // Bayi karışmıyor: kategori "bayi" yok zaten; DB.bayi ayrı
      if(t.category!=="ignore") expense += t.amount;
    }
  });
  DB.bayi.forEach(b=>{
    if(!filter({season:b.season, product:"all"})) return;
    bayiNet += (b.type==="income"? b.amount : -b.amount);
  });
  return { income, expense, net: income-expense, bayiNet };
}

function runReport(){
  const from=parseInt(document.getElementById("rFrom").value||2020,10);
  const to=parseInt(document.getElementById("rTo").value||from,10);
  const prod=document.getElementById("rProduct").value;
  const mode=document.getElementById("rMode").value;
  const cat=document.getElementById("rCat").value;
  const sub=document.getElementById("rSub").value;
  const type=document.getElementById("rType").value;

  const inRange = (s)=> s>=from && s<=to;

  const txFilter = (t)=>{
    if(!inRange(t.season)) return false;
    if(prod!=="all" && t.product!==prod) return false;
    if(type==="income" && t.type!=="income") return false;
    if(type==="expense" && t.type!=="expense") return false;
    if(type==="finance" && !(t.type==="expense" && t.category==="finance")) return false;
    return true;
  };

  const title = `Rapor: ${from}-${to} | Ürün: ${PRODUCTS.find(p=>p.id===prod)?.name||prod} | Mod: ${mode}`;
  document.getElementById("reportTitle").textContent = title;

  const cards=document.getElementById("reportCards");
  cards.innerHTML="";
  const sums=computeTotals(txFilter);
  const addCard=(h,v,s)=>{
    const d=document.createElement("div");
    d.className="card";
    d.innerHTML=`<div class="card-h">${h}</div><div class="card-v">${v}</div><div class="card-s">${s||""}</div>`;
    cards.appendChild(d);
  }
  addCard("Net Bakiye", fmt(sums.net), "Çiftlik (bayi hariç)");
  addCard("Gelir", fmt(sums.income), "");
  addCard("Gider", fmt(sums.expense), "");
  addCard("Bayi (Ayrı)", fmt(sums.bayiNet), "Tek bakiyeye karışmaz");

  const head=document.getElementById("repHead");
  const body=document.getElementById("repBody");
  head.innerHTML=""; body.innerHTML="";

  if(mode==="summary"){
    ["Sezon","Gelir","Gider","Net"].forEach(h=>{
      const th=document.createElement("th"); th.textContent=h; head.appendChild(th);
    });
    for(let y=from;y<=to;y++){
      const f=(t)=>txFilter(t) && t.season===y;
      const s=computeTotals(f);
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${seasonLabel(y)}</td><td class="right">${fmt(s.income)}</td><td class="right">${fmt(s.expense)}</td><td class="right"><b>${fmt(s.net)}</b></td>`;
      body.appendChild(tr);
    }
    return;
  }

  if(mode==="category"){
    ["Kategori","Toplam"].forEach(h=>{
      const th=document.createElement("th"); th.textContent=h; head.appendChild(th);
    });
    const map=new Map();
    DB.tx.filter(txFilter).forEach(t=>{
      if(t.type!=="expense") return;
      const key = CATEGORIES.find(c=>c.id===t.category)?.name || t.category;
      map.set(key, (map.get(key)||0) + t.amount);
    });
    [...map.entries()].sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${k}</td><td class="right"><b>${fmt(v)}</b></td>`;
      body.appendChild(tr);
    });
    return;
  }

  // subcat: years by subcategory within a category
  ["Yıl"].forEach(h=>{ const th=document.createElement("th"); th.textContent=h; head.appendChild(th); });
  const th2=document.createElement("th"); th2.textContent="Toplam"; th2.className="right"; head.appendChild(th2);

  for(let y=from;y<=to;y++){
    const f=(t)=>txFilter(t) && t.season===y;
    let total=0;
    DB.tx.filter(f).forEach(t=>{
      if(cat!=="all" && t.category!==cat) return;
      if(sub && sub!=="all" && t.sub!==sub) return;
      if(t.type!=="expense") return;
      total += t.amount;
    });
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${y}</td><td class="right"><b>${fmt(total)}</b></td>`;
    body.appendChild(tr);
  }
}

/* RENDER */
function renderSummary(){
  const from=parseInt(document.getElementById("qSeasonFrom").value||2020,10);
  const to=parseInt(document.getElementById("qSeasonTo").value||from,10);
  const q=document.getElementById("qSearch").value.trim().toLowerCase();
  const type=document.getElementById("qType").value;

  const filter=(t)=>{
    if(t.season<from || t.season>to) return false;
    if(type==="income" && t.type!=="income") return false;
    if(type==="expense" && t.type!=="expense") return false;
    if(type==="bayi") return false;
    if(q){
      const blob = `${t.note||""} ${t.sub||""} ${t.category||""} ${t.product||""}`.toLowerCase();
      if(!blob.includes(q)) return false;
    }
    return true;
  }
  const sums=computeTotals(filter);
  document.getElementById("sumNet").textContent = fmt(sums.net);
  document.getElementById("sumIncome").textContent = fmt(sums.income);
  document.getElementById("sumExpense").textContent = fmt(sums.expense);
  document.getElementById("sumBayi").textContent = fmt(sums.bayiNet);
}

function renderTxTable(){
  const tbody=document.querySelector("#tblTx tbody");
  tbody.innerHTML="";
  const from=parseInt(document.getElementById("qSeasonFrom").value||2020,10);
  const to=parseInt(document.getElementById("qSeasonTo").value||from,10);
  const q=document.getElementById("qSearch").value.trim().toLowerCase();
  const type=document.getElementById("qType").value;

  DB.tx.filter(t=>{
    if(t.season<from || t.season>to) return false;
    if(type==="income" && t.type!=="income") return false;
    if(type==="expense" && t.type!=="expense") return false;
    if(type==="bayi") return false;
    if(q){
      const blob = `${t.note||""} ${t.sub||""} ${t.category||""} ${t.product||""}`.toLowerCase();
      if(!blob.includes(q)) return false;
    }
    return true;
  }).slice(0,250).forEach(t=>{
    const tr=document.createElement("tr");
    const catName = t.type==="income" ? "Gelir" : (CATEGORIES.find(c=>c.id===t.category)?.name || t.category);
    tr.innerHTML = `
      <td>${t.date}</td>
      <td>${seasonLabel(t.season)}</td>
      <td>${PRODUCTS.find(p=>p.id===t.product)?.name||t.product}</td>
      <td>${t.type==="income" ? "Gelir" : "Gider"}</td>
      <td>${catName}</td>
      <td>${t.sub||""}</td>
      <td class="right"><b>${fmt(t.amount)}</b></td>
      <td class="right"><button class="btn danger" data-del="${t.id}">Sil</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=>removeTx(btn.getAttribute("data-del")));
  });
}

function renderCari(){
  // datalist suggestions
  const names=[...new Set(DB.caris.map(c=>c.name).filter(Boolean))].sort();
  const dl=document.getElementById("cariList");
  const dl2=document.getElementById("cariList2");
  dl.innerHTML=""; dl2.innerHTML="";
  names.forEach(n=>{
    const o=document.createElement("option"); o.value=n; dl.appendChild(o);
    const o2=document.createElement("option"); o2.value=n; dl2.appendChild(o2);
  });

  const tbody=document.querySelector("#tblCari tbody");
  tbody.innerHTML="";
  const search=document.getElementById("cSearch").value.trim().toLowerCase();
  const rows=DB.caris.filter(c=>{
    if(search){
      const blob=`${c.name||""} ${c.sub||""} ${c.note||""}`.toLowerCase();
      if(!blob.includes(search)) return false;
    }
    return (c.amount - c.paid) > 0.0001;
  });
  rows.forEach(c=>{
    const remaining=Math.max(0, c.amount - c.paid);
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${seasonLabel(c.season)}</td>
      <td>${c.name||"—"}</td>
      <td>${c.type==="borc"?"Borç":"Alacak"}</td>
      <td>${c.sub}</td>
      <td class="right">${fmt(c.amount)}</td>
      <td class="right">${fmt(c.paid)}</td>
      <td class="right"><b>${fmt(remaining)}</b></td>
      <td>${c.due||""}</td>
      <td class="right"><button class="btn danger" data-cdel="${c.id}">Sil</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("[data-cdel]").forEach(b=>{
    b.addEventListener("click",()=>removeCari(b.getAttribute("data-cdel")));
  });

  // pay select
  const sel=document.getElementById("paySelect");
  sel.innerHTML="";
  rows.forEach(c=>{
    const remaining=Math.max(0, c.amount-c.paid);
    const opt=document.createElement("option");
    opt.value=c.id;
    opt.textContent=`${c.name||"—"} | ${c.sub} | Kalan: ${fmt(remaining)}`;
    sel.appendChild(opt);
  });
}

function renderCek(){
  const tbody=document.querySelector("#tblCek tbody");
  tbody.innerHTML="";
  DB.cek.forEach(x=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${seasonLabel(x.season)}</td>
      <td>${x.type}</td>
      <td>${x.cari||"—"}</td>
      <td class="right"><b>${fmt(x.amount)}</b></td>
      <td>${x.due||""}</td>
      <td>${x.status}</td>
      <td class="right"><button class="btn danger" data-xdel="${x.id}">Sil</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("[data-xdel]").forEach(b=>{
    b.addEventListener("click",()=>removeCek(b.getAttribute("data-xdel")));
  });
}

function renderBayi(){
  const tbody=document.querySelector("#tblBayi tbody");
  tbody.innerHTML="";
  DB.bayi.forEach(b=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${b.date}</td>
      <td>${seasonLabel(b.season)}</td>
      <td>${b.type==="income"?"Gelir":"Gider"}</td>
      <td class="right"><b>${fmt(b.amount)}</b></td>
      <td class="right"><button class="btn danger" data-bdel="${b.id}">Sil</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("[data-bdel]").forEach(b=>{
    b.addEventListener("click",()=>removeBayi(b.getAttribute("data-bdel")));
  });
}

function renderAll(){
  renderSummary();
  renderTxTable();
  renderCari();
  renderCek();
  renderBayi();
}

/* NAV */
function go(view){
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
  document.getElementById(`view-${view}`).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("active"));
  document.querySelector(`.nav-item[data-go="${view}"]`).classList.add("active");
  if(view==="rapor") runReport();
}

/* Export / Import / Reset */
function exportData(){
  const blob=new Blob([JSON.stringify(DB,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`muhasebe_v13_backup_${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function importData(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const obj=JSON.parse(reader.result);
      if(!obj) throw new Error("Boş dosya");
      DB = Object.assign({ tx:[], caris:[], pays:[], cek:[], bayi:[] }, obj);
      save(DB);
      renderAll();
      alert("İçe aktarma tamam.");
    }catch(e){
      alert("İçe aktarma hatası: "+e.message);
    }
  };
  reader.readAsText(file);
}
function resetAll(){
  if(!confirm("Tüm veriler silinecek. Emin misin?")) return;
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LS_VER);
  DB = { tx:[], caris:[], pays:[], cek:[], bayi:[] };
  save(DB);
  renderAll();
  alert("Sıfırlandı.");
}

/* INIT */
function init(){
  // defaults
  document.getElementById("incDate").value=todayISO();
  document.getElementById("expDate").value=todayISO();
  document.getElementById("payDate").value=todayISO();
  document.getElementById("bDate").value=todayISO();

  // product selects
  fillProducts(document.getElementById("incProduct"));
  fillProducts(document.getElementById("expProduct"));
  fillProducts(document.getElementById("cProduct"));
  fillProductsWithAll(document.getElementById("rProduct"));
  fillProducts(document.getElementById("expProduct"));

  // income subs
  refreshIncomeSubs();
  document.getElementById("incProduct").addEventListener("change", refreshIncomeSubs);

  // expense cat/sub
  setSelectOptions(document.getElementById("expCat"), CATEGORIES.filter(c=>c.id!=="finance").map(c=>({value:c.id,label:c.name})));
  document.getElementById("expCat").addEventListener("change", refreshExpenseSubs);
  document.getElementById("expSub").addEventListener("change", onExpenseSubChanged);
  refreshExpenseSubs();

  // labor works
  setSelectOptions(document.getElementById("labWork"), LABOR_WORKS.map(x=>({value:x,label:x})));

  // cari sub
  setSelectOptions(document.getElementById("cSub"), ["Gübre","Tohum","İlaç","Mazot","İşçilik","Makine/Parça","Diğer","Borç verdim","Borç aldım"].map(x=>({value:x,label:x})));

  // report cat/sub
  setSelectOptions(document.getElementById("rCat"), [{value:"all",label:"Hepsi"}].concat(CATEGORIES.map(c=>({value:c.id,label:c.name}))));
  document.getElementById("rCat").addEventListener("change", ()=>{
    const v=document.getElementById("rCat").value;
    const subs = v==="all" ? [{value:"all",label:"Hepsi"}] : [{value:"all",label:"Hepsi"}].concat((SUBCATS[v]||[]).map(x=>({value:x,label:x})));
    setSelectOptions(document.getElementById("rSub"), subs);
  });
  document.getElementById("rCat").dispatchEvent(new Event("change"));

  // calc bindings
  ["incQty","incUnit"].forEach(id=>document.getElementById(id).addEventListener("input", recalcIncome));
  ["expQty","expUnitPrice","labDays","labPeople","labWage"].forEach(id=>document.getElementById(id).addEventListener("input", recalcExpense));
  document.getElementById("expSub").addEventListener("change", recalcExpense);

  // forms
  document.getElementById("formIncome").addEventListener("submit", addIncome);
  document.getElementById("formExpense").addEventListener("submit", addExpense);
  document.getElementById("formCari").addEventListener("submit", addCari);
  document.getElementById("formCek").addEventListener("submit", addCek);
  document.getElementById("formBayi").addEventListener("submit", addBayi);

  // buttons
  document.getElementById("btnApply").addEventListener("click", renderAll);
  document.getElementById("btnCariRefresh").addEventListener("click", renderCari);
  document.getElementById("btnPay").addEventListener("click", payCari);
  document.getElementById("btnRunReport").addEventListener("click", runReport);

  document.getElementById("btnExport").addEventListener("click", exportData);
  document.getElementById("btnImport").addEventListener("click", ()=>document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", (e)=>{
    if(e.target.files && e.target.files[0]) importData(e.target.files[0]);
    e.target.value="";
  });
  document.getElementById("btnReset").addEventListener("click", resetAll);

  // nav
  document.querySelectorAll(".nav-item").forEach(b=>{
    b.addEventListener("click", ()=>go(b.dataset.go));
  });

  renderAll();
  go("kayit");

  // Service worker
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
}

window.addEventListener("DOMContentLoaded", init);
