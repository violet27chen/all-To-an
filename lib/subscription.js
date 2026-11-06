import { lookup } from 'node:dns/promises';
import { request as http } from 'node:http';
import { request as https } from 'node:https';
import { isIP } from 'node:net';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import { decodeEncryptedSubscription } from './vpncheap-response.js';

export const LIMIT = 1024 * 1024;
const localAddress = new Error('仅支持公网 HTTP / HTTPS 订阅地址。');

export function isPublic(ip) {
  if (isIP(ip) === 4) {
    const [a,b,c] = ip.split('.').map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (isIP(ip) === 6 && !ip.includes('%')) {
    const [a, b = '0'] = new URL('http://[' + ip + ']').hostname.slice(1, -1).split(':');
    const first = parseInt(a, 16), second = parseInt(b || '0', 16);
    return first >= 0x2000 && first < 0x4000 && first !== 0x2002 && first !== 0x3fff &&
      !(first === 0x2001 && (second < 0x200 || second === 0xdb8));
  }
  return false;
}

async function resolve(host, signal) {
  const ip = host.replace(/^\[|\]$/g, '');
  if (isIP(ip)) {
    if (!isPublic(ip)) throw localAddress;
    return { address: ip, family: isIP(ip) };
  }
  if (!host.includes('.') || /(?:^|\.)(?:localhost|local|internal|test|invalid|home\.arpa)\.?$/i.test(host)) throw localAddress;
  const addresses = await new Promise((done, fail) => {
    const abort = () => fail(signal.reason);
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    lookup(host, { all: true }).then(done, fail).finally(() => signal.removeEventListener('abort', abort));
  });
  if (!addresses.length || addresses.some(({ address }) => !isPublic(address))) throw localAddress;
  return addresses.find(({ family }) => family === 4) || addresses[0];
}

function get(url, address, signal, headers) {
  return new Promise((done, fail) => {
    const req = (url.protocol === 'https:' ? https : http)(url, {
      agent: false, signal, family: address.family,
      lookup: (_host, options, cb) => options.all
        ? cb(null, [address]) : cb(null, address.address, address.family),
      headers,
    }, done);
    req.on('error', fail);
    req.end();
  });
}

const defaultHeaders = {
  'user-agent': 'ClashMeta/1.18.0 (allToan)',
  accept: 'text/plain, application/yaml, application/octet-stream, */*',
  'accept-encoding': 'gzip, deflate, br',
};

export async function readSubscription(input, customHeaders, { resolveAddress = resolve, request = get } = {}) {
  const signal = AbortSignal.timeout(8500);
  let url;
  try { url = new URL(input); } catch { throw new Error('请输入完整的 HTTP / HTTPS 订阅网址。'); }
  for (let hops = 0; hops <= 4; hops++) {
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        (url.port && url.port !== '80' && url.port !== '443')) throw localAddress;
    const address = await resolveAddress(url.hostname, signal);
    const headers = { ...defaultHeaders, ...customHeaders };
    const res = await request(url, address, signal, headers);
    if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
      res.destroy();
      let next;
      try { next = new URL(res.headers.location, url); } catch { throw new Error('订阅服务返回了无效的跳转地址。'); }
      if (url.protocol === 'https:' && next.protocol !== 'https:') throw new Error('订阅服务尝试跳转到不加密的网址。');
      if (next.origin !== url.origin) customHeaders = undefined;
      url = next;
      continue;
    }
    if (res.statusCode !== 200 || /\btext\/html\b/i.test(res.headers['content-type'] || '')) {
      res.destroy();
      throw new Error(res.statusCode === 200 ? '订阅服务返回了网页，请检查链接或直接粘贴订阅内容。'
        : '订阅服务返回 HTTP ' + res.statusCode + '，请检查链接是否有效。');
    }
    const encoding = res.headers['content-encoding'];
    const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'deflate' ? createInflate()
      : encoding === 'br' ? createBrotliDecompress() : null;
    if (decoder) res.on('error', error => decoder.destroy(error));
    const stream = decoder ? res.pipe(decoder) : res;
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of stream) {
        size += chunk.length;
        if (size > LIMIT) throw new Error('订阅内容超过 1 MB，请分批粘贴转换。');
        chunks.push(chunk);
      }
    } finally {
      res.destroy();
    }
    const body = Buffer.concat(chunks).toString('utf8');
    return res.headers['x-encrypted'] === '1' ? decodeEncryptedSubscription(body, url, headers) : body;
  }
  throw new Error('订阅网址跳转次数过多。');
}
