export interface Env {
  APP_NAME: string;
  APP_VERSION: string;
  ENVIRONMENT: string;
}

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        app: env.APP_NAME || "FarmPulse",
        version: env.APP_VERSION || "0.1.0",
        environment: env.ENVIRONMENT || "development",
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return json(
        {
          ok: false,
          error: "NOT_FOUND",
          message: "FarmPulse API route not found",
        },
        { status: 404 },
      );
    }

    return new Response(
      `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#0f5132" />
  <title>FarmPulse</title>
  <style>
    :root { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #16231b; background: #f5f8f5; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { width: min(100%, 560px); background: white; border-radius: 24px; padding: 28px; box-shadow: 0 14px 45px rgba(20, 50, 30, .10); }
    .badge { display: inline-block; padding: 7px 11px; border-radius: 999px; background: #e5f4e9; font-weight: 700; font-size: 14px; }
    h1 { font-size: clamp(34px, 8vw, 52px); margin: 16px 0 6px; line-height: 1; }
    p { font-size: 18px; line-height: 1.55; color: #4d5e53; }
    .flow { margin-top: 24px; padding: 18px; border-radius: 18px; background: #f1f6f2; font-weight: 700; line-height: 1.8; }
  </style>
</head>
<body>
  <main>
    <span class="badge">Phase 0 — Foundation</span>
    <h1>FarmPulse</h1>
    <p>ผู้ช่วยวางแผนงานสวนจากสภาพอากาศ เปลี่ยนข้อมูลพยากรณ์ให้เป็นคำแนะนำที่ใช้ตัดสินใจทำงานในสวนได้จริง</p>
    <div class="flow">Weather → Farm Context → Rules → Recommendation → Planning → Farm Log</div>
  </main>
</body>
</html>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  },
};
