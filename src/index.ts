import { authPage, getSessionUser, handleAuth, sameOrigin, type SessionUser } from "./auth";

export interface Env {
  APP_NAME: string;
  APP_VERSION: string;
  ENVIRONMENT: string;
  DB: D1Database;
}

interface FarmRow {
  id: string;
  name: string;
  crop_type: string;
  latitude: number;
  longitude: number;
  area_rai: number | null;
  timezone: string;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const ALLOWED_CROPS = new Set(["rubber", "oil_palm", "mixed", "generic"]);

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: { ...JSON_HEADERS, ...init.headers },
  });

const apiError = (status: number, error: string, message: string, details?: unknown) =>
  json({ ok: false, error, message, ...(details ? { details } : {}) }, { status });

const farmResponse = (farm: FarmRow) => ({ ...farm, is_active: farm.is_active === 1 });

const bodyAsObject = async (request: Request): Promise<Record<string, unknown> | null> => {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const requiredText = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;

const optionalText = (value: unknown, max: number) => {
  if (value === undefined || value === null || value === "") return null;
  return typeof value === "string" && value.trim().length <= max ? value.trim() : undefined;
};

const finiteNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

async function getFarm(db: D1Database, id: string, userId: string): Promise<FarmRow | null> {
  return db.prepare("SELECT * FROM farms WHERE id = ?1 AND owner_user_id = ?2").bind(id, userId).first<FarmRow>();
}

async function handleFarms(request: Request, env: Env, user: SessionUser, farmId?: string): Promise<Response> {
  if (request.method === "GET" && !farmId) {
    const activeOnly = new URL(request.url).searchParams.get("active") !== "all";
    const query = activeOnly
      ? "SELECT * FROM farms WHERE owner_user_id = ?1 AND is_active = 1 ORDER BY created_at DESC"
      : "SELECT * FROM farms WHERE owner_user_id = ?1 ORDER BY created_at DESC";
    const result = await env.DB.prepare(query).bind(user.id).all<FarmRow>();
    const defaultFarm = await env.DB.prepare(
      "SELECT value FROM user_settings WHERE user_id = ?1 AND key = 'default_farm_id'",
    ).bind(user.id).first<{ value: string }>();
    return json({
      ok: true,
      farms: result.results.map(farmResponse),
      default_farm_id: defaultFarm?.value ?? null,
    });
  }

  if (request.method === "GET" && farmId) {
    const farm = await getFarm(env.DB, farmId, user.id);
    return farm
      ? json({ ok: true, farm: farmResponse(farm) })
      : apiError(404, "FARM_NOT_FOUND", "Farm not found");
  }

  const body = await bodyAsObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  if (request.method === "POST" && !farmId) {
    const name = requiredText(body.name, 120);
    const cropType = requiredText(body.crop_type ?? "generic", 40);
    const latitude = finiteNumber(body.latitude);
    const longitude = finiteNumber(body.longitude);
    const areaRai = body.area_rai === undefined || body.area_rai === null ? null : finiteNumber(body.area_rai);
    const timezone = requiredText(body.timezone ?? "Asia/Bangkok", 80);
    const notes = optionalText(body.notes, 1000);
    const errors: string[] = [];
    if (!name) errors.push("name is required and must not exceed 120 characters");
    if (!cropType || !ALLOWED_CROPS.has(cropType)) errors.push("crop_type is invalid");
    if (latitude === null || latitude < -90 || latitude > 90) errors.push("latitude must be between -90 and 90");
    if (longitude === null || longitude < -180 || longitude > 180) errors.push("longitude must be between -180 and 180");
    if (body.area_rai !== undefined && body.area_rai !== null && (areaRai === null || areaRai < 0)) errors.push("area_rai must be zero or greater");
    if (!timezone) errors.push("timezone is invalid");
    if (notes === undefined) errors.push("notes must not exceed 1000 characters");
    if (errors.length) return apiError(422, "VALIDATION_ERROR", "Farm data is invalid", errors);

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO farms (id, name, crop_type, latitude, longitude, area_rai, timezone, notes, owner_user_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    ).bind(id, name, cropType, latitude, longitude, areaRai, timezone, notes, user.id).run();
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM farms WHERE owner_user_id = ?1").bind(user.id).first<{ count: number }>();
    if (count?.count === 1) {
      await env.DB.prepare(
        `INSERT INTO user_settings (user_id, key, value) VALUES (?1, 'default_farm_id', ?2)
         ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      ).bind(user.id, id).run();
    }
    return json({ ok: true, farm: farmResponse((await getFarm(env.DB, id, user.id))!) }, { status: 201 });
  }

  if (request.method === "PATCH" && farmId) {
    const current = await getFarm(env.DB, farmId, user.id);
    if (!current) return apiError(404, "FARM_NOT_FOUND", "Farm not found");
    const next = {
      name: body.name === undefined ? current.name : requiredText(body.name, 120),
      cropType: body.crop_type === undefined ? current.crop_type : requiredText(body.crop_type, 40),
      latitude: body.latitude === undefined ? current.latitude : finiteNumber(body.latitude),
      longitude: body.longitude === undefined ? current.longitude : finiteNumber(body.longitude),
      areaRai: body.area_rai === undefined ? current.area_rai : body.area_rai === null ? null : finiteNumber(body.area_rai),
      timezone: body.timezone === undefined ? current.timezone : requiredText(body.timezone, 80),
      notes: body.notes === undefined ? current.notes : optionalText(body.notes, 1000),
      isActive: body.is_active === undefined ? current.is_active : body.is_active === true ? 1 : body.is_active === false ? 0 : null,
    };
    const errors: string[] = [];
    if (!next.name) errors.push("name is invalid");
    if (!next.cropType || !ALLOWED_CROPS.has(next.cropType)) errors.push("crop_type is invalid");
    if (next.latitude === null || next.latitude < -90 || next.latitude > 90) errors.push("latitude is invalid");
    if (next.longitude === null || next.longitude < -180 || next.longitude > 180) errors.push("longitude is invalid");
    if (next.areaRai !== null && next.areaRai < 0) errors.push("area_rai is invalid");
    if (!next.timezone) errors.push("timezone is invalid");
    if (next.notes === undefined) errors.push("notes is invalid");
    if (next.isActive === null) errors.push("is_active must be true or false");
    if (errors.length) return apiError(422, "VALIDATION_ERROR", "Farm data is invalid", errors);

    await env.DB.prepare(
      `UPDATE farms SET name = ?1, crop_type = ?2, latitude = ?3, longitude = ?4,
       area_rai = ?5, timezone = ?6, notes = ?7, is_active = ?8, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?9 AND owner_user_id = ?10`,
    ).bind(next.name, next.cropType, next.latitude, next.longitude, next.areaRai, next.timezone, next.notes, next.isActive, farmId, user.id).run();
    return json({ ok: true, farm: farmResponse((await getFarm(env.DB, farmId, user.id))!) });
  }

  return apiError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
}

async function handleDefaultFarm(request: Request, env: Env, user: SessionUser): Promise<Response> {
  if (request.method === "GET") {
    const setting = await env.DB.prepare(
      "SELECT value FROM user_settings WHERE user_id = ?1 AND key = 'default_farm_id'",
    ).bind(user.id).first<{ value: string }>();
    const farm = setting?.value ? await getFarm(env.DB, setting.value, user.id) : null;
    return json({ ok: true, default_farm_id: setting?.value ?? null, farm: farm ? farmResponse(farm) : null });
  }
  if (request.method === "PUT") {
    const body = await bodyAsObject(request);
    const farmId = body && requiredText(body.farm_id, 80);
    if (!farmId) return apiError(422, "VALIDATION_ERROR", "farm_id is required");
    const farm = await getFarm(env.DB, farmId, user.id);
    if (!farm || farm.is_active !== 1) return apiError(404, "FARM_NOT_FOUND", "Active farm not found");
    await env.DB.prepare(
      `INSERT INTO user_settings (user_id, key, value) VALUES (?1, 'default_farm_id', ?2)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    ).bind(user.id, farmId).run();
    return json({ ok: true, default_farm_id: farmId, farm: farmResponse(farm) });
  }
  return apiError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
}

const landingPage = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#14532d">
<title>FarmPulse — ผู้ช่วยจัดการสวน</title>
<style>
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17251c;background:#f3f7f3;font-synthesis:none}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(180deg,#14532d 0,#1d6a3a 220px,#f3f7f3 220px);font-size:17px}
button,input,select,textarea{font:inherit}button{cursor:pointer}.shell{width:min(100%,760px);margin:auto;padding:22px 16px 96px}
.top{color:#fff;display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}.brand{display:flex;align-items:center;gap:12px}.logo{width:52px;height:52px;border-radius:17px;background:#facc15;display:grid;place-items:center;font-size:28px;box-shadow:0 8px 24px #0b2e1c55}.brand h1{font-size:27px;line-height:1;margin:0}.brand small{display:block;margin-top:5px;color:#d7f2df}.status{white-space:nowrap;border:1px solid #ffffff40;background:#ffffff18;border-radius:999px;padding:8px 11px;font-size:14px;font-weight:800}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#86efac;margin-right:6px}
.hero,.card{background:#fff;border:1px solid #dce8de;border-radius:24px;box-shadow:0 12px 34px #173e2512}.hero{padding:24px;margin-bottom:16px}.eyebrow{font-size:13px;font-weight:900;color:#287348;letter-spacing:.08em}.hero h2{font-size:clamp(28px,7vw,40px);line-height:1.12;margin:8px 0 10px}.hero p{color:#536459;line-height:1.55;margin:0}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:20px}.stat{border-radius:17px;background:#eff7f0;padding:13px 10px;text-align:center}.stat b{display:block;color:#166534;font-size:22px}.stat span{font-size:12px;color:#607066}
.card{padding:20px;margin-top:16px}.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.section-head h3{font-size:22px;margin:0}.primary,.secondary,.location{border:0;border-radius:14px;font-weight:800;padding:12px 15px}.primary{background:#166534;color:#fff;box-shadow:0 7px 18px #16653425}.secondary{background:#e9f5ec;color:#14532d}.location{width:100%;background:#edf7ef;color:#166534;margin-top:4px}
.empty{text-align:center;padding:30px 14px;border:2px dashed #cfe0d2;border-radius:19px;color:#607066}.empty-icon{font-size:43px}.empty b{display:block;color:#213529;font-size:19px;margin:8px}
.farm{border:1px solid #dce7de;border-radius:18px;padding:16px;margin-top:11px;display:grid;grid-template-columns:1fr auto;gap:8px;background:#fff}.farm h4{font-size:19px;margin:0 0 6px}.meta{color:#66756b;font-size:14px;line-height:1.6}.tag{align-self:start;background:#e7f5eb;color:#166534;padding:6px 9px;border-radius:999px;font-size:12px;font-weight:900}.default{background:#fef3c7;color:#854d0e}.farm-actions{grid-column:1/-1;border-top:1px solid #edf2ee;padding-top:10px;margin-top:4px}.farm-actions button{border:0;background:transparent;color:#166534;font-weight:800;padding:5px 0}
dialog{width:min(calc(100% - 24px),560px);max-height:90vh;border:0;border-radius:25px;padding:0;box-shadow:0 24px 80px #0005}dialog::backdrop{background:#07180d99}.modal{padding:22px}.modal-head{display:flex;justify-content:space-between;align-items:center}.modal h3{font-size:24px;margin:0}.close{border:0;background:#edf2ee;border-radius:50%;width:42px;height:42px;font-size:24px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.field{margin-top:14px}.field.full{grid-column:1/-1}.field label{font-weight:800;font-size:14px;display:block;margin-bottom:7px}.field input,.field select,.field textarea{width:100%;border:1px solid #cbd9ce;border-radius:13px;padding:13px;background:#fff;color:#17251c}.field input:focus,.field select:focus{outline:3px solid #bbf7d0;border-color:#22c55e}.hint{font-size:13px;color:#68776d;margin:10px 0}.save{width:100%;margin-top:18px;padding:15px}.notice{display:none;border-radius:14px;padding:12px;margin:12px 0 0;font-weight:700}.notice.show{display:block}.notice.ok{background:#dcfce7;color:#166534}.notice.error{background:#fee2e2;color:#991b1b}.footer{text-align:center;color:#718077;font-size:13px;margin-top:24px}
@media(max-width:480px){body{font-size:16px}.top{align-items:flex-start}.status{font-size:12px}.stats{grid-template-columns:1fr 1fr}.stats .stat:last-child{grid-column:1/-1}.grid{grid-template-columns:1fr}.field.full{grid-column:auto}.hero,.card{border-radius:21px}.shell{padding-top:16px}}
</style>
</head>
<body>
<div class="shell">
<header class="top"><div class="brand"><div class="logo">🌱</div><div><h1>FarmPulse</h1><small>ผู้ช่วยจัดการสวนของคุณ</small></div></div><div class="status"><i class="dot"></i><span id="systemState">กำลังตรวจสอบ</span></div></header>
<main>
<section class="hero">
<div class="eyebrow">FARMPULSE • PHASE 2</div>
<h2>เริ่มต้นจากข้อมูลสวน<br>เพื่อวางแผนได้แม่นยำขึ้น</h2>
<p>เพิ่มสวนและตำแหน่งของคุณ ระบบจะใช้ข้อมูลนี้ร่วมกับสภาพอากาศเพื่อเตรียมคำแนะนำงานสวนในขั้นถัดไป</p>
<div class="stats">
<div class="stat"><b id="appVersion">—</b><span>เวอร์ชัน</span></div>
<div class="stat"><b id="dbState">—</b><span>ฐานข้อมูล</span></div>
<div class="stat"><b id="farmCount">—</b><span>สวนทั้งหมด</span></div>
</div>
</section>
<section class="card">
<div class="section-head"><h3>สวนของฉัน</h3><button class="primary" id="openForm">＋ เพิ่มสวน</button></div>
<div id="notice" class="notice"></div>
<div id="farmList"><div class="empty"><div class="empty-icon">⏳</div><b>กำลังโหลดข้อมูล</b></div></div>
</section>
<div class="footer">ข้อมูลจัดเก็บใน Cloudflare D1 • เขตเวลาไทย</div>
</main>
</div>
<dialog id="farmDialog">
<form class="modal" id="farmForm">
<div class="modal-head"><h3>เพิ่มข้อมูลสวน</h3><button class="close" type="button" id="closeForm" aria-label="ปิด">×</button></div>
<div class="grid">
<div class="field full"><label for="farmName">ชื่อสวน *</label><input id="farmName" name="name" maxlength="120" placeholder="เช่น สวนนิพนธ์" required></div>
<div class="field"><label for="cropType">ประเภทพืช *</label><select id="cropType" name="crop_type"><option value="rubber">ยางพารา</option><option value="oil_palm">ปาล์มน้ำมัน</option><option value="mixed">สวนผสม</option><option value="generic">อื่น ๆ</option></select></div>
<div class="field"><label for="areaRai">พื้นที่ (ไร่)</label><input id="areaRai" name="area_rai" type="number" min="0" step="0.01" placeholder="เช่น 12"></div>
<div class="field"><label for="latitude">ละติจูด *</label><input id="latitude" name="latitude" type="number" min="-90" max="90" step="any" placeholder="7.617" required></div>
<div class="field"><label for="longitude">ลองจิจูด *</label><input id="longitude" name="longitude" type="number" min="-180" max="180" step="any" placeholder="100.074" required></div>
<div class="field full"><button class="location" type="button" id="useLocation">📍 ใช้ตำแหน่งปัจจุบันของฉัน</button><div class="hint" id="locationHint">เบราว์เซอร์จะขออนุญาตใช้ตำแหน่งเฉพาะตอนกดปุ่มนี้</div></div>
<div class="field full"><label for="notes">หมายเหตุ</label><textarea id="notes" name="notes" rows="2" maxlength="1000" placeholder="ข้อมูลเพิ่มเติมเกี่ยวกับสวน"></textarea></div>
</div>
<div id="formNotice" class="notice"></div>
<button class="primary save" id="saveFarm" type="submit">บันทึกสวน</button>
</form>
</dialog>
<script>
(function(){
var dialog=document.getElementById("farmDialog"),list=document.getElementById("farmList"),notice=document.getElementById("notice"),formNotice=document.getElementById("formNotice");
var crops={rubber:"ยางพารา",oil_palm:"ปาล์มน้ำมัน",mixed:"สวนผสม",generic:"อื่น ๆ"};
function show(el,msg,type){el.textContent=msg;el.className="notice show "+type}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(s){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[s]})}
async function load(){
try{
var responses=await Promise.all([fetch("/api/health"),fetch("/api/db/health"),fetch("/api/farms")]);
var health=await responses[0].json(),db=await responses[1].json(),farms=await responses[2].json();
document.getElementById("systemState").textContent=health.ok?"ระบบพร้อม":"ระบบขัดข้อง";
document.getElementById("appVersion").textContent=health.version||"—";
document.getElementById("dbState").textContent=db.ok?"พร้อม":"ขัดข้อง";
document.getElementById("farmCount").textContent=(farms.farms||[]).length;
render(farms.farms||[],farms.default_farm_id);
}catch(e){document.getElementById("systemState").textContent="เชื่อมต่อไม่ได้";list.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><b>โหลดข้อมูลไม่สำเร็จ</b><span>ลองเปิดหน้านี้ใหม่อีกครั้ง</span></div>'}
}
function render(farms,defaultId){
if(!farms.length){list.innerHTML='<div class="empty"><div class="empty-icon">🌿</div><b>ยังไม่มีข้อมูลสวน</b><span>กด “เพิ่มสวน” เพื่อเริ่มใช้งาน FarmPulse</span></div>';return}
list.innerHTML=farms.map(function(f){
var isDefault=f.id===defaultId;
return '<article class="farm"><div><h4>'+esc(f.name)+'</h4><div class="meta">'+esc(crops[f.crop_type]||f.crop_type)+(f.area_rai!=null?' • '+esc(f.area_rai)+' ไร่':'')+'<br>พิกัด '+Number(f.latitude).toFixed(4)+', '+Number(f.longitude).toFixed(4)+'</div></div><span class="tag '+(isDefault?'default':'')+'">'+(isDefault?'สวนหลัก':'ใช้งานอยู่')+'</span>'+(isDefault?'':'<div class="farm-actions"><button data-default="'+esc(f.id)+'">ตั้งเป็นสวนหลัก</button></div>')+'</article>'
}).join("");
list.querySelectorAll("[data-default]").forEach(function(btn){btn.addEventListener("click",async function(){
btn.disabled=true;
try{var r=await fetch("/api/settings/default-farm",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({farm_id:btn.getAttribute("data-default")})});if(!r.ok)throw new Error();show(notice,"ตั้งเป็นสวนหลักเรียบร้อย","ok");load()}catch(e){show(notice,"ตั้งสวนหลักไม่สำเร็จ กรุณาลองใหม่","error")}finally{btn.disabled=false}
})})
}
document.getElementById("openForm").onclick=function(){formNotice.className="notice";dialog.showModal()};
document.getElementById("closeForm").onclick=function(){dialog.close()};
dialog.addEventListener("click",function(e){if(e.target===dialog)dialog.close()});
document.getElementById("useLocation").onclick=function(){
var hint=document.getElementById("locationHint");if(!navigator.geolocation){hint.textContent="อุปกรณ์นี้ไม่รองรับการอ่านตำแหน่ง";return}
hint.textContent="กำลังค้นหาตำแหน่ง…";
navigator.geolocation.getCurrentPosition(function(p){document.getElementById("latitude").value=p.coords.latitude.toFixed(6);document.getElementById("longitude").value=p.coords.longitude.toFixed(6);hint.textContent="ใส่ตำแหน่งปัจจุบันให้แล้ว"},function(){hint.textContent="ไม่สามารถอ่านตำแหน่งได้ กรุณากรอกพิกัดเอง"},{enableHighAccuracy:true,timeout:12000})
};
document.getElementById("farmForm").addEventListener("submit",async function(e){
e.preventDefault();var b=document.getElementById("saveFarm");b.disabled=true;b.textContent="กำลังบันทึก…";formNotice.className="notice";
var fd=new FormData(e.target),area=fd.get("area_rai");
var payload={name:fd.get("name"),crop_type:fd.get("crop_type"),latitude:Number(fd.get("latitude")),longitude:Number(fd.get("longitude")),area_rai:area===""?null:Number(area),timezone:"Asia/Bangkok",notes:fd.get("notes")||null};
try{var r=await fetch("/api/farms",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});var data=await r.json();if(!r.ok)throw new Error(data.message||"บันทึกไม่สำเร็จ");e.target.reset();dialog.close();show(notice,"เพิ่มสวนเรียบร้อยแล้ว","ok");await load()}catch(err){show(formNotice,err.message||"บันทึกไม่สำเร็จ","error")}finally{b.disabled=false;b.textContent="บันทึกสวน"}
});
load();
})();
</script>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/health") {
        return json({ ok: true, app: env.APP_NAME || "FarmPulse", version: env.APP_VERSION || "0.2.0", environment: env.ENVIRONMENT || "development", timestamp: new Date().toISOString() });
      }
      if (url.pathname === "/api/db/health") {
        const database = await env.DB.prepare("SELECT 1 AS connected").first<{ connected: number }>();
        const tables = await env.DB.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").first<{ count: number }>();
        return json({ ok: database?.connected === 1, database: "connected", tables: tables?.count ?? 0 });
      }
      if (url.pathname.startsWith("/api/auth/")) return handleAuth(request, env, url.pathname);

      const user = await getSessionUser(request, env);
      if (!user) {
        if (url.pathname.startsWith("/api/")) {
          return apiError(401, "AUTH_REQUIRED", "กรุณาเข้าสู่ระบบ FarmPulse");
        }
        return new Response(authPage, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      }
      if (request.method !== "GET" && request.method !== "HEAD" && !sameOrigin(request)) {
        return apiError(403, "INVALID_ORIGIN", "คำขอนี้ไม่ได้มาจาก FarmPulse");
      }

      if (url.pathname === "/api/farms") return handleFarms(request, env, user);
      const farmMatch = url.pathname.match(/^\/api\/farms\/([0-9a-f-]+)$/i);
      if (farmMatch) return handleFarms(request, env, user, farmMatch[1]);
      if (url.pathname === "/api/settings/default-farm") return handleDefaultFarm(request, env, user);
      if (url.pathname.startsWith("/api/")) return apiError(404, "NOT_FOUND", "FarmPulse API route not found");
      return new Response(landingPage, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    } catch (error) {
      console.error("Unhandled request error", error);
      return apiError(500, "INTERNAL_ERROR", "FarmPulse could not complete this request");
    }
  },
};
