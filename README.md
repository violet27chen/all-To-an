# allToan

**All to an**：把一个机场订阅拆成可单独复制的节点链接。可逐条复制、一键复制全部（每行一条），或下载 TXT。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fviolet27chen%2Fall-To-an&project-name=alltoan)

## 使用方法

1. 在「订阅网址」中粘贴机场提供的链接，或切换到「订阅内容」粘贴原始文本。也可以点「试用示例」先体验。
2. 点击「转换节点」，结果区会列出节点名称、协议和分享链接。完全相同的链接会合并。
3. 点击某个节点旁的「复制」只复制该节点。点击「复制全部」会复制所有节点，每行一条。也可以点击「下载 TXT」保存结果。

订阅网址须是部署环境能访问的公网 HTTP / HTTPS 地址，端口为 80 或 443。如果服务商限制服务器访问，可从浏览器打开或下载订阅，再将内容粘贴到页面。转换结果不代表节点可连通。

订阅网址和节点可能包含令牌或密码。普通转换不保存输入或结果。只有点击「生成订阅链接」时，应用才会将当前节点保存到部署者的私有 Blob。

## 生成新订阅和一键导入

部署者完成下方存储设置后，转换节点，在「生成新订阅」填写发布密钥并点击「生成订阅链接」。同一次生成会提供以下格式。

| 格式 | 内容和导入方式 |
| --- | --- |
| 通用 Base64 / v2rayN | 保留全部转换成功的原始节点链接。复制订阅地址，在客户端的订阅管理中添加。客户端只会加载自己支持的协议。 |
| Clash Verge Rev / Mihomo | 生成 Clash YAML，保留可转换的 Trojan 等节点。可点击「一键导入」唤起已注册 `clash://` 的客户端，也可复制地址到客户端。 |
| 旧版 Clash 兼容 | 仅输出兼容配置中的 Shadowsocks、VMess 和 SOCKS5 节点，自动过滤 Trojan、VLESS 等节点。支持 `clash://` 的客户端可一键导入。 |

Clash 格式会显示跳过数量，避免将无法可靠转换的节点放进配置。两种 Clash 格式使用同一个系统协议处理程序，由系统决定唤起哪个客户端。

新地址读取当前节点的快照，不会访问原订阅，也没有应用设置的过期时间。保留部署域名和 Blob 对象即可重复订阅。原服务商停用节点或更换凭据后，需要重新转换并生成地址。持有新地址的人能读取节点，勿公开分享。若需撤销地址，在 Blob 存储中删除对应的 `alltoan/subscriptions/<id>.json`。

## 部署到 Vercel

**一键部署**：点击顶部的 **Deploy with Vercel**，登录 Vercel，按提示在自己的 GitHub 账号下创建仓库副本并部署。

**绑定现有仓库**：在 Vercel 选择 **Add New → Project**，从 GitHub 导入仓库。框架预设选 **Other**，根目录保持默认，部署设置由 `vercel.json` 提供。

也可以在项目目录运行 `npx vercel login` 和 `npx vercel deploy --prod`，通过命令行部署。

### 启用新订阅发布

普通转换、复制和下载无需额外配置。要启用新订阅发布：

1. 在 Vercel 项目的 **Storage** 中创建并连接 **Private Blob**，确认生产环境有 `BLOB_READ_WRITE_TOKEN`。如项目未自动添加，请从 Blob 的设置获取读写令牌并设为环境变量。[Vercel 私有 Blob 文档](https://vercel.com/docs/vercel-blob/private-storage)
2. 在项目环境变量中设置随机且不公开的 `SUBSCRIPTION_PUBLISH_KEY`。这是网页填写的发布密钥，用于限制谁能写入存储。客户端读取生成的订阅只需订阅地址。
3. 重新部署。用于订阅的域名必须能被客户端访问。如果部署有 Vercel 登录保护，客户端无法直接拉取订阅。

## 本地运行

安装 Node.js 22，然后运行：

```bash
git clone https://github.com/violet27chen/all-To-an.git
cd all-To-an
npm ci
npm run dev
```

打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。运行 `npm test` 可验证转换逻辑和接口。

`public/` 是静态页面，`api/convert.js` 是 Vercel Node.js Function。内置的 js-yaml 依赖及其许可证位于 `vendor/`。

## 支持的协议

| 输入格式 | 支持范围 |
| --- | --- |
| 节点列表或 Base64 文本 | 保留原协议和参数。支持 `vless://`、`vmess://`、`trojan://`、`ss://`、`ssr://`、`hysteria://`、`hysteria2://`、`hy2://`、`tuic://`、`anytls://`、`socks://`、`socks5://`、`wireguard://`。 |
| Clash YAML / JSON | 读取 `proxies`，转换常见的 VLESS、VMess、Trojan、Shadowsocks、Hysteria2 和 TUIC 配置。部分客户端专属设置无法用分享链接表达。 |

## 开源许可证

本项目采用 [MIT 许可证](LICENSE)。内置的 js-yaml 同样采用 MIT 许可证，详见 [js-yaml 许可证](vendor/LICENSE.js-yaml)。
