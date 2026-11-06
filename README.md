# allToan

把多个机场订阅合并成一个新订阅。可以按协议筛选、单条复制、批量复制或下载 TXT。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fviolet27chen%2Fall-To-an&project-name=alltoan)

[使用方法](#使用方法) · [Vercel 部署](#vercel-部署) · [本地运行](#本地运行) · [支持的协议](#支持的协议)

## 使用方法

1. 在输入框粘贴订阅网址或节点链接，可以混贴，每行一个，订阅网址每次最多 8 个。也可粘贴 Base64 文本或 Clash 配置。
2. 点击「解析节点」。成功读取的订阅会合并，相同的节点链接会去重。读取失败的来源会按输入顺序标出。只有解析订阅网址时会展开节点明细。
3. 展开「按协议筛选」，勾选要保留的协议。复制和 TXT 下载会使用筛选后的结果。
4. 如需去掉个别节点，点击「选择要移除的节点」，勾选后点「移除所选节点」。可在本次解析中恢复。新生成的订阅不会保存手动移除的节点，已生成的地址仍读取原快照。

如果某个订阅网址读取失败，其他有效来源和独立节点仍可继续使用。支持部署环境可访问的公网 HTTP / HTTPS 订阅地址（80 或 443 端口）。

### 自定义请求头

将完整的订阅网址粘贴到主输入框，保留查询参数。展开「自定义请求头」，每行填写一个请求头，例如：

```http
User-Agent: my-client/1.0
Content-Language: zh-CN
X-Client-Encrypt: v1
```

选择这些请求头应用到第几个订阅网址，默认是第一个。计数时跳过独立节点链接和重复网址。只填写请求头即可，`Host` 由网址决定，跨域跳转时不会传递自定义请求头。响应仍需是项目支持的订阅格式。

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

新地址读取生成时保存的节点快照，不再访问原订阅。可编辑链接中的 `protocols` 参数调整筛选，例如 `&protocols=vless,hy2`。协议名使用下方表格列出的链接前缀，省略 `://`。移除该参数可恢复完整快照，客户端格式本身的兼容性过滤仍会生效。

只要部署域名和存储对象仍可用，地址就可以重复使用。原服务商停用节点或更换凭据后，需要重新转换并生成地址。

普通转换不保存输入或结果。生成订阅会将节点保存到私有 Blob，**任何持有新地址的人都能读取这些节点**。如需撤销地址，删除 Blob 中对应的 `alltoan/subscriptions/<id>.json`。

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

转换结果不代表节点可连通。

## 开源许可证

本项目采用 [MIT 许可证](LICENSE)。内置的 js-yaml 同样采用 MIT 许可证，详见 [js-yaml 许可证](vendor/LICENSE.js-yaml)。
