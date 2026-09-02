export interface AuthEnv {
  DB: D1Database;
}

export interface SessionUser {
  id: string;
  username: string;
  display_name: string;
  role: "OWNER";
}

interface UserAuthRow extends SessionUser {
  pin_salt: string;
  pin_hash: string;
  pin_iterations: number;
}

const SESSION_COOKIE = "fp_session";
const SESSION_DAYS = 30;
const PIN_ITERATIONS = 120_000;
const encoder = new TextEncoder();

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...init.headers },
  });

const bytesToBase64Url = (bytes: Uint8Array) => {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlToBytes = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
};

const sha256 = async (value: string) =>
  bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));

const hashPin = async (pin: string, salt: Uint8Array, iterations: number) => {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    256,
  );
  return bytesToBase64Url(new Uint8Array(bits));
};

const safeEqual = (left: string, right: string) => {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
};

const parseCookies = (request: Request) => {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0) result.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  return result;
};

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

const normalizeUsername = (value: unknown) =>
  typeof value === "string" ? value.trim().toLocaleLowerCase("th-TH") : "";

const validUsername = (value: string) =>
  value.length >= 3 && value.length <= 40 && /^[\p{L}\p{N}._-]+$/u.test(value);

const validPin = (value: unknown): value is string =>
  typeof value === "string" && /^\d{6}$/.test(value);

const validDisplayName = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length >= 2 && value.trim().length <= 80;

export const sameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
};

export async function getSessionUser(request: Request, env: AuthEnv): Promise<SessionUser | null> {
  const rawToken = parseCookies(request).get(SESSION_COOKIE);
  if (!rawToken || rawToken.length < 30) return null;
  const tokenHash = await sha256(rawToken);
  const now = new Date().toISOString();
  return env.DB.prepare(
    `SELECT u.id, u.username, u.display_name, u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?1 AND s.expires_at > ?2 AND u.is_active = 1`,
  ).bind(tokenHash, now).first<SessionUser>();
}

async function createSession(userId: string, env: AuthEnv) {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?1, ?2, ?3)",
  ).bind(tokenHash, userId, expiresAt).run();
  return {
    token,
    cookie: `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`,
  };
}

async function attemptKey(request: Request, username: string) {
  const address = request.headers.get("CF-Connecting-IP") || "unknown";
  return sha256(`${address}:${username}`);
}

async function loginIsLimited(request: Request, env: AuthEnv, username: string) {
  const key = await attemptKey(request, username);
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const result = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM auth_attempts WHERE attempt_key = ?1 AND success = 0 AND attempted_at > ?2",
  ).bind(key, since).first<{ count: number }>();
  return { key, limited: (result?.count ?? 0) >= 5 };
}

async function recordAttempt(env: AuthEnv, key: string, success: boolean) {
  await env.DB.prepare(
    "INSERT INTO auth_attempts (attempt_key, success) VALUES (?1, ?2)",
  ).bind(key, success ? 1 : 0).run();
}

