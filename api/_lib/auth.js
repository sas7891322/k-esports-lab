import crypto from "node:crypto";

const COOKIE = "kel_admin_session";
const SESSION_VERSION = "v2";

function secret() {
  return process.env.SESSION_SECRET || "";
}

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function authReady() {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET);
}

export function validPassword(password) {
  return authReady() && safeEqual(password || "", process.env.ADMIN_PASSWORD);
}

export function makeSessionCookie() {
  const expires = Date.now() + 1000 * 60 * 60 * 24;
  const payload = `${SESSION_VERSION}:${expires}`;
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function isAdmin(req) {
  if (!authReady()) return false;
  const cookie = req.headers.cookie || "";
  const pair = cookie.split(";").map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`));
  if (!pair) return false;
  const token = pair.slice(COOKIE.length + 1);
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !payload.startsWith(`${SESSION_VERSION}:`)) return false;
  const expires = payload.slice(SESSION_VERSION.length + 1);
  if (!expires || Number(expires) < Date.now()) return false;
  return safeEqual(signature, sign(payload));
}
