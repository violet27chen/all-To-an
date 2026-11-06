import { createDecipheriv, createHash } from 'node:crypto';

const defaultOrigin = 'https://invite.siusn-sisjxl.top';
const utf8 = new TextDecoder('utf-8', { fatal: true });
export const vpncheapOrigin = (env = process.env) => env.VPNCHEAP_SUBSCRIPTION_ORIGIN || defaultOrigin;

export function decodeEncryptedSubscription(body, url, requestHeaders, env = process.env) {
  const origin = vpncheapOrigin(env);
  if (url.protocol !== 'https:' || url.origin !== origin || requestHeaders['x-client-encrypt'] !== 'v1') {
    throw new Error('订阅返回了加密内容，请核对 VPNCheap 订阅来源和 X-Client-Encrypt 请求头。');
  }
  const secret = env.VPNCHEAP_SUBSCRIPTION_SECRET;
  if (!secret) throw new Error('订阅返回了 VPNCheap 加密内容，请在部署端配置 VPNCHEAP_SUBSCRIPTION_SECRET。');

  try {
    const encoded = body.replace(/\s/g, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error();
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length < 32 || bytes.length % 16 || bytes.toString('base64') !== encoded) throw new Error();
    const key = createHash('sha256').update(secret, 'utf8').digest();
    const decipher = createDecipheriv('aes-256-cbc', key, bytes.subarray(0, 16));
    return utf8.decode(Buffer.concat([decipher.update(bytes.subarray(16)), decipher.final()]));
  } catch {
    throw new Error('VPNCheap 订阅解密失败，请检查部署端密钥和客户端版本。');
  }
}
