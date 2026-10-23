#!/usr/bin/env node
/**
 * E-VIAS demo — deterministic seed-data generator.
 * Usage:  node 03-generate-data.mjs            → writes ./public/data/*.json
 *         node 03-generate-data.mjs --out dir   → custom output dir
 *
 * Everything is synthetic. Same seed → same files every run.
 * All "planted stories" (see 05-SCENARIOS.md) are injected explicitly below,
 * search for  // STORY  comments.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "./public/data";
mkdirSync(OUT, { recursive: true });

// ---------- config ----------
export const DEMO_DATE = "2026-11-01";        // "today" inside the demo
const DAYS = 90;                              // history length
const d0 = new Date(DEMO_DATE + "T00:00:00Z");
const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const iso = (d) => d.toISOString().slice(0, 10);
const dayOf = (n) => iso(addDays(d0, n));     // n negative = past
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const dow = (s) => DOW[new Date(s + "T00:00:00Z").getUTCDay()];

// seeded RNG (mulberry32)
let seed = 20261101;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const kd = (n) => Math.round(n * 1000) / 1000;
const pad = (n, w = 3) => String(n).padStart(w, "0");

// ---------- coops & branches ----------
const coops = [
  { id: "C1", code: "COOP-A", name_ar: "جمعية الواحة التعاونية", name_en: "Al-Waha Co-op", members: 9850, est: 1979 },
  { id: "C2", code: "COOP-B", name_ar: "جمعية البستان التعاونية", name_en: "Al-Bustan Co-op", members: 7420, est: 1984 },
  { id: "C3", code: "COOP-C", name_ar: "جمعية الضاحية التعاونية", name_en: "Al-Dhahia Co-op", members: 6130, est: 1991 },
];
const branches = [];
for (const c of coops) {
  const names = [["السوق المركزي","Central Market"],["الفرع 1","Branch 1"],["الفرع 2","Branch 2"]];
  names.forEach((n, i) => branches.push({ id: `${c.id}-B${i+1}`, coop_id: c.id, code: `B${i+1}`, name_ar: n[0], name_en: n[1], lanes: i === 0 ? 8 : 4, area_m2: i === 0 ? 1800 : 600 }));
}
const B1 = "C1-B1"; // the mapped branch

// ---------- products (no produce) ----------
const CATS = {
  dairy:   ["ألبان وبيض","Dairy & eggs","CH"],
  bev:     ["مشروبات ومياه","Beverages & water","A01"],
  snacks:  ["وجبات خفيفة وحلويات","Snacks & confectionery","A02"],
  dry:     ["أرز ومعكرونة وزيوت ومعلبات","Rice, pasta, oils, canned","A03"],
  home:    ["منظفات وأدوات منزلية","Household & cleaning","A04"],
  care:    ["عناية شخصية وأطفال","Personal care & baby","A05"],
  teadate: ["شاي وقهوة وتمور","Tea, coffee & dates","A06"],
  frozen:  ["مجمدات","Frozen","FR"],
  bakery:  ["مخبوزات","Bakery","BAK"],
};
const P = [
  // [cat, ar, en, cost, price, shelfLifeDays, subsidized, supplierIdx, dailyBase]
  ["dairy","حليب قليل الدسم 1ل","Low-fat milk 1L",0.420,0.650,12,false,0,28],
  ["dairy","حليب كامل الدسم 1ل","Full-fat milk 1L",0.430,0.650,12,false,0,24],
  ["dairy","زبادي طبيعي 170غ","Natural yogurt 170g",0.350,0.500,14,false,0,40],
  ["dairy","لبن رائب 1ل","Laban 1L",0.390,0.600,10,false,0,22],
  ["dairy","جبن أبيض 500غ","White cheese 500g",1.100,1.650,30,false,0,8],
  ["dairy","بيض 30 حبة","Eggs tray 30",1.250,1.600,21,true,1,14],
  ["dairy","زبدة 200غ","Butter 200g",0.650,0.950,60,false,0,6],
  ["dairy","عصير برتقال 1ل","Orange juice 1L",0.750,1.100,21,false,2,16],
  ["dairy","عصير مانجو 1ل","Mango juice 1L",0.700,1.000,21,false,2,12],
  ["bev","مياه 1.5ل ×6","Water 1.5L ×6",0.550,0.850,365,false,3,30],
  ["bev","مياه 330مل ×12","Water 330ml ×12",0.600,0.950,365,false,3,18],
  ["bev","مشروب غازي 330مل ×6","Soda 330ml ×6",0.900,1.350,180,false,3,20],
  ["bev","مشروب طاقة 250مل","Energy drink 250ml",0.350,0.550,240,false,3,15],
  ["bev","شراب شعير 330مل ×6","Malt drink 330ml ×6",1.000,1.500,180,false,3,9],
  ["snacks","شيبس 150غ","Chips 150g",0.300,0.450,120,false,4,26],
  ["snacks","بسكويت شاي 400غ","Tea biscuits 400g",0.420,0.600,180,false,4,18],
  ["snacks","شوكولاتة 100غ","Chocolate bar 100g",0.380,0.550,240,false,4,22],
  ["snacks","مكسرات مشكلة 250غ","Mixed nuts 250g",1.350,1.950,180,false,4,7],
  ["snacks","حلوى أطفال 50غ","Kids candy 50g",0.120,0.200,240,false,4,30],
  ["snacks","كيك محشو ×12","Filled cakes ×12",0.800,1.150,90,false,4,10],
  ["dry","أرز بسمتي 5كغ","Basmati rice 5kg",2.500,3.250,540,true,5,9],
  ["dry","أرز بسمتي 10كغ","Basmati rice 10kg",4.700,5.900,540,true,5,6],
  ["dry","سكر 2كغ","Sugar 2kg",0.520,0.700,540,true,5,12],
  ["dry","طحين 2كغ","Flour 2kg",0.380,0.500,270,true,5,10],
  ["dry","زيت ذرة 1.8ل","Corn oil 1.8L",1.150,1.550,365,true,5,8],
  ["dry","معكرونة 500غ","Pasta 500g",0.220,0.350,540,false,5,16],
  ["dry","عدس أحمر 1كغ","Red lentils 1kg",0.550,0.800,365,true,5,7],
  ["dry","تونة 185غ ×4","Tuna 185g ×4",1.400,1.950,720,false,6,11],
  ["dry","فول مدمس 400غ","Fava beans 400g",0.180,0.280,720,false,6,14],
  ["dry","معجون طماطم 400غ","Tomato paste 400g",0.250,0.380,540,false,6,13],
  ["dry","حليب مجفف 900غ","Powdered milk 900g",2.100,2.750,365,true,1,5],
  ["home","منظف أرضيات 3ل","Floor cleaner 3L",0.850,1.250,720,false,7,8],
  ["home","مسحوق غسيل 5كغ","Laundry powder 5kg",2.300,3.200,720,false,7,6],
  ["home","سائل جلي 1ل","Dish soap 1L",0.450,0.700,720,false,7,12],
  ["home","مناديل ورقية ×10","Tissues ×10",1.050,1.500,999,false,7,10],
  ["home","أكياس قمامة ×30","Trash bags ×30",0.400,0.650,999,false,7,9],
  ["home","ورق قصدير 30م","Foil 30m",0.700,1.000,999,false,7,5],
  ["care","شامبو 400مل","Shampoo 400ml",0.900,1.350,720,false,8,9],
  ["care","معجون أسنان 100مل","Toothpaste 100ml",0.450,0.700,720,false,8,11],
  ["care","صابون ×4","Soap ×4",0.600,0.900,720,false,8,8],
  ["care","حفاضات أطفال ×40","Diapers ×40",3.200,4.400,720,false,8,7],
  ["care","حليب أطفال 400غ","Infant formula 400g",2.300,3.100,365,true,1,4],
  ["care","مناديل مبللة ×72","Wet wipes ×72",0.550,0.850,540,false,8,9],
  ["teadate","شاي أسود 400غ","Black tea 400g",1.100,1.550,540,false,9,10],
  ["teadate","قهوة عربية 500غ","Arabic coffee 500g",1.900,2.600,365,false,9,7],
  ["teadate","تمر خلاص 1كغ","Khalas dates 1kg",1.600,2.250,365,false,10,9],
  ["teadate","تمر سكري 1كغ","Sukkari dates 1kg",1.900,2.650,365,false,10,8],
  ["teadate","هيل مطحون 100غ","Ground cardamom 100g",1.500,2.100,540,false,9,5],
  ["teadate","زعفران 2غ","Saffron 2g",2.200,3.000,720,false,9,3],
  ["frozen","دجاج كامل 1.2كغ","Whole chicken 1.2kg",1.350,1.850,270,true,11,14],
  ["frozen","صدور دجاج 1كغ","Chicken breast 1kg",1.900,2.500,270,false,11,10],
  ["frozen","خضار مشكلة 1كغ","Mixed frozen veg 1kg",0.750,1.100,365,false,11,8],
  ["frozen","آيس كريم 1ل","Ice cream 1L",0.950,1.400,365,false,11,9],
  ["frozen","سمك مجمد 1كغ","Frozen fish 1kg",2.100,2.800,270,false,11,6],
  ["bakery","خبز عربي ×10","Arabic bread ×10",0.090,0.150,2,true,12,60],
  ["bakery","خبز توست","Toast loaf",0.300,0.450,5,false,12,18],
  ["bakery","كرواسون ×4","Croissants ×4",0.550,0.850,3,false,12,12],
  ["bakery","كعك بالسمسم ×6","Sesame kaak ×6",0.400,0.650,4,false,12,10],
];
const suppliers = [
  ["SUP-01","شركة الألبان الوطنية","National Dairy Co.",0.92,1,1],
  ["SUP-02","مؤسسة التموين الغذائي","Food Supply Est.",0.88,0,0],
  ["SUP-03","شركة العصائر الخليجية","Gulf Juices Co.",0.9,1,0],
  ["SUP-04","شركة الوجبات الخليجية","Gulf Snacks Co.",0.85,2,1],   // STORY #8 holds A02-END-C2
  ["SUP-05","مصنع الحلويات المتحدة","United Confectionery",0.87,1,0],
  ["SUP-06","شركة الحبوب والأرز","Grains & Rice Co.",0.95,0,0],
  ["SUP-07","شركة الأغذية المعلبة","Canned Foods Co.",0.83,2,1],
  ["SUP-08","شركة المنظفات الحديثة","Modern Cleaning Co.",0.9,1,0],
  ["SUP-09","شركة العناية الشخصية","Personal Care Co.",0.93,0,0],
  ["SUP-10","بيت الشاي والقهوة","Tea & Coffee House",0.86,1,0],
  ["SUP-11","مزارع التمور الذهبية","Golden Dates Farms",0.91,0,0],
  ["SUP-12","شركة اللحوم المجمدة","Frozen Meats Co.",0.33,4,3],      // STORY #13: late 4/6, short twice
  ["SUP-13","مخبز الجمعية","Co-op Bakery",0.98,0,0],
  ["SUP-14","شركة المياه الصحية","Healthy Water Co.",0.9,1,0],
  ["SUP-15","شركة الأغذية الممتازة","Premium Foods Co.",0.8,2,1],
].map(([id, ar, en, onTime, short, nearExp]) => ({ id, name_ar: ar, name_en: en, on_time_rate: onTime, short_deliveries: short, near_expiry_deliveries: nearExp, deliveries: 6, bank_iban_last4: pad(ri(1000, 9999), 4), rating: Math.round(onTime * 100) }));

const products = P.map((p, i) => {
  const [cat, ar, en, cost, price, life, sub, sup, base] = p;
  return { id: `P${pad(i + 1)}`, sku: `7${pad(100000 + i * 37, 6)}`, category: cat, category_ar: CATS[cat][0], category_en: CATS[cat][1], aisle: CATS[cat][2], name_ar: ar, name_en: en, cost: kd(cost), price: kd(price), shelf_life_days: life, subsidized: sub, supplier_id: suppliers[sup === 12 ? 12 : sup].id, daily_base: base, cost_history: [] };
});
// STORY #4 margin leak: 14 products got a cost increase 14 days ago, price unchanged → now sold at a loss
const LEAK = ["P005","P007","P017","P018","P020","P028","P033","P037","P041","P043","P045","P048","P051","P054"];
for (const id of LEAK) { const p = products.find(x => x.id === id); p.cost_history.push({ date: dayOf(-60), cost: p.cost }); const newCost = kd(p.price * (1.03 + rnd() * 0.06)); p.cost_history.push({ date: dayOf(-14), cost: newCost }); p.cost = newCost; p.margin_leak = true; }
// subsidized reference prices (ministry cap)
const subsidized_prices = products.filter(p => p.subsidized).map(p => ({ product_id: p.id, cap_price: p.price, effective_from: dayOf(-120) }));

// ---------- floorplan (branch C1-B1) ----------
const fx = [];
const add = (id, floor, type, x, y, w, h, ar, en, extra = {}) => fx.push({ id, floor, type, x, y, w, h, name_ar: ar, name_en: en, traffic_base: 40, ...extra });
add("ENT-MAIN","G","entrance",26,29,8,1,"المدخل الرئيسي","Main entrance",{traffic_base:95});
add("VEST","G","zone",24,26,12,3,"البهو والعربات","Vestibule & trolleys",{traffic_base:90});
add("ENT-PARK","G","entrance",59,22,1,5,"مدخل المواقف","Parking entrance",{traffic_base:60});
add("ENT-STAFF","G","entrance",0,12,1,2,"مدخل الموظفين (بصمة)","Staff entrance (biometric)",{traffic_base:5,device:"BIO-G1"});
for (let i = 0; i < 8; i++) add(`POS-0${i+1}`,"G","checkout",4+2.5*i,24,2,3,`كاشير ${i+1}`,`Checkout ${i+1}`,{traffic_base:i<6?85:30,open_by_default:i<6});
add("SCO","G","checkout",42,25,4,3,"الدفع الذاتي","Self-checkout",{traffic_base:70});
add("CS","G","service",36,25,6,3,"خدمة العملاء والمرتجعات","Customer service & returns",{traffic_base:45});
add("ESC-UP","G","escalator",28,11,1.5,8,"سلم كهربائي صاعد","Escalator up",{traffic_base:75});
add("ESC-DN","G","escalator",30.5,11,1.5,8,"سلم كهربائي نازل","Escalator down",{traffic_base:70});
add("WH-01","G","warehouse",0,0,12,10,"المخزن والاستلام","Warehouse & receiving",{traffic_base:0});
add("WH-COLD","G","warehouse",12,0,4,5,"المخزن البارد","Cold store",{traffic_base:0});
add("OFF","G","office",0,10,6,6,"المكاتب","Offices",{traffic_base:0});
for (let i = 0; i < 7; i++) add(`CH-0${i+1}`,"G","chiller",16+4*i,0,4,2,`ثلاجة ${i+1}`,`Chiller ${i+1}`,{traffic_base:(i===2||i===3)?88:65,category:"dairy",levels:5});
for (let i = 0; i < 3; i++) add(`FR-0${i+1}`,"G","freezer",44+4.6*i,0,4.6,2,`فريزر ${i+1}`,`Freezer ${i+1}`,{traffic_base:55,category:"frozen",levels:3});
add("DELI","G","counter",44,3,8,5,"ركن الأجبان","Deli & cheese",{traffic_base:50});
add("BAK","G","counter",52,3,8,6,"المخبز","Bakery",{traffic_base:80,category:"bakery"});
const ROWS = [["A01","bev",4.0],["A02","snacks",7.4],["A03","dry",10.8],["A04","home",14.2],["A05","care",17.6],["A06","teadate",21.0]];
for (const [row, cat, y] of ROWS) {
  const base = row === "A06" ? 70 : row === "A04" || row === "A05" ? 35 : 50;
  add(`${row}-L1`,"G","gondola",6,y,10,1.2,`${row} يسار 1 · ${CATS[cat][0]}`,`${row} left 1 · ${CATS[cat][1]}`,{traffic_base:base-5,category:cat,levels:5,row});
  add(`${row}-L2`,"G","gondola",16,y,10,1.2,`${row} يسار 2 · ${CATS[cat][0]}`,`${row} left 2 · ${CATS[cat][1]}`,{traffic_base:base,category:cat,levels:5,row});
  add(`${row}-R1`,"G","gondola",34,y,11,1.2,`${row} يمين 1 · ${CATS[cat][0]}`,`${row} right 1 · ${CATS[cat][1]}`,{traffic_base:base,category:cat,levels:5,row});
  add(`${row}-R2`,"G","gondola",45,y,11,1.2,`${row} يمين 2 · ${CATS[cat][0]}`,`${row} right 2 · ${CATS[cat][1]}`,{traffic_base:base-10,category:cat,levels:5,row});
  add(`${row}-END-W`,"G","endcap",5,y,1,1.2,`${row} رأس غربي`,`${row} west end-cap`,{traffic_base:base-10,category:cat,levels:4,row,prime:false});
  add(`${row}-END-C1`,"G","endcap",26,y,1,1.2,`${row} رأس الممر الأوسط (يسار)`,`${row} centre end-cap (left)`,{traffic_base:base+25,category:cat,levels:4,row,prime:true});
  add(`${row}-END-C2`,"G","endcap",33,y,1,1.2,`${row} رأس الممر الأوسط (يمين)`,`${row} centre end-cap (right)`,{traffic_base:base+28,category:cat,levels:4,row,prime:true});
  add(`${row}-END-E`,"G","endcap",56,y,1,1.2,`${row} رأس شرقي`,`${row} east end-cap`,{traffic_base:base-8,category:cat,levels:4,row,prime:false});
}
// mezzanine
const MZ = [
  ["M-01",0,0,10,7,"مكتبة مدرسية","School Stationery & Books","shop","leased",60],
  ["M-02",10,0,8,7,"محل ألعاب","Toy Store","shop","leased",55],
  ["M-03",18,0,10,7,"محل كشتات","Camping & Outdoor","shop","expiring",45],
  ["M-04",28,0,8,7,"محل موبايلات","Mobiles & Accessories","shop","leased",65],
  ["M-05",36,0,9,7,"ملابس رياضية","Sportswear","shop","leased",50],
  ["M-06",45,0,7,7,"عطار","Attar & Herbs","shop","leased",40],
  ["M-07",52,0,8,7,"صرافة","Currency Exchange","shop","arrears",55],
  ["M-08",0,23,7,7,"حلاق أطفال","Kids Barber","shop","leased",35],
  ["M-09",7,23,12,7,"مقهى","Café","shop","leased",80],
  ["M-10",19,23,6,7,"خياط","Tailor","shop","leased",25],
  ["L-01",25,23,10,7,"بهو الفعاليات","Event Lobby","lobby","available",70],
  ["M-11",35,23,10,7,"أدوات منزلية","Housewares","shop","leased",45],
  ["M-12",45,23,8,7,"صيدلية","Pharmacy","shop","leased",60],
  ["M-13",53,23,7,7,"مغسلة","Laundry","shop","reserved",30],
  ["M-14",0,7,7,8,"نظارات","Optics","shop","leased",30],
  ["SVC",0,15,7,8,"دورات مياه ومصلى","WC & prayer room","service",null,20],
  ["K-01",53,7,7,5,"كشك عطور","Perfume Kiosk","kiosk","leased",40],
  ["K-02",53,12,7,5,"كشك اتصالات","Telecom Kiosk","kiosk","leased",35],
  ["M-16",53,17,7,6,"محل شاغر","Vacant shop","shop","available",15],
  ["K-03",21,9,2,3,"عربة قهوة","Coffee Cart","kiosk","leased",65],
  ["K-04",37,18,2,3,"عربة عصائر","Juice Cart","kiosk","available",30],
  ["ESC-M",28,11,4,8,"منصة السلم","Escalator landing","escalator",null,85],
];
for (const [id,x,y,w,h,ar,en,type,status,tb] of MZ) add(id,"M",type,x,y,w,h,ar,en,{traffic_base:tb,area_m2:w*h,status});
const ADS = [
  ["AD-01","M","شاشة رقمية أعلى السلم","Digital screen, escalator top",350,"leased",32,9,2,0.5],
  ["AD-02","G","لوحة الواجهة","Entrance banner",500,"leased",22,29.2,16,0.6],
  ["AD-03","G","إعلان العربات (200)","Trolley ads (200)",400,"available",47,26,5,3],
  ["AD-04a","G","تغليف عمود","Pillar wrap",120,"leased",26,4,0.6,0.6],
  ["AD-04b","G","تغليف عمود","Pillar wrap",120,"leased",34,4,0.6,0.6],
  ["AD-04c","G","تغليف عمود","Pillar wrap",120,"available",26,22,0.6,0.6],
  ["AD-04d","G","تغليف عمود","Pillar wrap",120,"available",34,22,0.6,0.6],
  ["AD-05","G","شاشات الكاشير ×8","Checkout screens ×8",300,"leased",4,23.5,20,0.4],
];
for (const [id,floor,ar,en,rent,status,x,y,w,h] of ADS) add(id,floor,"ad",x,y,w,h,ar,en,{traffic_base:0,status,monthly_rent:rent});

// ---------- traffic matrix ----------
const DAYF = { Sat:1.0, Sun:0.85, Mon:0.8, Tue:0.8, Wed:0.9, Thu:1.35, Fri:1.25 };
const HOURF = { 8:0.3,9:0.45,10:0.6,11:0.75,12:0.8,13:0.7,14:0.5,15:0.5,16:0.65,17:0.85,18:1.0,19:1.2,20:1.25,21:1.1,22:0.8,23:0.5 };
const traffic = [];
for (const f of fx) if (f.traffic_base > 0) for (const d of Object.keys(DAYF)) for (const h of Object.keys(HOURF)) traffic.push({ fixture_id: f.id, day: d, hour: +h, score: Math.round(f.traffic_base * DAYF[d] * HOURF[h] * (0.92 + rnd() * 0.16)) });

// ---------- spaces, tenants, contracts, rent invoices ----------
const TENANTS = { "M-01":["مكتبة النور","Al-Noor Stationery","Ahmad","9655%d"],"M-02":["عالم الألعاب","Toy World"],"M-03":["كشتة وبر","Kashta Wabar"],"M-04":["موبايل زون","Mobile Zone"],"M-05":["سبورت لاين","Sport Line"],"M-06":["عطارة الحكيم","Al-Hakeem Attar"],"M-07":["صرافة الخليج","Gulf Exchange"],"M-08":["كيدز كت","Kids Cut"],"M-09":["كافيه الديوانية","Diwaniya Café"],"M-10":["خياط الأناقة","Elegance Tailor"],"M-11":["بيت الأدوات","Home Tools"],"M-12":["صيدلية الشفاء","Al-Shifa Pharmacy"],"M-13":["مغسلة النظافة","Clean Laundry"],"M-14":["بصر للنظارات","Basar Optics"],"K-01":["عطور الياسمين","Yasmin Perfumes"],"K-02":["كشك زين","Zain Kiosk"],"K-03":["كوفي كارت","Coffee Cart Co."],"AD-01":["وكالة الإعلان الأولى","First Ad Agency"],"AD-02":["بنك الديمو","Demo Bank"],"AD-04a":["شركة الاتصالات","Telecom Co."],"AD-04b":["شركة الاتصالات","Telecom Co."],"AD-05":["شركة الألبان الوطنية","National Dairy Co."] };
const RENT_M2 = { shop: 9.5, kiosk: 14, lobby: 0, service: 0 };
const spaces = [], tenants = [], lease_contracts = [], lease_invoices = [];
let tid = 1, lcid = 1, liid = 1;
for (const f of fx.filter(f => f.floor === "M" || f.type === "ad")) {
  if (f.type === "escalator" || f.type === "service") continue;
  const type = f.type === "ad" ? "ad" : f.type;
  const rent = f.monthly_rent ?? (f.type === "lobby" ? 0 : kd(Math.round(f.area_m2 * RENT_M2[type] / 5) * 5));
  const sp = { id: f.id, branch_id: B1, type, floor: f.floor, area_m2: f.area_m2 ?? null, name_ar: f.name_ar, name_en: f.name_en, monthly_rent: rent, day_rate: f.type === "lobby" ? 150 : null, status: f.status, vacant_days: f.status === "available" ? (f.id === "M-16" ? 140 : f.id === "K-04" ? 35 : f.id === "AD-03" ? 60 : 20) : 0 };
  spaces.push(sp);
  if (["leased","expiring","arrears","reserved"].includes(f.status) && TENANTS[f.id]) {
    const [ar, en] = TENANTS[f.id];
    const t = { id: `T-${pad(tid++)}`, name_ar: ar, name_en: en, phone: `+965 9${ri(1000000, 9999999)}`, civil_or_cr: `CR-${ri(100000, 999999)}` };
    tenants.push(t);
    const ends = f.status === "expiring" ? 75 : f.status === "arrears" ? 200 : ri(120, 700);
    const start = addDays(d0, -ri(200, 900));
    const c = { id: `LC-${pad(lcid++)}`, space_id: f.id, tenant_id: t.id, starts_on: iso(start), ends_on: dayOf(ends), monthly_rent: rent, deposit: kd(rent * 2), status: f.status === "reserved" ? "draft" : "active", approved_by: "chair", days_to_expiry: ends };
    lease_contracts.push(c);
    if (c.status === "active") for (let m = 6; m >= 0; m--) {
      const due = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() - m, 17));
      if (due > d0) continue;
      // STORY #9: M-07 exchange shop — last 2 invoices unpaid, oldest 45 days late
      const unpaid = f.id === "M-07" && m <= 2;
      const dueIso = iso(due);
      lease_invoices.push({ id: `LI-${pad(liid++, 4)}`, contract_id: c.id, space_id: f.id, tenant_id: t.id, due_on: dueIso, amount: rent, paid_on: unpaid ? null : iso(addDays(due, ri(0, 6))), status: unpaid ? "overdue" : "paid", days_late: unpaid ? Math.round((d0 - due) / 864e5) : 0 });
    }
  }
}

// ---------- shelf reservations (supplier-rented fixtures) ----------
const shelf_reservations = [];
const SHELF_PRICE = (f, level) => kd((f.prime ? 150 : f.type === "chiller" ? 120 : 60) * (level === 3 ? 1.3 : 1) );
let srid = 1;
const shelfTargets = [["A02-END-C2",null,"SUP-04",45],["A01-END-C1",null,"SUP-14",160],["A03-END-C1",null,"SUP-06",220],["A06-END-C2",null,"SUP-10",300],["A05-END-C1",null,"SUP-09",120],["CH-03",3,"SUP-01",400],["CH-04",3,"SUP-01",400],["A02-L2",3,"SUP-05",200],["A01-R1",3,"SUP-03",180],["A04-END-C2",null,"SUP-08",90],["A06-L2",3,"SUP-11",250]];
for (const [fid, level, sup, ends] of shelfTargets) {
  const f = fx.find(x => x.id === fid);
  const rent = fid === "A02-END-C2" ? 180 : SHELF_PRICE(f, level ?? 0);
  shelf_reservations.push({ id: `SR-${pad(srid++)}`, fixture_id: fid, level, supplier_id: sup, branch_id: B1, monthly_rent: rent, starts_on: dayOf(-ri(100, 400)), ends_on: dayOf(ends), days_to_expiry: ends, status: ends <= 60 ? "expiring" : "active" });
}

// ---------- lots & stock locations ----------
const lots = [], stock_locations = [];
let lotn = 1;
for (const b of branches) for (const p of products) {
  const n = p.shelf_life_days <= 14 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const exp = p.shelf_life_days <= 14 ? ri(2, 12) : p.shelf_life_days <= 60 ? ri(10, 55) : ri(60, 400);
    const qty = ri(20, 160);
    lots.push({ id: `LOT-${pad(lotn++, 4)}`, product_id: p.id, branch_id: b.id, qty, expiry: dayOf(exp), received_on: dayOf(-ri(1, 20)), supplier_id: p.supplier_id, cost: p.cost });
  }
}
// STORY #3 bad batch & STORY #5 expiry rescue (branch B1)
lots.push({ id: "LOT-4471", product_id: "P003", branch_id: B1, qty: 96, expiry: dayOf(6), received_on: dayOf(-5), supplier_id: "SUP-01", cost: 0.350, flagged: "complaints" });
lots.push({ id: "LOT-4388", product_id: "P008", branch_id: B1, qty: 120, expiry: dayOf(10), received_on: dayOf(-8), supplier_id: "SUP-03", cost: 0.750, note: "promo candidate" });
// STORY #6 dead shelf: P049 saffron on A06-END-C1 level 3, no sales 60 d
for (const b of branches) if (b.id === B1) for (const f of fx.filter(x => x.type === "gondola" || x.type === "chiller" || x.type === "freezer" || x.type === "endcap")) {
  const ps = products.filter(p => p.aisle === f.row || (f.type === "chiller" && p.category === "dairy") || (f.type === "freezer" && p.category === "frozen"));
  const take = f.type === "endcap" ? 1 : 4;
  for (let i = 0; i < take && i < ps.length; i++) {
    const p = ps[(fx.indexOf(f) + i) % ps.length];
    const onShelf = ri(0, 40), inWh = ri(0, 120);
    stock_locations.push({ fixture_id: f.id, level: 1 + (i % (f.levels || 5)), product_id: p.id, facings: ri(2, 8), qty_on_shelf: onShelf, qty_in_warehouse: inWh, min_qty: 8, status: onShelf === 0 ? "empty" : onShelf < 8 ? "low" : "ok", branch_id: B1 });
  }
}
stock_locations.push({ fixture_id: "A06-END-C1", level: 3, product_id: "P049", facings: 6, qty_on_shelf: 24, qty_in_warehouse: 30, min_qty: 4, status: "ok", branch_id: B1, stagnant_days: 61 });
stock_locations.push({ fixture_id: "A02-END-C2", level: 2, product_id: "P015", facings: 8, qty_on_shelf: 30, qty_in_warehouse: 90, min_qty: 10, status: "ok", branch_id: B1 });

// ---------- members ----------
const members = [];
const FN = ["أحمد","محمد","فهد","خالد","يوسف","عبدالله","سعود","ناصر","نورة","مريم","فاطمة","سارة","هند","لولوة","دلال","منيرة"];
const LN = ["العنزي","المطيري","الرشيدي","العجمي","الخالدي","الصباح","الفضلي","الهاجري","الدوسري","الكندري","العتيبي","الشمري"];
for (const c of coops) for (let i = 0; i < 60; i++) {
  const nm = `${pick(FN)} ${pick(LN)}`;
  members.push({ id: `${c.id}-MEM-${pad(i + 1, 4)}`, coop_id: c.id, name_ar: nm, name_en: `Member ${pad(i + 1, 4)}`, civil_id_masked: `2******${ri(1000, 9999)}`, phone: `+965 ${pick([5,6,9])}${ri(1000000, 9999999)}`, class: i < 45 ? "working" : "associate", shares: ri(5, 50), share_value: 5, ytd_purchases: 0, voting_eligible: i < 45, joined_on: dayOf(-ri(400, 5000)) });
}
// STORY #1: the cashier's friend
const FRIEND = members.find(m => m.id === "C1-MEM-0007"); FRIEND.phone = "+965 99990007"; FRIEND.name_ar = "سالم الرشيدي"; FRIEND.name_en = "Salem Al-Rashidi";

// ---------- employees ----------
const employees = [], schedules = [];
const ROLES = [["cashier","كاشير","Cashier",380],["stockkeeper","أمين مخزن","Stockkeeper",420],["branch_manager","مدير فرع","Branch Manager",1100],["purchaser","مشتري","Purchaser",750],["accountant","محاسب","Accountant",800],["hr","موارد بشرية","HR",700],["leasing","مسؤول مساحات","Leasing Officer",700],["driver","سائق توصيل","Delivery Driver",350]];
let eid = 1;
const mkEmp = (coop, branch, role, name_ar, name_en, extra = {}) => { const r = ROLES.find(x => x[0] === role); const e = { id: `EMP-${pad(eid++)}`, coop_id: coop, branch_id: branch, username: name_en.toLowerCase().split(" ")[0] + eid, name_ar, name_en, role, role_ar: r[1], role_en: r[2], salary: r[3] + ri(0, 80), hire_date: dayOf(-ri(200, 3000)), contract_end: dayOf(ri(30, 700)), civil_id_masked: `2******${ri(1000, 9999)}`, active: true, ...extra }; employees.push(e); return e; };
const KHALID = mkEmp("C1", B1, "cashier", "خالد المطيري", "Khalid Al-Mutairi", { username: "khalid" });   // STORY #1 #2
const CASHIERS_B1 = [KHALID, mkEmp("C1",B1,"cashier","نورة العنزي","Noura Al-Anzi"), mkEmp("C1",B1,"cashier","يوسف الفضلي","Yousef Al-Fadhli"), mkEmp("C1",B1,"cashier","مريم الكندري","Mariam Al-Kandari"), mkEmp("C1",B1,"cashier","فهد الهاجري","Fahad Al-Hajri"), mkEmp("C1",B1,"cashier","دلال الشمري","Dalal Al-Shammari")];
const MGR_B1 = mkEmp("C1", B1, "branch_manager", "عبدالله الخالدي", "Abdullah Al-Khalidi", { username: "abdullah" });
mkEmp("C1", B1, "stockkeeper", "ناصر الدوسري", "Nasser Al-Dosari"); mkEmp("C1", B1, "stockkeeper", "سعود العتيبي", "Saud Al-Otaibi");
mkEmp("C1", null, "purchaser", "هند الصباح", "Hind Al-Sabah"); mkEmp("C1", null, "accountant", "محمد الرشيدي", "Mohammed Al-Rashidi"); mkEmp("C1", null, "hr", "لولوة العجمي", "Lulwa Al-Ajmi"); mkEmp("C1", null, "leasing", "منيرة المطيري", "Munira Al-Mutairi");
for (const b of branches.filter(x => x.id !== B1)) { for (let i = 0; i < 3; i++) mkEmp(b.coop_id, b.id, "cashier", `${pick(FN)} ${pick(LN)}`, `Cashier ${eid}`); mkEmp(b.coop_id, b.id, "branch_manager", `${pick(FN)} ${pick(LN)}`, `Manager ${eid}`); mkEmp(b.coop_id, b.id, "stockkeeper", `${pick(FN)} ${pick(LN)}`, `Stockkeeper ${eid}`); }
// STORY #17 ghost employees in C3 (salary, zero punches, 3 months)
const GHOSTS = []; for (let i = 0; i < 6; i++) GHOSTS.push(mkEmp("C3", "C3-B2", pick(["cashier","stockkeeper","driver"]), `${pick(FN)} ${pick(LN)}`, `Employee ${eid}`, { ghost: true }));

// ---------- attendance (last 90 days) ----------
const attendance = [];
for (const e of employees) {
  const sched = e.role === "cashier" && e.branch_id === B1 ? (CASHIERS_B1.indexOf(e) % 2 === 0 ? "PM" : "AM") : "AM";
  for (let n = -DAYS; n < 0; n++) {
    const day = dayOf(n); const dw = dow(day);
    if (dw === "Fri" && e.role !== "cashier") continue;
    if (e.ghost) continue;                                         // STORY #17: no punches at all
    const absent = rnd() < 0.03 || (e.username === "khalid" ? false : rnd() < 0.01);
    if (absent) { attendance.push({ employee_id: e.id, date: day, shift: sched, status: "absent" }); continue; }
    const start = sched === "AM" ? 8 * 60 : 15 * 60;
    let lateMin = rnd() < 0.12 ? ri(5, 40) : 0;
    if (e.id === "EMP-003" && dw === "Sun") lateMin = ri(20, 45);   // STORY #12b: repeated Sunday lateness (Yousef)
    const inT = start + lateMin, outT = start + 8 * 60 + ri(-20, 40);
    const noOut = rnd() < 0.04;
    attendance.push({ employee_id: e.id, date: day, shift: sched, punch_in: `${pad(Math.floor(inT / 60), 2)}:${pad(inT % 60, 2)}`, punch_out: noOut ? null : `${pad(Math.floor(outT / 60), 2)}:${pad(outT % 60, 2)}`, late_minutes: lateMin, status: lateMin > 15 ? "late" : noOut ? "no_punch_out" : "present", device_id: e.branch_id === B1 ? "BIO-G1" : `BIO-${e.branch_id}` });
  }
}

// ---------- sales (detailed for C1 branches, daily aggregates for C2/C3) ----------
const sales = [], sale_items = [], voids = [], refunds = [], shifts = [], cash_movements = [], daily_sales = [];
let sid = 1, shid = 1, vid = 1, rid = 1, cmid = 1;
const seasonal = (day, p) => { const dw = dow(day); let f = dw === "Thu" ? 1.3 : dw === "Fri" ? 1.2 : dw === "Sat" ? 1.05 : 0.9; if (p.category === "bakery" && dw === "Fri") f *= 1.3; return f; };
for (const b of branches) {
  const detailed = b.coop_id === "C1";
  const cashiers = employees.filter(e => e.role === "cashier" && e.branch_id === b.id);
  const mgr = employees.find(e => e.role === "branch_manager" && e.branch_id === b.id);
  for (let n = -DAYS; n < 0; n++) {
    const day = dayOf(n); const dw = dow(day);
    const scale = b.code === "B1" ? 1 : 0.4;
    let dayRev = 0, dayCost = 0, dayCount = 0;
    if (!detailed) {
      for (const p of products) { const q = Math.round(p.daily_base * scale * seasonal(day, p) * (0.8 + rnd() * 0.4)); dayRev += q * p.price; dayCost += q * p.cost; dayCount += q; }
      daily_sales.push({ branch_id: b.id, coop_id: b.coop_id, date: day, revenue: kd(dayRev), cost: kd(dayCost), units: dayCount, invoices: Math.round(dayCount / 4.2), voids: ri(0, 3), refunds: ri(0, 2) });
      continue;
    }
    // shifts: AM & PM per cashier pair
    for (const sh of ["AM","PM"]) {
      const cs = cashiers.filter((c, i) => (sh === "PM" ? i % 2 === 0 : i % 2 === 1));
      for (const c of cs) {
        const expected = kd(ri(900, 2600) * scale);
        let variance = kd((rnd() - 0.5) * 6);
        let noSale = rnd() < 0.15 ? 1 : 0;
        if (c.username === "khalid" && sh === "PM" && dw === "Tue") { variance = kd(-(6 + rnd() * 5)); noSale = 3; }   // STORY #2
        const counted = kd(expected + variance);
        shifts.push({ id: `SH-${pad(shid++, 5)}`, branch_id: b.id, cashier_id: c.id, date: day, shift: sh, terminal: `POS-0${1 + (cashiers.indexOf(c) % 6)}`, opening_float: 100, expected_cash: expected, counted_cash: counted, variance, approved_by: mgr.id, status: Math.abs(variance) > 5 ? "disputed" : "approved", no_sale_opens: noSale });
        for (let k = 0; k < noSale; k++) cash_movements.push({ id: `CM-${pad(cmid++, 5)}`, shift_id: shifts.at(-1).id, type: "no_sale", amount: 0, time: sh === "PM" ? `${ri(21, 22)}:${pad(ri(0, 59), 2)}` : `${ri(9, 13)}:${pad(ri(0, 59), 2)}`, approved_by: null });
      }
    }
    const invoices = Math.round((b.code === "B1" ? 95 : 40) * (dw === "Thu" ? 1.3 : dw === "Fri" ? 1.2 : 1));
    for (let i = 0; i < invoices; i++) {
      const hour = pick([9,10,11,12,13,16,17,18,19,19,20,20,21,22]);
      const c = pick(cashiers.filter((x, idx) => hour < 15 ? idx % 2 === 1 : idx % 2 === 0));
      const mem = rnd() < 0.72 ? pick(members.filter(m => m.coop_id === b.coop_id)) : null;
      const nItems = ri(1, 7); let total = 0, cost = 0; const lines = [];
      for (let j = 0; j < nItems; j++) { const p = pick(products); const q = ri(1, 3); lines.push({ product_id: p.id, qty: q, unit_price: p.price, unit_cost: p.cost }); total += q * p.price; cost += q * p.cost; }
      const s = { id: `S-${pad(sid++, 6)}`, branch_id: b.id, coop_id: b.coop_id, date: day, time: `${pad(hour, 2)}:${pad(ri(0, 59), 2)}`, cashier_id: c.id, member_id: mem?.id ?? null, phone: mem?.phone ?? null, total: kd(total), cost: kd(cost), payment: pick(["cash","knet","knet","card"]), line_voids: rnd() < 0.05 ? 1 : 0 };
      sales.push(s); for (const l of lines) sale_items.push({ sale_id: s.id, ...l });
      if (mem) mem.ytd_purchases = kd(mem.ytd_purchases + total);
      if (rnd() < 0.012) voids.push({ id: `V-${pad(vid++, 4)}`, sale_id: s.id, branch_id: b.id, cashier_id: c.id, approved_by: mgr.id, reason: pick(["cashier_error","customer_changed_mind","price_dispute"]), minutes_after_sale: ri(1, 40), date: day, amount: s.total, payment: s.payment });
      if (rnd() < 0.008) refunds.push({ id: `R-${pad(rid++, 4)}`, sale_id: s.id, branch_id: b.id, cashier_id: c.id, approved_by: mgr.id, reason: pick(["damaged","expired","wrong_item"]), minutes_after_sale: ri(5, 3000), date: day, amount: kd(s.total * 0.4), refund_method: s.payment });
    }
  }
}
// STORY #1: Khalid — 9 invoices this month for the same phone (his friend), each with a line void after scan, cash
for (let k = 0; k < 9; k++) {
  const day = dayOf(-ri(1, 28)); const s = { id: `S-${pad(sid++, 6)}`, branch_id: B1, coop_id: "C1", date: day, time: `${ri(16, 21)}:${pad(ri(0, 59), 2)}`, cashier_id: KHALID.id, member_id: FRIEND.id, phone: FRIEND.phone, total: kd(ri(8, 22) + rnd()), cost: 0, payment: "cash", line_voids: ri(1, 3), flagged: "friend_pattern" };
  s.cost = kd(s.total * 0.7); sales.push(s);
}
// STORY #1b: Khalid — voids after cash payment, customer gone (6 this month, same approver)
for (let k = 0; k < 6; k++) { const s = pick(sales.filter(x => x.cashier_id === KHALID.id && x.payment === "cash" && !x.flagged)); voids.push({ id: `V-${pad(vid++, 4)}`, sale_id: s.id, branch_id: B1, cashier_id: KHALID.id, approved_by: MGR_B1.id, reason: "customer_changed_mind", minutes_after_sale: ri(12, 35), date: s.date, amount: s.total, payment: "cash", flagged: "post_cash_void" }); }

// ---------- supplier deliveries, POs, invoices ----------
const purchase_orders = [], grns = [], supplier_invoices = [], supplier_deliveries = [];
let poid = 1, gid = 1, siid = 1;
for (const s of suppliers) for (let k = 0; k < 6; k++) {
  const p = pick(products.filter(x => x.supplier_id === s.id)) ?? pick(products);
  const ordered = ri(50, 300); const late = k < Math.round(6 * (1 - s.on_time_rate)); const short = k < s.short_deliveries; const nearExp = k < s.near_expiry_deliveries;
  const po = { id: `PO-${pad(poid++)}`, supplier_id: s.id, branch_id: B1, product_id: p.id, qty: ordered, unit_cost: p.cost, total: kd(ordered * p.cost), ordered_on: dayOf(-ri(10, 85)), approved_by: "purchaser", status: "received" };
  purchase_orders.push(po);
  const g = { id: `GRN-${pad(gid++)}`, po_id: po.id, received_qty: short ? ordered - ri(10, 40) : ordered, received_on: iso(addDays(new Date(po.ordered_on), late ? ri(4, 9) : ri(1, 3))), days_late: late ? ri(2, 7) : 0, blind_count: true, expiry_days_at_receipt: nearExp ? ri(12, 28) : ri(90, 400), received_by: "EMP-008" };
  grns.push(g); supplier_deliveries.push({ supplier_id: s.id, po_id: po.id, late, short, near_expiry: nearExp });
  const st = k === 0 ? "pending_review" : k === 1 ? "reviewed" : k === 2 ? "chair_approved" : "posted";
  supplier_invoices.push({ id: `INV-${pad(siid++)}`, supplier_id: s.id, po_id: po.id, grn_id: g.id, amount: kd(g.received_qty * p.cost), due_on: dayOf(ri(5, 40)), three_way_match: g.received_qty === ordered ? "matched" : "qty_mismatch", status: st, approvals: { reviewer: st !== "pending_review", chair: ["chair_approved","posted"].includes(st), treasurer: st === "posted" } });
}

// ---------- complaints ----------
const complaints = [
  { id: "CMP-0101", branch_id: B1, member_id: "C1-MEM-0012", category: "product_quality", priority: "high", subject_ar: "زبادي طعمه متغير", subject_en: "Yogurt tastes off", lot_id: "LOT-4471", product_id: "P003", opened_at: dayOf(-2) + "T10:20", assigned_to: "EMP-007", due_at: dayOf(-2) + "T12:20", status: "open", sla_breached: true },
  { id: "CMP-0102", branch_id: B1, member_id: "C1-MEM-0031", category: "product_quality", priority: "high", subject_ar: "زبادي منتفخ الغطاء", subject_en: "Yogurt lid bulging", lot_id: "LOT-4471", product_id: "P003", opened_at: dayOf(-1) + "T17:05", assigned_to: "EMP-007", due_at: dayOf(-1) + "T19:05", status: "open", sla_breached: true },
  { id: "CMP-0103", branch_id: B1, member_id: "C1-MEM-0044", category: "product_quality", priority: "high", subject_ar: "زبادي فاسد قبل التاريخ", subject_en: "Yogurt spoiled before date", lot_id: "LOT-4471", product_id: "P003", opened_at: dayOf(0) + "T09:40", assigned_to: "EMP-007", due_at: dayOf(0) + "T11:40", status: "open", sla_breached: false },
  { id: "CMP-0104", branch_id: "C1-B2", member_id: "C1-MEM-0003", category: "delivery", priority: "medium", subject_ar: "تأخر طلب الواتساب", subject_en: "WhatsApp order late", opened_at: dayOf(-3) + "T14:00", assigned_to: "EMP-020", due_at: dayOf(-3) + "T18:00", status: "resolved", sla_breached: false, resolution: "تم التوصيل واعتذار" },
  { id: "CMP-0105", branch_id: B1, member_id: null, category: "price", priority: "high", subject_ar: "أرز مدعوم أغلى من السعر المحدد", subject_en: "Subsidized rice above cap", product_id: "P021", opened_at: dayOf(-4) + "T11:00", assigned_to: MGR_B1.id, due_at: dayOf(-4) + "T13:00", status: "escalated", sla_breached: true },
  { id: "CMP-0106", branch_id: B1, member_id: "C1-MEM-0022", category: "staff", priority: "medium", subject_ar: "تعامل غير لائق عند الكاشير", subject_en: "Rude treatment at checkout", opened_at: dayOf(-6) + "T20:10", assigned_to: MGR_B1.id, due_at: dayOf(-5) + "T00:10", status: "resolved", sla_breached: false, resolution: "تنبيه شفهي وتدريب" },
];

// ---------- promotions, writeoffs, subsidized breaches, alerts ----------
const promotions = [
  { id: "PR-001", branch_id: B1, product_id: "P008", lot_id: "LOT-4388", type: "bogo", type_ar: "حبة والثانية مجاناً", type_en: "Buy 1 get 1", starts_on: dayOf(-9), ends_on: dayOf(-2), status: "ended", planned_units: 120, sold_units: 90, waste_avoided_kd: 180.000, suggested_by: "agent", approved_by: MGR_B1.id },
  { id: "PR-002", branch_id: B1, product_id: "P003", lot_id: "LOT-4471", type: "hold", type_ar: "موقوف — دفعة قيد الفحص", type_en: "On hold — lot under review", starts_on: null, ends_on: null, status: "blocked", suggested_by: "agent", approved_by: null },
  { id: "PR-003", branch_id: B1, product_id: "P004", type: "bundle", type_ar: "اربطه مع الخبز العربي", type_en: "Bundle with Arabic bread", starts_on: dayOf(1), ends_on: dayOf(8), status: "draft", planned_units: 80, suggested_by: "agent", approved_by: null },
];
const writeoffs = []; for (const b of branches) for (let n = -DAYS; n < 0; n += 3) { const p = pick(products.filter(x => x.shelf_life_days <= 30)); const q = ri(2, 18) * (b.coop_id === "C3" ? 3 : 1); writeoffs.push({ branch_id: b.id, coop_id: b.coop_id, date: dayOf(n), product_id: p.id, qty: q, value: kd(q * p.cost), reason: pick(["expired","damaged","expired"]) }); }   // STORY #14: C3 waste ×3
const subsidized_breaches = [["C1-B2","P021",3.250,3.450],["C2-B1","P021",3.250,3.400],["C2-B3","P021",3.250,3.500],["C3-B2","P021",3.250,3.600]].map(([b, p, cap, sold], i) => ({ id: `SB-${pad(i + 1)}`, branch_id: b, product_id: p, cap_price: cap, sold_price: sold, since: dayOf(-ri(3, 7)), invoices: ri(40, 180) }));
const ramadan = { starts_on: "2027-02-08", days_until: Math.round((new Date("2027-02-08T00:00:00Z") - d0) / 864e5), last_year_multipliers: { P046: 4.1, P047: 3.8, P004: 4.0, P001: 2.2, P055: 2.5, P021: 1.9 } };

const agent_alerts = [
  { id: "AL-01", scenario: 1, severity: "high", coop_id: "C1", branch_id: B1, title_ar: "نمط حذف أصناف متكرر عند كاشير", title_en: "Repeated line-void pattern at one cashier", question_ar: "فيه كاشير يجامل أحد؟", question_en: "Is any cashier favouring someone?" },
  { id: "AL-04", scenario: 4, severity: "high", coop_id: "C1", branch_id: null, title_ar: "14 صنفاً تُباع تحت التكلفة", title_en: "14 products selling below cost", question_ar: "فيه أصناف نبيعها بخسارة؟", question_en: "Are we selling anything at a loss?" },
  { id: "AL-03", scenario: 3, severity: "high", coop_id: "C1", branch_id: B1, title_ar: "3 شكاوي على دفعة واحدة", title_en: "3 complaints on one lot", question_ar: "ليش فيه شكاوي على الزبادي؟", question_en: "Why are there yogurt complaints?" },
  { id: "AL-08", scenario: 8, severity: "medium", coop_id: "C1", branch_id: B1, title_ar: "عقد رأس الممر A02 ينتهي خلال 45 يوماً", title_en: "A02 end-cap contract ends in 45 days", question_ar: "وش وضع الرف الثاني؟", question_en: "What's the status of the second shelf?" },
  { id: "AL-09", scenario: 9, severity: "medium", coop_id: "C1", branch_id: B1, title_ar: "محل M-07 متأخر 45 يوماً", title_en: "Shop M-07 is 45 days late", question_ar: "منو متأخر بالإيجار؟", question_en: "Who is late on rent?" },
  { id: "AL-02", scenario: 2, severity: "medium", coop_id: "C1", branch_id: B1, title_ar: "عجز متكرر في وردية الثلاثاء مساءً", title_en: "Recurring Tuesday-evening shift shortage", question_ar: "ليش فيه عجز بالصندوق؟", question_en: "Why is the cash drawer short?" },
  { id: "AL-12", scenario: 12, severity: "low", coop_id: "C1", branch_id: B1, title_ar: "طابور الخميس 7–9 مساءً يتجاوز 8 أشخاص", title_en: "Thursday 7–9 pm queue exceeds 8 people", question_ar: "متى نحتاج كاشير زيادة؟", question_en: "When do we need an extra cashier?" },
  { id: "AL-17", scenario: 17, severity: "high", coop_id: "C3", branch_id: "C3-B2", title_ar: "6 موظفين براتب بلا أي بصمة", title_en: "6 salaried employees with zero punches", question_ar: "فيه موظفين وهميين؟", question_en: "Are there ghost employees?", ministry: true },
  { id: "AL-15", scenario: 15, severity: "high", coop_id: null, branch_id: null, title_ar: "4 فروع تبيع الأرز المدعوم فوق السعر", title_en: "4 branches selling subsidized rice above cap", question_ar: "منو يبيع المدعوم فوق السعر؟", question_en: "Who sells subsidized goods above cap?", ministry: true },
];

// ---------- write ----------
const files = { coops, branches, products, suppliers, subsidized_prices, floorplan: { width: 60, height: 30, fixtures: fx }, traffic, spaces, tenants, lease_contracts, lease_invoices, shelf_reservations, lots, stock_locations, members, employees, attendance, sales, sale_items, voids, refunds, shifts, cash_movements, daily_sales, purchase_orders, grns, supplier_invoices, supplier_deliveries, complaints, promotions, writeoffs, subsidized_breaches, ramadan, agent_alerts, meta: { demo_date: DEMO_DATE, generated_at: new Date().toISOString(), days: DAYS, mapped_branch: B1 } };
for (const [name, data] of Object.entries(files)) writeFileSync(join(OUT, `${name}.json`), JSON.stringify(data));
console.log("wrote", Object.keys(files).length, "files to", OUT, "| sales:", sales.length, "| attendance:", attendance.length, "| traffic:", traffic.length);
