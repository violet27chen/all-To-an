import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load } from '../vendor/yaml.mjs';
import { convert } from '../lib/convert.js';
import { buildProfiles } from '../lib/profiles.js';
import subscription from '../api/subscription.js';

const source = [
  'vless://00000000-0000-4000-8000-000000000000@edge.example:443?security=reality&sni=site.example&pbk=key&sid=001a&type=grpc&serviceName=proxy#same',
  'trojan://p%40ss@edge.example:443?security=tls#same',
  'ss://YWVzLTEyOC1nY206c2VjcmV0@edge.example:8388#DIRECT',
  'wireguard://example-config',
].join('\n');

test('subscription snapshots retain every link and filter each Clash profile independently', () => {
  const { universal, verge, clash } = buildProfiles(convert(source).nodes);
  assert.equal(Buffer.from(universal.body, 'base64').toString(), source);
  assert.equal(universal.skipped, 0);
  assert.equal(verge.skipped, 1);
  assert.equal(clash.skipped, 3);
  const modern = load(verge.body);
  assert.deepEqual(modern.proxies.map(proxy => proxy.type), ['vless', 'trojan', 'ss']);
  assert.deepEqual(modern.proxies[0]['reality-opts'], { 'public-key': 'key', 'short-id': '001a' });
  assert.equal(modern.proxies[0]['grpc-opts']['grpc-service-name'], 'proxy');
  assert.equal(modern.proxies[1].password, 'p@ss');
  assert.deepEqual(modern['proxy-groups'][0].proxies, ['same', 'same (2)', 'DIRECT (2)']);
  assert.deepEqual(load(clash.body).proxies.map(proxy => proxy.type), ['ss']);
});

test('unsupported configurations produce no YAML link and keep the original URI', () => {
  const link = 'vless://demo@edge.example:443?security=tls&type=xhttp';
  const result = buildProfiles(convert(link).nodes);
  assert.equal(result.verge.count, 0);
  assert.equal(result.verge.body, '');
  assert.equal(Buffer.from(result.universal.body, 'base64').toString(), link);
});

test('subscription endpoint rejects invalid IDs, formats and cross-site writes', async () => {
  const origin = 'https://alltoan.example/api/subscription';
  for (const query of ['?id=../secret', '?id=' + 'a'.repeat(32) + '&format=constructor']) {
    assert.equal((await subscription.fetch(new Request(origin + query))).status, 404);
  }
  const response = await subscription.fetch(new Request(origin, {
    method: 'POST',
    headers: { Origin: 'https://elsewhere.example' },
    body: source,
  }));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
