// Cloudflare Pages Function 共享助手：Web Push 发送（RFC 8030 + RFC 8291 aes128gcm）
// 供 add.js / update.js 等导入调用。基于 Web Crypto，兼容 Workers 运行时。
//
// 安全说明：私钥 VAPID_PRIVATE_KEY 必须放在 Pages 项目环境变量中（不硬编码）。
// 公钥可公开，写死在本文件。加密算法与 http_ece / web-push 库字节级一致。

export const VAPID_PUBLIC_KEY =
  "BDhZ-H242GSmFI8CL_L4PVhb1XE3cZSihy2sFM6R0jYi78rbBXosJX0_rkVDZ_MR_joag8RRUSt6hrRsEbEWZG4";
const VAPID_SUBJECT = "mailto:admin@fosu-schedule.dev";

const te = new TextEncoder();

// ---------- base64url 编解码 ----------
function b64url(buf) {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function concatBytes(...arrays) {
  const total = arrays.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

// ---------- HKDF (SHA-256) ----------
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
async function hkdfExtract(salt, ikm) { return hmac(salt, ikm); }
async function hkdfExpand(prk, info, len) {
  const blocks = [];
  let t = new Uint8Array(0);
  let counter = 0, total = 0;
  while (total < len) {
    counter++;
    t = await hmac(prk, concatBytes(t, info, Uint8Array.of(counter)));
    blocks.push(t);
    total += t.length;
  }
  return concatBytes(...blocks).slice(0, len);
}

// ---------- VAPID JWT（ES256 签名） ----------
export async function signVapidJwt(privateKeyB64, audience) {
  const pub = b64urlToBytes(VAPID_PUBLIC_KEY);
  const x = b64url(pub.slice(1, 33));
  const y = b64url(pub.slice(33, 65));
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d: privateKeyB64, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const header = { typ: "JWT", alg: "ES256" };
  const claims = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT };
  const input = b64url(te.encode(JSON.stringify(header))) + "." + b64url(te.encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(input));
  return input + "." + b64url(new Uint8Array(sig));
}

// ---------- RFC 8291 aes128gcm 加密 payload ----------
export async function encryptPayload(p256dhB64, authB64, plaintext) {
  const uaPub = b64urlToBytes(p256dhB64);   // 订阅者公钥 65 字节
  const authSec = b64urlToBytes(authB64);   // 订阅者 auth 密钥 16 字节
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 临时 ECDH 密钥对
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const ephPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));

  // 共享密钥
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));

  // secret = HKDF(authSecret, shared, "WebPush: info\0" || uaPub || ephPub, 32)
  const prk1 = await hkdfExtract(authSec, shared);
  const secret = await hkdfExpand(prk1, concatBytes(te.encode("WebPush: info\u0000"), uaPub, ephPub), 32);

  // key/nonce = HKDF-Expand(HKDF-Extract(salt, secret), info, len)
  const prk2 = await hkdfExtract(salt, secret);
  const key = await hkdfExpand(prk2, te.encode("Content-Encoding: aes128gcm\u0000"), 16);
  const nonce = await hkdfExpand(prk2, te.encode("Content-Encoding: nonce\u0000"), 12);

  // header = salt(16) || rs(4, 大端) || keyid_len(1) || keyid(ephPub 65)
  const rs = 4096;
  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, rs);
  const header = concatBytes(salt, rsBytes, Uint8Array.of(ephPub.length), ephPub);

  // 明文 = payload || 0x02（aes128gcm 末记录定界符，无填充时 last 记录为 0x02）
  const plaintext2 = concatBytes(te.encode(plaintext), Uint8Array.of(2));
  const aesKey = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext2));

  return concatBytes(header, ct);
}

// ---------- 发送一条 Web Push ----------
export async function sendPush(subscription, payloadObj, env) {
  if (!env || !env.VAPID_PRIVATE_KEY) {
    throw new Error("VAPID_PRIVATE_KEY 未配置");
  }
  const endpoint = subscription.endpoint;
  const audience = new URL(endpoint).origin;
  const jwt = await signVapidJwt(env.VAPID_PRIVATE_KEY, audience);
  const body = await encryptPayload(subscription.keys.p256dh, subscription.keys.auth, JSON.stringify(payloadObj));

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      TTL: "3600",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      Authorization: "vapid t=" + jwt + ", k=" + VAPID_PUBLIC_KEY,
    },
    body,
  });
  // 404/410 = 订阅已失效，可忽略（后续可清理）；其它非 2xx 打日志
  if (!resp.ok && resp.status !== 404 && resp.status !== 410) {
    console.warn("[push] 发送失败", endpoint, resp.status);
  }
  return resp.status;
}
