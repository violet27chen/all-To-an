# allToan

把多个机场订阅合并成一个新订阅。可以按协议筛选、单条复制、批量复制或下载 TXT。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fviolet27chen%2Fall-To-an&project-name=alltoan)

[使用方法](#使用方法) · [Vercel 部署](#vercel-部署) · [本地运行](#本地运行) · [支持的协议](#支持的协议)

## 使用方法

1. 在输入框粘贴订阅网址或节点链接，可以混贴，每行一个，订阅网址每次最多 8 个。也可粘贴 Base64 文本或 Clash 配置。
2. 点击「解析节点」。成功读取的订阅会合并，相同的节点链接会去重。读取失败的来源会按输入顺序标出。只有解析订阅网址时会展开节点明细。
3. 展开「按协议筛选」，勾选要保留的协议。复制和 TXT 下载会使用筛选后的结果。
4. 如需去掉个别节点，点击「选择要移除的节点」，勾选后点「移除所选节点」。可在本次解析中恢复。新生成的订阅会排除这些节点，之后刷新也会继续排除相同链接。

如果某个订阅网址读取失败，其他有效来源和独立节点仍可继续使用。支持部署环境可访问的公网 HTTP / HTTPS 订阅地址（80 或 443 端口）。

### 自定义请求头

将完整的订阅网址粘贴到主输入框，保留查询参数。展开「自定义请求头」，每行填写一个请求头，例如：

```http
User-Agent: my-client/1.0
Content-Language: zh-CN
X-Client-Encrypt: v1
```

选择这些请求头应用到第几个订阅网址，默认是第一个。计数时跳过独立节点链接和重复网址。只填写请求头即可，`Host` 由网址决定，跨域跳转时不会传递自定义请求头。响应仍需是项目支持的订阅格式。

#### VPNCheap 加密订阅

VPNCheap 的 `flag=sing-box` 订阅可用原网址和原客户端请求头抓取。若响应标记为加密，部署者需在 Vercel 的 Production 环境变量中设置 `VPNCHEAP_SUBSCRIPTION_SECRET`，值为官方 Windows 客户端元数据中的 `SubEncryptKey`，保存后重新部署。密钥只在服务器端用于解密。

默认只对已支持的 VPNCheap HTTPS 订阅域名解密。若服务商更换域名，部署者可将 `VPNCHEAP_SUBSCRIPTION_ORIGIN` 设置为新的 HTTPS 源（只填协议和域名，不含路径）。解密成功后，AnyTLS 和 Hysteria2 出站可正常解析和生成动态订阅。

### 生成新订阅

部署者[启用新订阅发布](#启用新订阅发布)后，任何访客都可以在结果下方点击「生成订阅链接」，再按客户端选择格式。新链接会应用当前筛选条件。

粘贴输入后，也可以直接点击「一键生成订阅」。页面会自动解析、去重并生成订阅地址，结果区只显示汇总和筛选。

| 客户端或格式 | 包含的节点 | 怎么导入 |
| --- | --- | --- |
| 通用 Base64 / v2rayN | 全部转换成功的节点链接 | 复制地址，在客户端的订阅管理中添加 |
| Clash Verge Rev / Mihomo | 可转换为 YAML 的节点，包括兼容的 Trojan | 点击「一键导入」，或复制地址手动添加 |
| 旧版 Clash | 兼容的 Shadowsocks、VMess 和 SOCKS5，自动跳过 Trojan、VLESS 等 | 客户端支持 `clash://` 时可一键导入，也可手动添加 |

两种 Clash 格式都会显示跳过数量。「一键导入」由系统注册的 `clash://` 客户端接管。

Clash YAML 的 `allToan` 组将「自动选择」放在首位，也可手动选节点。「自动选择」由客户端定期测速。

通过订阅网址生成的新地址支持动态刷新。每次客户端读取时，服务端会用保存的请求头重新抓取原订阅，合并混贴的独立节点，并应用筛选。如果任一原订阅读取失败，就返回生成时保存的快照。仅由独立节点或配置生成的订阅，以及本功能加入前生成的地址，继续使用快照。

可编辑链接中的 `protocols` 参数调整筛选，例如 `&protocols=vless,hy2`。协议名使用下方表格列出的链接前缀，省略 `://`。移除该参数可读取所有未手动移除且与客户端格式兼容的节点。

普通转换不保存输入或结果。生成动态订阅会将原网址、自定义请求头和节点快照保存在私有 Blob。**任何持有新地址的人都能读取订阅节点**，响应不会附带保存的原网址或请求头。如需撤销地址，删除 Blob 中对应的 `alltoan/subscriptions/<id>.json`。

## Vercel 部署

点击顶部 **Deploy with Vercel** 创建仓库副本并部署。已有仓库时，在 Vercel 选择 **Add New → Project** 导入，框架预设选 **Other**，根目录保持默认。也可在项目目录运行 `npx vercel login`，然后运行 `npx vercel deploy --prod`。

转换、复制和 TXT 下载在部署后即可使用。需要生成新的订阅地址时，再完成以下设置。

### 启用新订阅发布

1. 在 Vercel 项目的 **Storage** 中创建并连接 **Private Blob**。环境变量前缀保留 `BLOB`，勾选 **Add a read-write token env var to this connection**。[Vercel 私有 Blob 文档](https://vercel.com/docs/vercel-blob/private-storage)
2. 在 **Settings → Environment Variables** 确认 Production 有 `BLOB_READ_WRITE_TOKEN`。之前设置的 `SUBSCRIPTION_PUBLISH_KEY` 可以删除。
3. 重新部署。访客可以直接生成订阅。部署域名须允许访客和客户端直接访问。

## 本地运行

安装 Node.js 22，在终端运行：

```bash
git clone https://github.com/violet27chen/all-To-an.git
cd all-To-an
npm ci
npm run dev
```

打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。用 `npm test` 运行测试。

## 支持的协议

| 输入格式 | 支持范围 |
| --- | --- |
| 节点列表或 Base64 文本 | 保留原协议和参数。支持 `vless://`、`vmess://`、`trojan://`、`ss://`、`ssr://`、`hysteria://`、`hysteria2://`、`hy2://`、`tuic://`、`anytls://`、`socks://`、`socks5://`、`wireguard://`。 |
| Clash YAML / JSON | 读取 `proxies`，转换常见的 VLESS、VMess、Trojan、Shadowsocks、Hysteria2 和 TUIC 配置。部分客户端专属设置无法用分享链接表达。 |
| sing-box JSON | 读取 `outbounds`，转换带常规 TLS 设置的 AnyTLS 和 Hysteria2 出站。 |

转换结果不代表节点可连通。

## 开源许可证

本项目采用 [MIT 许可证](LICENSE)。内置的 js-yaml 同样采用 MIT 许可证，详见 [js-yaml 许可证](vendor/LICENSE.js-yaml)。
