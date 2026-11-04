# allToan

**All to an**：把一个机场订阅拆成可单独复制的节点链接。可逐条复制、一键复制全部（每行一条），或下载 TXT。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fviolet27chen%2Fall-To-an&project-name=alltoan)

## 使用方法

1. 在「订阅网址」中粘贴机场提供的链接，或切换到「订阅内容」粘贴原始文本。也可以点「试用示例」先体验。
2. 点击「转换节点」，结果区会列出节点名称、协议和分享链接。完全相同的链接会合并。
3. 点击某个节点旁的「复制」只复制该节点。点击「复制全部」会复制所有节点，每行一条。也可以点击「下载 TXT」保存结果。

## 支持的协议

| 输入格式 | 支持范围 |
| --- | --- |
| 节点列表或 Base64 文本 | 保留原协议和参数。支持 `vless://`、`vmess://`、`trojan://`、`ss://`、`ssr://`、`hysteria://`、`hysteria2://`、`hy2://`、`tuic://`、`anytls://`、`socks://`、`socks5://`、`wireguard://`。 |
| Clash YAML / JSON | 读取 `proxies`，转换常见的 VLESS、VMess、Trojan、Shadowsocks、Hysteria2 和 TUIC 配置。部分客户端专属设置无法用分享链接表达。 |

订阅网址须是部署环境能访问的公网 HTTP / HTTPS 地址，端口为 80 或 443。如果服务商限制服务器访问，可从浏览器打开或下载订阅，再将内容粘贴到页面。转换结果不代表节点可连通。

订阅网址和节点可能包含令牌或密码。应用通过同站 POST 处理输入，不保存订阅或转换结果，也不把链接写进日志。请只向信任的部署提交订阅。

## 部署到 Vercel

**一键部署**：点击顶部的 **Deploy with Vercel**，登录 Vercel，按提示在自己的 GitHub 账号下创建仓库副本并部署。

**绑定现有仓库**：在 Vercel 选择 **Add New → Project**，从 GitHub 导入仓库。框架预设选 **Other**，根目录保持默认，部署设置由 `vercel.json` 提供。两种方式都无需配置环境变量。

也可以在项目目录运行 `npx vercel login` 和 `npx vercel deploy --prod`，通过命令行部署。

## 本地运行

安装 Node.js 22，然后运行：

```bash
git clone https://github.com/violet27chen/all-To-an.git
cd all-To-an
npm run dev
```

打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。运行 `npm test` 可验证转换逻辑和接口。

`public/` 是静态页面，`api/convert.js` 是 Vercel Node.js Function。内置的 js-yaml 依赖及其许可证位于 `vendor/`。
