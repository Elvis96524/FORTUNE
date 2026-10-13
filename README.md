# 今日运程 · 八字测算

依生辰八字测算今日运势与一生运程，参黄历宜忌与姓名五格。纯静态页面，可作为 PWA 安装到手机或桌面。
仅供传统文化参考与娱乐。

## 文件结构

```
index.html          主页面（Tailwind + lunar-javascript，单文件）
manifest.json       PWA 清单
sw.js               Service Worker（离线缓存 + 更新提示）
lunar.js            （建议添加）lunar-javascript 本地副本，见下文
icons/              应用图标与 favicon
.nojekyll           让 GitHub Pages 跳过 Jekyll 处理
```

## 部署到 GitHub Pages

1. 新建仓库，把以上文件放在仓库根目录并推送到 `main`。
2. 仓库 **Settings → Pages → Build and deployment**：Source 选 *Deploy from a branch*，Branch 选 `main` / `/ (root)`，保存。
3. 约一分钟后访问 `https://<用户名>.github.io/<仓库名>/`。

所有路径都是相对路径，放在仓库子路径下可以直接使用。Service Worker 需要 https，GitHub Pages 默认满足。

## 建议：放一份本地的 lunar.js

页面默认从 jsDelivr 加载 `lunar-javascript`，失败后依次尝试 unpkg 和同目录的 `./lunar.js`。
为避免依赖外部 CDN，建议自己放一份：

```bash
npm i lunar-javascript
cp node_modules/lunar-javascript/lunar.js ./lunar.js
```

放好后 Service Worker 会自动把它预缓存，离线时也能用。

## 离线与更新

- 首次联网访问后，页面外壳、图标、`lunar.js` 以及 Tailwind、字体等 CDN 资源会被缓存，之后可离线使用。
- 页面（`index.html`）联网时总是取最新版本；离线时用缓存。
- 如果你改了 `sw.js`（例如把 `VERSION` 从 `v1` 改成 `v2`），已安装的用户会看到“发现新版本”，点“立即更新”后切换并清除旧缓存。
  改了 `index.html` 以外的静态文件（图标、`lunar.js`）时，也建议同时提升 `VERSION`。

## 本地预览

Service Worker 在 `file://` 下不工作，请用本地服务器：

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080/
```

## 安装为应用

页面顶部有一个始终可见的「下载安装 App」按钮（已作为 App 打开时自动隐藏）：

- Chrome / Edge / Android Chrome：点击后直接弹出系统安装框。
- iPhone / iPad（Safari）：iOS 不允许网页直接触发安装，点击后会弹出步骤：分享 → 添加到主屏幕 → 添加。
- Mac Safari、Firefox、其他浏览器：点击后按当前浏览器显示对应的安装方法（Firefox 桌面版不支持安装网页应用）。
- 用 `file://` 打开或非 https 网址：弹出提示，需要部署到 https（如 GitHub Pages）后才能安装。

## 姓名笔画说明

姓名五格使用《康熙字典》笔画（繁体字笔画）。页面内置了少量常见姓和字的预填值，仅供参考，请核对后再测算；其他字需要自行填写。
