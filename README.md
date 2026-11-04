# allToan

把机场订阅拆成独立节点链接。可以单条复制、复制全部、下载 TXT，也可以把转换结果生成新的订阅地址。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fviolet27chen%2Fall-To-an&project-name=alltoan)

[使用方法](#使用方法) · [Vercel 部署](#vercel-部署) · [本地运行](#本地运行) · [支持的协议](#支持的协议)

## 使用方法

1. 粘贴「订阅网址」，或切换到「订阅内容」粘贴节点列表、Base64 文本或 Clash 配置。也可以先点「试用示例」。
2. 点击「转换节点」。相同的链接会自动合并。
3. 从结果中选择「复制」「复制全部」或「下载 TXT」。

如果订阅网址读取失败，可以下载订阅后粘贴原始内容。网址模式支持部署环境可访问的公网 HTTP / HTTPS 地址（80 或 443 端口）。

### 生成新订阅

部署者[启用新订阅发布](#启用新订阅发布)后，在结果下方输入发布密钥，点击「生成订阅链接」，再按客户端选择格式。

| 客户端或格式 | 包含的节点 | 怎么导入 |
| --- | --- | --- |
| 通用 Base64 / v2rayN | 全部转换成功的节点链接 | 复制地址，在客户端的订阅管理中添加 |
| Clash Verge Rev / Mihomo | 可转换为 YAML 的节点，包括兼容的 Trojan | 点击「一键导入」，或复制地址手动添加 |
| 旧版 Clash | 兼容的 Shadowsocks、VMess 和 SOCKS5，自动跳过 Trojan、VLESS 等 | 客户端支持 `clash://` 时可一键导入，也可手动添加 |

两种 Clash 格式都会显示跳过数量。「一键导入」由系统注册的 `clash://` 客户端接管。

新地址读取生成时保存的节点快照，不再访问原订阅。只要部署域名和存储对象仍可用，地址就可以重复使用。原服务商停用节点或更换凭据后，需要重新转换并生成地址。

普通转换不保存输入或结果。生成订阅会将节点保存到私有 Blob，**任何持有新地址的人都能读取这些节点**。如需撤销地址，删除 Blob 中对应的 `alltoan/subscriptions/<id>.json`。

## Vercel 部署

点击顶部 **Deploy with Vercel** 创建仓库副本并部署。已有仓库时，在 Vercel 选择 **Add New → Project** 导入，框架预设选 **Other**，根目录保持默认。也可在项目目录运行 `npx vercel login`，然后运行 `npx vercel deploy --prod`。

转换、复制和 TXT 下载在部署后即可使用。需要生成新的订阅地址时，再完成以下设置。

### 启用新订阅发布

1. 在 Vercel 项目的 **Storage** 中创建并连接 **Private Blob**。环境变量前缀保留 `BLOB`，勾选 **Add a read-write token env var to this connection**。[Vercel 私有 Blob 文档](https://vercel.com/docs/vercel-blob/private-storage)
2. 在 **Settings → Environment Variables** 确认 Production 有 `BLOB_READ_WRITE_TOKEN`，再新增 `SUBSCRIPTION_PUBLISH_KEY`。发布密钥可用随机 UUID v4，直接填写，无需引号。
3. 重新部署。网页上填写自己设置的发布密钥，客户端只需生成的订阅地址。客户端必须能直接访问部署域名，无法通过 Vercel 登录保护拉取订阅。

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
