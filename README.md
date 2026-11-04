# allToan

**All to an**：把一个机场订阅拆成可单独复制的节点链接。可逐条复制、一键复制全部（每行一条），或下载 TXT。

- 输入订阅网址，或直接粘贴原始内容。支持普通节点列表、Base64（含 URL-safe Base64）和 Clash YAML / JSON 的 `proxies`。
- 原始分享链接保留原协议；支持提取 VLESS、VMess、Trojan、Shadowsocks、SSR、Hysteria、Hysteria2、TUIC 等。Clash 转换支持常见 VLESS、VMess、Trojan、Shadowsocks、Hysteria2 和 TUIC 配置。部分客户端专属设置无法通过分享链接表达。
- 只读取订阅和生成链接，不检测节点能否连接。网址须是服务端可访问的公网 HTTP / HTTPS（80 / 443 端口）。遇到服务商限制，可粘贴原始订阅内容。
- 转换通过同站 POST 完成，应用不保存订阅或结果，也不把链接写进日志；只建议向信任的部署发送订阅。

## 本地运行

安装 Node.js 22，运行 `npm run dev`，打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。运行 `npm test` 可验证转换逻辑和接口。

## 部署到 Vercel

从此目录执行 `npx vercel login`，登录自己的账号，再执行 `npx vercel deploy --prod`。也可以在 Vercel 导入此仓库，Framework Preset 选 **Other**，保持仓库根目录和 `vercel.json` 的默认设置。无需配置环境变量。

`public/` 是静态页面，`api/convert.js` 是 Vercel Node.js Function。内置的 js-yaml 依赖及其许可证位于 `vendor/`。
