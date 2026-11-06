import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { aggregate } from '../lib/aggregate.js';
import { parseRequestHeaders } from '../lib/request-headers.js';
import { readSubscription } from '../lib/subscription.js';

const target = 'https://feed.example/sub?flag=sing-box';
const node = 'trojan://demo@edge.example:443#sample';
const headerText = 'Host: feed.example\r\nUser-Agent: demo-windows/2.3.30\r\nContent-Language: zh-CN\r\nX-Client-Encrypt: v1';

test('custom headers are applied only to the selected unique subscription URL in mixed input', async () => {
  const first = 'https://other.example/sub';
  const calls = [];
  await aggregate([first, node, first, target].join('\n'), {
    includeNodes: true, headerText, headerSource: 2,
    async load(url, headers) {
      calls.push([url, headers && { ...headers }]);
      return node;
    },
  });
  assert.deepEqual(calls, [
    [first, undefined],
    [target, { 'user-agent': 'demo-windows/2.3.30', 'content-language': 'zh-CN', 'x-client-encrypt': 'v1' }],
  ]);
});

test('invalid or routing headers fail before fetch', async () => {
  for (const input of ['Host: different.example', 'Content-Length: 9', 'X-Forwarded-Host: other.example', 'X-Test: a\x00b', 'x-test: a\nX-Test: b']) {
    await assert.rejects(aggregate(target, { headerText: input, load: () => assert.fail('unexpected fetch') }));
  }
  await assert.rejects(aggregate(target, { headerText, headerSource: 2, load: () => assert.fail('unexpected fetch') }), /不存在/);
});

test('same-origin redirects retain custom headers and cross-origin redirects discard them', async () => {
  const headers = parseRequestHeaders(headerText + '\nAuthorization: Bearer sample', target);
  const redirects = ['/same-origin', 'https://other.example/sub', target];
  const requests = [];
  const result = await readSubscription(target, headers, {
    resolveAddress: async () => ({ address: '1.1.1.1', family: 4 }),
    async request(url, _address, _signal, sent) {
      requests.push([url.href, sent]);
      const location = redirects.shift();
      return Object.assign(Readable.from(location ? [] : [Buffer.from(node)]), {
        statusCode: location ? 302 : 200,
        headers: location ? { location } : { 'content-type': 'text/plain' },
      });
    },
  });
  assert.equal(result, node);
  assert.equal(requests[0][0], target);
  assert.equal(requests[0][1].authorization, 'Bearer sample');
  assert.equal(requests[1][1]['user-agent'], 'demo-windows/2.3.30');
  for (const [, sent] of requests.slice(2)) {
    assert.equal(sent.authorization, undefined);
    assert.equal(sent['x-client-encrypt'], undefined);
    assert.match(sent['user-agent'], /allToan/);
  }
});
