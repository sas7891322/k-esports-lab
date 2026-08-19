import crypto from "node:crypto";

const COOKIE = "kel_admin_session";

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
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 7;
  const payload = String(expires);
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`;
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
  const [expires, signature] = token.split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return safeEqual(signature, sign(expires));
}
