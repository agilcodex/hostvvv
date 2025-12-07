import fs from "fs";

let proxies = [];
let index = 0;

export function loadProxies(file = "proxyList.txt") {
  if (!fs.existsSync(file)) {
    console.log("⚠️ proxyList.txt tidak ditemukan.");
    return;
  }

  const rawLines = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  proxies = rawLines.map((line) => {
    // Format Proxy
    // ip:port:user:pass
    // ip:port|user|pass|http
    // ip:port
    // user:pass@ip:port
    // http://user:pass@ip:port

    if (line.startsWith("http://") || line.startsWith("https://")) {
      return line;
    }

    let parts = line.includes("|") ? line.split("|") : line.split(":");

    parts = parts.map((p) => p.trim()).filter(Boolean);

    let ip = parts[0];
    let port = parts[1];
    let user = parts[2] || null;
    let pass = parts[3] || null;

    if (!port) {
      console.log("❌ Format proxy salah:", line);
      return null;
    }

    if (!user || !pass) {
      return `http://${ip}:${port}`;
    }

    return `http://${user}:${pass}@${ip}:${port}`;
  });

  proxies = proxies.filter(Boolean);

  console.log(`✔ Loaded ${proxies.length} proxies`);
}

export function getNextProxy() {
  if (proxies.length === 0) return null;

  const proxy = proxies[index];
  index = (index + 1) % proxies.length;
  return proxy;
}
