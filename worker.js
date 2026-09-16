export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/register" && request.method === "POST") {
      return register(request, env);
    }
    if (url.pathname === "/api/login" && request.method === "POST") {
      return login(request, env);
    }
    if (url.pathname === "/api/me" && request.method === "GET") {
      return me(request, env);
    }
    if (url.pathname === "/api/logout" && request.method === "POST") {
      return logout(request, env);
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("FastSMS", { status: 200 });
  }
};

function json(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {"content-type":"application/json; charset=UTF-8", ...headers}
  });
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,"0")).join("");
}

async function register(request, env) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!name || !email || password.length < 6)
      return json({error:"Name, valid email and password of at least 6 characters are required."},400);

    const existing = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if (existing) return json({error:"An account with this email already exists."},409);

    const password_hash = await sha256(password);
    const id = crypto.randomUUID();

    await env.DB.prepare(
      "INSERT INTO users (id,name,email,password_hash,ngn_balance,usd_balance,created_at) VALUES (?,?,?,?,0,0,datetime('now'))"
    ).bind(id,name,email,password_hash).run();

    const token = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,datetime('now'))"
    ).bind(token,id).run();

    return json({ok:true,user:{id,name,email,ngn_balance:0,usd_balance:0}},200,{
      "Set-Cookie": cookie("session",token)
    });
  } catch(e) {
    return json({error:"Registration failed."},500);
  }
}

async function login(request, env) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const password_hash = await sha256(password);

    const user = await env.DB.prepare(
      "SELECT id,name,email,ngn_balance,usd_balance FROM users WHERE email=? AND password_hash=?"
    ).bind(email,password_hash).first();

    if (!user) return json({error:"Invalid email or password."},401);

    const token = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,datetime('now'))"
    ).bind(token,user.id).run();

    return json({ok:true,user},{
      "Set-Cookie": cookie("session",token)
    });
  } catch(e) {
    return json({error:"Login failed."},500);
  }
}

async function me(request, env) {
  const token = getCookie(request,"session");
  if (!token) return json({error:"Not logged in."},401);

  const user = await env.DB.prepare(
    "SELECT u.id,u.name,u.email,u.ngn_balance,u.usd_balance FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=?"
  ).bind(token).first();

  if (!user) return json({error:"Not logged in."},401);
  return json({ok:true,user});
}

async function logout(request, env) {
  const token = getCookie(request,"session");
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token=?").bind(token).run();
  return json({ok:true},{ "Set-Cookie": "session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax" });
}

function getCookie(request,name) {
  const header=request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k,...v]=part.trim().split("=");
    if (k===name) return v.join("=");
  }
  return null;
}
function cookie(name,value) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
