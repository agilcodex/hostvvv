import axios from "axios";
import crypto from "crypto";
import qs from "querystring";
import fs from "fs";
import { HttpsProxyAgent } from "https-proxy-agent";
import { loadProxies, getNextProxy } from "./proxyManager.js";

import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, "config.json");

const config = JSON.parse(await fsp.readFile(configPath, "utf8"));
const userName = config.email;
const password = config.password;

const versionName = "2.48.22";
const versionCode = "24822";
const lang = "en_US";
const client = "web";
const channelCode = "webgp";
const serverNode = "sgp1";

const secret = "2018red8688RendfingerSxxd";

// SESSION

function saveSession(data) {
  fs.writeFileSync("./sessions.json", JSON.stringify(data, null, 2));
  console.log("💾 Session saved.");
}

function loadSessionFile() {
  if (!fs.existsSync("./session.json")) return null;

  try {
    return JSON.parse(fs.readFileSync("./session.json"));
  } catch {
    return null;
  }
}

// ===============================
// UTILITY
// ===============================
function generateUUID(len = 50) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length: len },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

function md5(x) {
  return crypto.createHash("md5").update(x).digest("hex");
}

function formatPem(key) {
  const formatted = key.match(/.{1,64}/g).join("\n");
  return `-----BEGIN PUBLIC KEY-----\n${formatted}\n-----END PUBLIC KEY-----`;
}

function rsaEncrypt(rsaKey, password) {
  const pemKey = formatPem(rsaKey);

  const encTimestamp = (Date.now() + 2000).toString();

  const payload = {
    userPwd: password,
    timestamp: encTimestamp,
  };

  const json = JSON.stringify(payload);

  return {
    encrypted: crypto
      .publicEncrypt(
        {
          key: pemKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(json)
      )
      .toString("base64"),
  };
}

// API CLIENT PROXY

function createApi(proxy = null) {
  let agent = undefined;

  if (proxy) {
    agent = new HttpsProxyAgent(proxy);
    console.log("🌐 Using Proxy:", proxy);
  }

  return axios.create({
    baseURL: "https://twplay.redfinger.com",
    timeout: 15000,
    httpsAgent: agent,
    proxy: false,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Api-Version": versionCode,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
}

async function getKey(api, username, uuid, timestamp) {
  const signString = `channelCode=${channelCode}&client=${client}&lang=${lang}&timestamp=${timestamp}&userName=${username}&uuid=${uuid}`;
  const sign = md5(signString + secret);

  const body = {
    userName: username,
    timestamp,
    uuid,
    client,
    lang,
    channelCode,
    versionName,
    versionCode,
    sign,
  };

  const res = await api.post(
    "/osfingerlogin/user/getKey.html",
    qs.stringify(body)
  );

  return res.data;
}

async function loginRedfinger(
  api,
  { username, rsaPubKey, signKey, userId, uuid }
) {
  const fixedTimestamp = (Date.now() + 9000).toString();

  const signString = `channelCode=${channelCode}&client=${client}&lang=${lang}&timestamp=${fixedTimestamp}&userName=${username}&uuid=${uuid}`;
  const sign = md5(signString + secret);

  const hash1 = md5(`${userId}##${password}`);
  const token = md5(hash1 + signKey);
  const rsaPayload = {
    userPwd: password,
    timestamp: fixedTimestamp,
  };
  const encryptedPwd = rsaEncrypt(rsaPubKey, rsaPayload);

  const url =
    `/osfingerlogin/user/v2/getUser.html?lang=${lang}&client=${client}&uuid=${uuid}` +
    `&versionName=${versionName}&versionCode=${versionCode}` +
    `&channelCode=${channelCode}&serverNode=${serverNode}` +
    `&htjJsEnv=h5&htjApp=universe&sign=${sign}`;

  const body = {
    userName: username,
    token,
    deviceLockCode: "",
    externalCode: "",
    newUserPwd: encryptedPwd,
    rsaPubKeyMd5: md5(rsaPubKey),
  };

  const res = await api.post(url, qs.stringify(body));
  return res.data;
}

(async () => {
  loadProxies();
  const proxy = getNextProxy();
  const api = createApi(proxy);

  let sess = loadSessionFile();
  if (sess) {
    console.log("🔁 Loaded saved session:", sess);
  }

  const uuid = sess?.uuid || generateUUID();
  const timestamp = Date.now().toString();

  console.log("UUID:", uuid);
  console.log("[1] GET KEY...");

  const keyData = await getKey(api, userName, uuid, timestamp);
  console.log(JSON.stringify(keyData, null, 2));

  if (keyData.resultCode !== 0) {
    console.log("❌ Gagal getKey");
    return;
  }

  const { signKey, rsaPubKey, userId } = keyData.resultInfo;

  console.log("\n[2] LOGIN...");
  const loginRes = await loginRedfinger(api, {
    username: userName,
    rsaPubKey,
    signKey,
    userId,
    uuid,
  });

  console.log("\n[LOGIN RESULT]");
  console.log(JSON.stringify(loginRes, null, 2));

  saveSession({
    uuid,
    signKey,
    userId,
    sessionId: loginRes?.resultInfo?.session || null,
  });
})();
