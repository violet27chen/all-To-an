import { vpncheapOrigin } from './vpncheap-response.js';

const accountOrigin = 'https://cheaplogging.net';
const accountHeaders = {
  Accept: 'application/json', 'Content-Language': 'zh-CN', 'User-Agent': 'Mozilla/5.0',
  Referer: accountOrigin + '/',
};
const catalogHeaders = [
  'User-Agent: vpncheap-windows/2.3.30',
  'Content-Language: zh-CN',
  'X-Client-Encrypt: v1',
];
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";

export function vpncheapSource(input) {
  let url;
  try { url = new URL(input); }
  catch { throw new Error('请输入完整的 VPNCheap 订阅网址。'); }
  if (typeof input !== 'string' || input.length > 4096 || url.protocol !== 'https:' ||
      url.origin !== vpncheapOrigin() || url.username || url.password || url.hash) {
    throw new Error('订阅网址不属于已配置的 VPNCheap HTTPS 域名。');
  }
  const query = url.search.slice(1).split('&').filter(part =>
    part && !/^flag$/i.test(new URLSearchParams(part).keys().next().value));
  const address = url.origin + url.pathname + '?' + [...query, 'flag=sing-box'].join('&');
  return {
    input: address,
    headerText: catalogHeaders.join('\n'),
    headerSource: 1,
    curl: ['curl --request GET --url ' + quote(address), ...catalogHeaders.map(header => '--header ' + quote(header))].join(' '),
  };
}

async function readAccountJson(response) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('VPNCheap 账号响应超出限制。');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function lookupVpncheapSource(email, password, request = fetch) {
  const signal = AbortSignal.timeout(9000);
  const login = await request(accountOrigin + '/api/v1/passport/auth/login', {
    method: 'POST', headers: accountHeaders, body: new URLSearchParams({ email, password }),
    redirect: 'error', signal,
  });
  if (!login.ok) {
    await login.body?.cancel();
    throw new Error(login.status === 429 ? 'VPNCheap 登录请求过于频繁，请稍后重试。' : 'VPNCheap 登录失败，请检查邮箱和密码。');
  }
  const auth = (await readAccountJson(login)).data?.auth_data;
  if (typeof auth !== 'string' || !auth) throw new Error('VPNCheap 登录失败，请检查邮箱和密码。');
  const subscription = await request(accountOrigin + '/api/v1/user/getSubscribe?t=' + Date.now(), {
    headers: { ...accountHeaders, Authorization: auth }, redirect: 'error', signal,
  });
  if (!subscription.ok) {
    await subscription.body?.cancel();
    throw new Error('VPNCheap 未返回账号订阅，请在官方客户端检查。');
  }
  const url = (await readAccountJson(subscription)).data?.subscribe_url;
  if (typeof url !== 'string' || !url) throw new Error('VPNCheap 未返回账号订阅，请在官方客户端检查。');
  return vpncheapSource(url);
}