export async function handleAuth(request: Request, env: AuthEnv, pathname: string): Promise<Response> {
  if (pathname === "/api/auth/status" && request.method === "GET") {
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
    const user = await getSessionUser(request, env);
    return json({
      ok: true,
      setup_required: (count?.count ?? 0) === 0,
      authenticated: Boolean(user),
      user,
    });
  }

  if (!sameOrigin(request)) {
    return json({ ok: false, error: "INVALID_ORIGIN", message: "คำขอนี้ไม่ได้มาจาก FarmPulse" }, { status: 403 });
  }

  if (pathname === "/api/auth/setup" && request.method === "POST") {
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
    if ((count?.count ?? 0) > 0) {
      return json({ ok: false, error: "SETUP_CLOSED", message: "ตั้งค่าเจ้าของระบบแล้ว" }, { status: 409 });
    }

    const body = await bodyAsObject(request);
    const username = normalizeUsername(body?.username);
    const pin = body?.pin;
    const displayName = body?.display_name;
    if (!validUsername(username) || !validPin(pin) || !validDisplayName(displayName)) {
      return json({
        ok: false,
        error: "VALIDATION_ERROR",
        message: "กรอกชื่อ ชื่อผู้ใช้ และ PIN 6 หลักให้ถูกต้อง",
      }, { status: 422 });
    }

    const userId = crypto.randomUUID();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const pinHash = await hashPin(pin, salt, PIN_ITERATIONS);
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO users (id, username, display_name, pin_salt, pin_hash, pin_iterations)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
        ).bind(userId, username, displayName.trim(), bytesToBase64Url(salt), pinHash, PIN_ITERATIONS),
        env.DB.prepare(
          "UPDATE farms SET owner_user_id = ?1 WHERE owner_user_id IS NULL",
        ).bind(userId),
      ]);
    } catch {
      return json({ ok: false, error: "SETUP_FAILED", message: "ตั้งค่าบัญชีไม่สำเร็จ กรุณาลองใหม่" }, { status: 409 });
    }

    const firstFarm = await env.DB.prepare(
      "SELECT id FROM farms WHERE owner_user_id = ?1 AND is_active = 1 ORDER BY created_at LIMIT 1",
    ).bind(userId).first<{ id: string }>();
    if (firstFarm) {
      await env.DB.prepare(
        "INSERT INTO user_settings (user_id, key, value) VALUES (?1, 'default_farm_id', ?2)",
      ).bind(userId, firstFarm.id).run();
    }

    const session = await createSession(userId, env);
    return json(
      { ok: true, user: { id: userId, username, display_name: displayName.trim(), role: "OWNER" } },
      { status: 201, headers: { "set-cookie": session.cookie } },
    );
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    const body = await bodyAsObject(request);
    const username = normalizeUsername(body?.username);
    const pin = body?.pin;
    if (!validUsername(username) || !validPin(pin)) {
      return json({ ok: false, error: "INVALID_LOGIN", message: "ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง" }, { status: 401 });
    }

    const rate = await loginIsLimited(request, env, username);
    if (rate.limited) {
      return json({ ok: false, error: "TOO_MANY_ATTEMPTS", message: "ลองผิดหลายครั้ง กรุณารอ 15 นาที" }, { status: 429 });
    }

    const user = await env.DB.prepare(
      `SELECT id, username, display_name, role, pin_salt, pin_hash, pin_iterations
       FROM users WHERE username = ?1 AND is_active = 1`,
    ).bind(username).first<UserAuthRow>();
    const candidate = user && validPin(pin)
      ? await hashPin(pin, base64UrlToBytes(user.pin_salt), user.pin_iterations)
      : "";
    const valid = Boolean(user && safeEqual(candidate, user.pin_hash));
    await recordAttempt(env, rate.key, valid);
    if (!valid || !user) {
      return json({ ok: false, error: "INVALID_LOGIN", message: "ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง" }, { status: 401 });
    }

    await env.DB.prepare(
      "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?1",
    ).bind(user.id).run();
    const session = await createSession(user.id, env);
    return json(
      { ok: true, user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role } },
      { headers: { "set-cookie": session.cookie } },
    );
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    const rawToken = parseCookies(request).get(SESSION_COOKIE);
    if (rawToken) {
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(await sha256(rawToken)).run();
    }
    return json(
      { ok: true },
      { headers: { "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` } },
    );
  }

  return json({ ok: false, error: "NOT_FOUND", message: "ไม่พบเส้นทางบัญชีผู้ใช้" }, { status: 404 });
}

