import assert from 'node:assert/strict';
import { test } from 'node:test';
import api from '../api/vpncheap.js';
import { lookupVpncheapSource, vpncheapSource } from '../lib/vpncheap.js';
import { vpncheapOrigin } from '../lib/vpncheap-response.js';

test('VPNCheap URL preserves the original query encoding and sets the client format', () => {
  const url = vpncheapOrigin() + '/sub?token=a%20b&FLAG=old&flag=again';
  const source = vpncheapSource(url);
  assert.equal(source.input, vpncheapOrigin() + '/sub?token=a%20b&flag=sing-box');
  assert.match(source.headerText, /X-Client-Encrypt: v1/);
  assert.ok(source.curl.includes(source.input));
  assert.throws(() => vpncheapSource('https://other.example/sub'), /域名/);
});

test('account lookup keeps credentials on the fixed VPNCheap endpoint and only returns source settings', async () => {
  const calls = [];
  const source = await lookupVpncheapSource('demo@example.com', 'sample-password', async (url, options) => {
    calls.push([new URL(url), options]);
    return calls.length === 1
      ? Response.json({ data: { auth_data: 'sample-token' } })
      : Response.json({ data: { subscribe_url: vpncheapOrigin() + '/sub' } });
  });
  const [login, read] = calls;
  assert.equal(login[0].href, 'https://cheaplogging.net/api/v1/passport/auth/login');
  assert.equal(login[1].body.get('password'), 'sample-password');
  assert.equal(read[0].pathname, '/api/v1/user/getSubscribe');
  assert.equal(read[0].origin, login[0].origin);
  assert.equal(read[1].headers.Authorization, 'sample-token');
  assert.equal(login[1].redirect, 'error');
  assert.equal(read[1].redirect, 'error');
  assert.ok(!JSON.stringify(source).includes('sample-password'));
  assert.ok(!JSON.stringify(source).includes('sample-token'));
});

test('the VPNCheap endpoint accepts a same-origin URL and rejects cross-site requests', async () => {
  const origin = 'https://alltoan.example';
  const submit = site => api.fetch(new Request(origin + '/api/vpncheap', {
    method: 'POST',
    headers: { origin: site, 'content-type': 'application/json' },
    body: JSON.stringify({ url: vpncheapOrigin() + '/sub' }),
  }));
  const response = await submit(origin);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match((await response.json()).input, /flag=sing-box$/);
  assert.equal((await submit('https://elsewhere.example')).status, 403);
});
