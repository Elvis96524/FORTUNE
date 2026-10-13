/* 今日运程 · Service Worker
 *
 * 缓存策略
 *  - 页面导航：网络优先（4 秒无响应则回退缓存）；完全离线时返回缓存的 index.html
 *  - 同源静态资源（图标、manifest、lunar.js 等）：stale-while-revalidate（先用缓存，后台更新）
 *  - 白名单 CDN（Tailwind、lunar-javascript、Google Fonts）：stale-while-revalidate，离线可用
 *
 * 更新
 *  - index.html 走网络优先，联网时总是最新；
 *  - 修改了 sw.js 本身（例如把 VERSION 加 1）后，页面会出现“发现新版本”提示，点击即切换，旧缓存在激活时清除。
 *
 * 所有路径均为相对路径，因此可部署在 GitHub Pages 的 /仓库名/ 子路径下。
 */
const VERSION = 'v1';
const STATIC_CACHE = `fz-static-${VERSION}`;
const RUNTIME_CACHE = `fz-runtime-${VERSION}`;

// 应用外壳（尽量全部缓存；个别失败不影响安装，页面的“安装检测”会提示缺哪个文件）
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.svg',
  './icons/favicon-32.png'
];
// 可选：本地 lunar.js（存在才缓存，不存在不影响安装）
const OPTIONAL = ['./lunar.js'];
// 首次安装时顺带缓存 CDN 资源，使“访问一次之后即可离线”（失败不影响安装）
const CDN_PRECACHE = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/lunar-javascript/lunar.js',
  'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap'
];
const CDN_HOSTS = new Set(['cdn.tailwindcss.com', 'cdn.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com']);
const NAV_TIMEOUT_MS = 4000;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const stat = await caches.open(STATIC_CACHE);
    // 逐个缓存：个别文件缺失（例如漏传了某个图标）只记录警告，不让整个 Service Worker 安装失败
    const res = await Promise.allSettled(CORE.map(u => stat.add(new Request(u, { cache: 'reload' }))));
    res.forEach((r, i) => { if (r.status === 'rejected') console.warn('[sw] 预缓存失败：', CORE[i], r.reason && r.reason.message); });
    await Promise.all(OPTIONAL.map(u => stat.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    const rt = await caches.open(RUNTIME_CACHE);
    await Promise.all(CDN_PRECACHE.map(async u => {
      try { const res = await fetch(new Request(u, { mode: 'no-cors' })); await rt.put(u, res); } catch (e) { /* 离线或被拦截：忽略 */ }
    }));
    // 不自动 skipWaiting：由页面在用户确认更新后发送 SKIP_WAITING，避免使用中途被替换
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, RUNTIME_CACHE]);
    for (const k of await caches.keys()) if (k.startsWith('fz-') && !keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') { event.respondWith(networkFirst(event, req)); return; }
  if (url.origin === self.location.origin) { event.respondWith(staleWhileRevalidate(event, req, STATIC_CACHE)); return; }
  if (CDN_HOSTS.has(url.hostname)) event.respondWith(staleWhileRevalidate(event, req, RUNTIME_CACHE));
  // 其他跨域请求不拦截，交给浏览器
});

// 重定向过的响应不能直接用于导航请求，重新包装一份
async function clean(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function networkFirst(event, req) {
  const cache = await caches.open(STATIC_CACHE);
  const net = fetch(req.url, { cache: 'no-cache' }).then(async res => {
    const r = await clean(res);
    if (r.ok) await cache.put(req, r.clone());
    return r;
  });
  event.waitUntil(net.catch(() => {}));            // 超时后让更新在后台继续完成
  try {
    return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NAV_TIMEOUT_MS))]);
  } catch (e) {
    const hit = (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html')) || (await cache.match('./'));
    if (hit) return hit;
    try { return await net; } catch (e2) {
      return new Response('当前处于离线状态，且尚无缓存。请联网后打开一次。', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }
}

async function staleWhileRevalidate(event, req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => {
    // opaque：跨域 no-cors 请求（脚本、样式）的响应，无法读取状态，但可以缓存与复用
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (hit) { event.waitUntil(net); return hit; }
  return (await net) || Response.error();
}