export const authPage = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#14532d"><title>เข้าสู่ FarmPulse</title>
<style>
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17251c;background:#eef5ef}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(145deg,#0f4b29,#218447);display:grid;place-items:center;padding:18px}.card{width:min(100%,460px);background:white;border-radius:28px;padding:26px;box-shadow:0 25px 70px #06251466}.brand{display:flex;align-items:center;gap:13px}.logo{width:56px;height:56px;border-radius:18px;background:#facc15;display:grid;place-items:center;font-size:30px}h1{font-size:29px;margin:0}p{color:#5a6a60;line-height:1.55}.mode{display:inline-block;background:#e7f5eb;color:#166534;border-radius:999px;padding:7px 10px;font-weight:800;font-size:13px;margin:18px 0 4px}.field{margin-top:15px}label{font-weight:800;font-size:14px;display:block;margin-bottom:7px}input{width:100%;padding:14px;border:1px solid #cbd9ce;border-radius:13px;font-size:18px}input:focus{outline:3px solid #bbf7d0;border-color:#22c55e}button{width:100%;border:0;border-radius:14px;padding:15px;background:#166534;color:white;font:inherit;font-weight:900;margin-top:20px;cursor:pointer}.hint{font-size:13px;color:#68776d}.notice{display:none;padding:12px;border-radius:13px;margin-top:14px;font-weight:700}.notice.show{display:block}.error{background:#fee2e2;color:#991b1b}.loading{text-align:center;padding:30px;color:#607066}
</style></head><body><main class="card"><div class="brand"><div class="logo">🌱</div><div><h1>FarmPulse</h1><div>ข้อมูลสวนของคุณ ปลอดภัยขึ้น</div></div></div><div id="content" class="loading">กำลังตรวจสอบบัญชี…</div></main>
<script>
(async function(){
var root=document.getElementById("content");
function esc(v){return String(v||"").replace(/[&<>"']/g,function(s){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[s]})}
function draw(setup){
root.className="";
root.innerHTML='<span class="mode">'+(setup?'ตั้งค่าเจ้าของครั้งแรก':'เข้าสู่ระบบ')+'</span><p>'+(setup?'สร้างบัญชีเจ้าของเพื่อป้องกันข้อมูลสวน หลังจากนี้บุคคลอื่นจะเปิดดูหรือแก้ไขไม่ได้':'กรอกชื่อผู้ใช้และ PIN ของเจ้าของสวน')+'</p><form id="authForm">'+(setup?'<div class="field"><label>ชื่อที่แสดง</label><input name="display_name" maxlength="80" autocomplete="name" placeholder="เช่น คุณนิพนธ์" required></div>':'')+'<div class="field"><label>ชื่อผู้ใช้</label><input name="username" minlength="3" maxlength="40" autocapitalize="none" autocomplete="username" placeholder="เช่น niphon" required></div><div class="field"><label>PIN 6 หลัก</label><input name="pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="'+(setup?'new-password':'current-password')+'" placeholder="••••••" required></div><div class="hint">ใช้ตัวเลขที่คุณจำได้ แต่ไม่ควรใช้ 123456</div><div id="notice" class="notice"></div><button type="submit">'+(setup?'สร้างบัญชีและเข้าสู่ระบบ':'เข้าสู่ FarmPulse')+'</button></form>';
document.getElementById("authForm").onsubmit=async function(e){e.preventDefault();var form=e.target,button=form.querySelector("button"),notice=document.getElementById("notice"),data=Object.fromEntries(new FormData(form));button.disabled=true;button.textContent="กำลังดำเนินการ…";try{var response=await fetch(setup?"/api/auth/setup":"/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});var result=await response.json();if(!response.ok)throw new Error(result.message||"ดำเนินการไม่สำเร็จ");location.replace("/")}catch(error){notice.textContent=esc(error.message);notice.className="notice show error";button.disabled=false;button.textContent=setup?"สร้างบัญชีและเข้าสู่ระบบ":"เข้าสู่ FarmPulse"}};
}
try{var response=await fetch("/api/auth/status");var status=await response.json();if(status.authenticated){location.replace("/");return}draw(status.setup_required)}catch(error){root.className="notice show error";root.textContent="เชื่อมต่อระบบบัญชีไม่ได้ กรุณาเปิดใหม่อีกครั้ง"}
})();
</script></body></html>`;
