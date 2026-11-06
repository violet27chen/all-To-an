import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareLiveSource, refreshLiveSource } from '../lib/live-subscription.js';

const first = 'https://one.example/sub';
const second = 'https://two.example/sub?flag=sing-box';
const direct = 'trojan://demo@edge.example:443#direct';
const removed = 'trojan://demo@edge.example:443#removed';

test('refresh reloads sources with scoped headers and continues excluding removed nodes', async () => {
  const source = prepareLiveSource({
    input: [first, direct, removed, second].join('\n'),
    headerText: 'Host: two.example\nUser-Agent: custom-client\nX-Client-Encrypt: v1',
    headerSource: 2, removed: [removed],
  });
  assert.ok(!JSON.stringify(source).includes(removed));
  const requests = [];
  const load = async (url, headers) => {
    requests.push([url, headers?.['user-agent'], headers?.['x-client-encrypt']]);
    return removed + '\ntrojan://demo@edge.example:443#' + requests.length;
  };
  const initial = await refreshLiveSource(source, load);
  const later = await refreshLiveSource(source, load);
  assert.deepEqual(requests, [
    [first, undefined, undefined], [second, 'custom-client', 'v1'],
    [first, undefined, undefined], [second, 'custom-client', 'v1'],
  ]);
  assert.deepEqual(initial.map(node => node.name), ['1', 'direct', '2']);
  assert.deepEqual(later.map(node => node.name), ['3', 'direct', '4']);
  assert.equal(await refreshLiveSource(source, async url => {
    if (url === second) throw new Error('offline');
    return direct;
  }), null);
});
