import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregate, MAX_SOURCES } from '../lib/aggregate.js';
import { parseProtocolFilter, protocols } from '../lib/convert.js';
import subscription from '../api/subscription.js';

test('aggregates mixed source formats in input order and isolates source failures', async () => {
  const first = 'trojan://demo@proxy.example:443#first';
  const second = 'ss://YWVzLTEyOC1nY206c2VjcmV0@edge.example:8388#second';
  const calls = [];
  const result = await aggregate('https://a.example\r\nhttps://bad.example\n\nhttps://b.example\nhttps://a.example', { load: async url => {
    calls.push(url);
    if (url.includes('bad')) throw new Error('无法读取');
    return url.includes('a.example') ? Buffer.from(first).toString('base64') : [first, second].join('\n');
  } });
  assert.deepEqual(calls, ['https://a.example', 'https://bad.example', 'https://b.example']);
  assert.deepEqual(result.nodes.map(node => node.link), [first, second]);
  assert.equal(result.duplicates, 1);
  assert.deepEqual(result.failedSources, [{ source: 2, message: '无法读取' }]);
});

test('oversized source lists are rejected before any network access', async () => {
  const input = Array.from({ length: MAX_SOURCES + 1 }, (_, i) => 'https://example.com/' + i).join('\n');
  await assert.rejects(aggregate(input, { load: () => assert.fail('Unexpected request') }), /最多/);
});

test('mixes subscriptions and individual nodes while preserving order and removing duplicates', async () => {
  const anytls = 'anytls://demo@edge.example:443#direct';
  const trojan = 'trojan://demo@edge.example:443#remote';
  const hysteria = 'hysteria2://demo@edge.example:443#last';
  const input = [anytls, 'https://feed.example/sub', hysteria, trojan].join('\n');
  const result = await aggregate(input, {
    includeNodes: true,
    async load(url) {
      assert.equal(url, 'https://feed.example/sub');
      return [trojan, anytls].join('\n');
    },
  });
  assert.deepEqual(result.nodes.map(node => node.link), [anytls, trojan, hysteria]);
  assert.equal(result.duplicates, 2);
  assert.equal(result.sourceCount, 1);
});

test('protocol filters accept the full converter allowlist and reject invalid URL parameters', async () => {
  assert.deepEqual([...parseProtocolFilter(protocols.join(',').toUpperCase())], protocols);
  assert.deepEqual([...parseProtocolFilter('VLESS,hy2,SOCKS5,wireguard,vless')], ['vless', 'hy2', 'socks5', 'wireguard']);
  const response = await subscription.fetch(new Request('https://example.com/api/subscription?protocols=vless,unknown'));
  assert.equal(response.status, 400);
});
