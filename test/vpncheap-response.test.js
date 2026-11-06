import assert from 'node:assert/strict';
import { createCipheriv, createHash } from 'node:crypto';
import { test } from 'node:test';
import { convert } from '../lib/convert.js';
import { decodeEncryptedSubscription } from '../lib/vpncheap-response.js';

const origin = 'https://feed.example';
const env = { VPNCHEAP_SUBSCRIPTION_SECRET: 'synthetic-secret', VPNCHEAP_SUBSCRIPTION_ORIGIN: origin };
const headers = { 'x-client-encrypt': 'v1' };
const url = new URL('/subscription?flag=sing-box', origin);
const plain = JSON.stringify({ outbounds: [
  { type: 'selector', tag: 'Auto' },
  { type: 'anytls', tag: 'Sample', server: 'proxy.example', server_port: 443, password: 'demo@auth',
    tls: { enabled: true, insecure: false, server_name: 'tls.example', alpn: ['h2', 'http/1.1'] } },
  { type: 'hysteria2', tag: 'QUIC', server: 'quic.example', server_port: 8443, password: 'demo',
    tls: { enabled: true, insecure: true, server_name: 'quic.example' },
    obfs: { type: 'salamander', password: 'obfs demo' } },
] });

test('encrypted VPNCheap sing-box subscriptions produce AnyTLS and Hysteria2 share links', () => {
  const iv = Buffer.alloc(16, 7);
  const key = createHash('sha256').update(env.VPNCHEAP_SUBSCRIPTION_SECRET).digest();
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encoded = Buffer.concat([iv, cipher.update(plain), cipher.final()]).toString('base64');
  const result = convert(decodeEncryptedSubscription(encoded, url, headers, env));
  assert.deepEqual(result.nodes.map(node => node.protocol), ['anytls', 'hysteria2']);
  assert.equal(result.skipped, 0);
  const anytls = new URL(result.nodes[0].link);
  assert.equal(decodeURIComponent(anytls.username), 'demo@auth');
  assert.equal(anytls.searchParams.get('sni'), 'tls.example');
  assert.equal(anytls.searchParams.get('alpn'), 'h2,http/1.1');
  const hy2 = new URL(result.nodes[1].link);
  assert.equal(hy2.searchParams.get('insecure'), '1');
  assert.equal(hy2.searchParams.get('obfs-password'), 'obfs demo');
  assert.throws(() => decodeEncryptedSubscription(encoded, new URL('https://other.example'), headers, env), /来源/);
  assert.throws(() => decodeEncryptedSubscription(encoded, url, headers, { ...env, VPNCHEAP_SUBSCRIPTION_SECRET: '' }), /配置/);
  assert.throws(() => decodeEncryptedSubscription('bad', url, headers, env), /解密失败/);
});
