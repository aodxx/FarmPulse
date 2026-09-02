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

async function getFarm(db: D1Database, id: string): Promise<FarmRow | null> {
  return db.prepare("SELECT * FROM farms WHERE id = ?1").bind(id).first<FarmRow>();
}

async function handleFarms(request: Request, env: Env, farmId?: string): Promise<Response> {
  if (request.method === "GET" && !farmId) {
    const activeOnly = new URL(request.url).searchParams.get("active") !== "all";
    const query = activeOnly
      ? "SELECT * FROM farms WHERE is_active = 1 ORDER BY created_at DESC"
      : "SELECT * FROM farms ORDER BY created_at DESC";
    const result = await env.DB.prepare(query).all<FarmRow>();
    const defaultFarm = await env.DB.prepare(
      "SELECT value FROM app_settings WHERE key = 'default_farm_id'",
    ).first<{ value: string }>();
    return json({
      ok: true,
      farms: result.results.map(farmResponse),
      default_farm_id: defaultFarm?.value ?? null,
    });
  }

  if (request.method === "GET" && farmId) {
    const farm = await getFarm(env.DB, farmId);
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
      `INSERT INTO farms (id, name, crop_type, latitude, longitude, area_rai, timezone, notes)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(id, name, cropType, latitude, longitude, areaRai, timezone, notes).run();
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM farms").first<{ count: number }>();
    if (count?.count === 1) {
      await env.DB.prepare(
        `INSERT INTO app_settings (key, value) VALUES ('default_farm_id', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      ).bind(id).run();
    }
    return json({ ok: true, farm: farmResponse((await getFarm(env.DB, id))!) }, { status: 201 });
  }

  if (request.method === "PATCH" && farmId) {
    const current = await getFarm(env.DB, farmId);
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
       WHERE id = ?9`,
    ).bind(next.name, next.cropType, next.latitude, next.longitude, next.areaRai, next.timezone, next.notes, next.isActive, farmId).run();
    return json({ ok: true, farm: farmResponse((await getFarm(env.DB, farmId))!) });
  }

  return apiError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
}

async function handleDefaultFarm(request: Request, env: Env): Promise<Response> {
  if (request.method === "GET") {
    const setting = await env.DB.prepare(
      "SELECT value FROM app_settings WHERE key = 'default_farm_id'",
    ).first<{ value: string }>();
    const farm = setting?.value ? await getFarm(env.DB, setting.value) : null;
    return json({ ok: true, default_farm_id: setting?.value ?? null, farm: farm ? farmResponse(farm) : null });
  }
  if (request.method === "PUT") {
    const body = await bodyAsObject(request);
    const farmId = body && requiredText(body.farm_id, 80);
    if (!farmId) return apiError(422, "VALIDATION_ERROR", "farm_id is required");
    const farm = await getFarm(env.DB, farmId);
    if (!farm || farm.is_active !== 1) return apiError(404, "FARM_NOT_FOUND", "Active farm not found");
    await env.DB.prepare(
      `INSERT INTO app_settings (key, value) VALUES ('default_farm_id', ?1)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    ).bind(farmId).run();
    return json({ ok: true, default_farm_id: farmId, farm: farmResponse(farm) });
  }
  return apiError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
}

const landingPage = `<!doctype html>
<html lang="th"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#0f5132" /><title>FarmPulse</title><style>
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#16231b;background:#f5f8f5}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}main{width:min(100%,560px);background:white;border-radius:24px;padding:28px;box-shadow:0 14px 45px rgba(20,50,30,.10)}.badge{display:inline-block;padding:7px 11px;border-radius:999px;background:#e5f4e9;font-weight:700;font-size:14px}h1{font-size:clamp(34px,8vw,52px);margin:16px 0 6px;line-height:1}p{font-size:18px;line-height:1.55;color:#4d5e53}.flow{margin-top:24px;padding:18px;border-radius:18px;background:#f1f6f2;font-weight:700;line-height:1.8}
</style></head><body><main><span class="badge">Phase 2 — D1 Database</span><h1>FarmPulse</h1>
<p>ผู้ช่วยวางแผนงานสวนจากสภาพอากาศ เปลี่ยนข้อมูลพยากรณ์ให้เป็นคำแนะนำที่ใช้ตัดสินใจทำงานในสวนได้จริง</p>
<div class="flow">Weather → Farm Context → Rules → Recommendation → Planning → Farm Log</div></main></body></html>`;

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
      if (url.pathname === "/api/farms") return handleFarms(request, env);
      const farmMatch = url.pathname.match(/^\/api\/farms\/([0-9a-f-]+)$/i);
      if (farmMatch) return handleFarms(request, env, farmMatch[1]);
      if (url.pathname === "/api/settings/default-farm") return handleDefaultFarm(request, env);
      if (url.pathname.startsWith("/api/")) return apiError(404, "NOT_FOUND", "FarmPulse API route not found");
      return new Response(landingPage, { headers: { "content-type": "text/html; charset=utf-8" } });
    } catch (error) {
      console.error("Unhandled request error", error);
      return apiError(500, "INTERNAL_ERROR", "FarmPulse could not complete this request");
    }
  },
};
