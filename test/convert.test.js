import assert from 'node:assert/strict';
import { test } from 'node:test';
import endpoint from '../api/convert.js';
import { convert } from '../lib/convert.js';
import { isPublic } from '../lib/subscription.js';

const vless = 'vless://00000000-0000-4000-8000-000000000000@host.example:443?security=reality&pbk=demo#%E9%A6%99%E6%B8%AF';
const trojan = 'trojan://demo@host.example:443#DE';

test('URL-safe Base64 preserves node data and Unicode and deduplicates in order', () => {
  const sub = Buffer.from([vless, trojan, vless].join('\r\n')).toString('base64url');
  assert.deepEqual(convert(sub), { nodes: [
    { protocol: 'vless', name: '香港', link: vless },
    { protocol: 'trojan', name: 'DE', link: trojan },
  ], skipped: 0, duplicates: 1 });
});

test('Clash YAML carries Reality and transport settings, and reports unsupported nodes', () => {
  const source = `proxies:
  - name: 日本节点
    type: vless
    uuid: 00000000-0000-4000-8000-000000000000
    server: 2606:4700::1111
    port: 443
    network: grpc
    flow: xtls-rprx-vision
    servername: edge.example
    reality-opts: {public-key: demo, short-id: 001a}
    grpc-opts: {grpc-service-name: "test svc"}
  - {name: direct, type: direct}
proxy-groups: []`;
  const { nodes: [node], skipped } = convert(source);
  const url = new URL(node.link);
  assert.equal(node.name, '日本节点');
  assert.equal(url.hostname, '[2606:4700::1111]');
  assert.equal(url.searchParams.get('security'), 'reality');
  assert.equal(url.searchParams.get('serviceName'), 'test svc');
  assert.equal(url.searchParams.get('sid'), '001a');
  assert.equal(skipped, 1);
});

test('Clash JSON produces VMess and Shadowsocks share links', () => {
  const { nodes } = convert(JSON.stringify({ proxies: [
    { type: 'vmess', uuid: 'demo', name: '例子', port: 443, server: 'edge.example', tls: true },
    { type: 'ss', name: 'SS', port: 443, server: 'edge.example', cipher: 'aes-128-gcm', password: 'secret' },
  ] }));
  const data = JSON.parse(Buffer.from(nodes[0].link.slice(8), 'base64').toString('utf8'));
  assert.equal(data.ps, '例子');
  assert.equal(data.tls, 'tls');
  assert.match(nodes[1].link, /^ss:\/\/[\w-]+@edge\.example:443#SS$/);
});

const send = (body, origin) => endpoint.fetch(new Request('https://alltoan.example/api/convert', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { origin } : {}) },
  body: JSON.stringify(body),
}));

test('API returns uncached results and rejects cross-origin requests', async () => {
  const response = await send({ mode: 'text', input: vless }, 'https://alltoan.example');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).nodes[0].link, vless);
  assert.equal((await send({ mode: 'text', input: vless }, 'https://elsewhere.example')).status, 403);
});

test('URL mode blocks private and disguised loopback targets', async () => {
  for (const host of ['localhost', '2130706433', '0x7f000001', '169.254.169.254', '[::ffff:127.0.0.1]', '[fe80::1]']) {
    const response = await send({ mode: 'url', input: 'http://' + host + '/' });
    assert.equal(response.status, 422);
    assert.match((await response.json()).error, /公网/);
  }
  assert.equal(isPublic('1.1.1.1'), true);
  assert.equal(isPublic('2606:4700::1111'), true);
  assert.equal(isPublic('100.100.100.200'), false);
});
