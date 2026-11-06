import { lookupVpncheapSource, vpncheapSource } from '../lib/vpncheap.js';

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const json = (body, status = 200) => Response.json(body, { status, headers });

export default {
  async fetch(request) {
    if (request.method !== 'POST') return json({ error: '请在 VPNCheap 提取区提交。' }, 405);
    const origin = request.headers.get('origin');
    if (origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
      return json({ error: '请在本站页面提交。' }, 403);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
      return json({ error: '请求格式无效。' }, 415);
    }
    let input;
    try {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of request.body ?? []) {
        bytes += chunk.length;
        if (bytes > 8192) return json({ error: '输入太长。' }, 413);
        chunks.push(chunk);
      }
      input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return json({ error: '请求格式无效。' }, 400);
    }
    if (typeof input?.url === 'string') {
      try { return json(vpncheapSource(input.url)); }
      catch (error) { return json({ error: error.message }, 422); }
    }
    if (typeof input?.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
        input.email.length > 254 || typeof input.password !== 'string' || !input.password.length || input.password.length > 512) {
      return json({ error: '请输入有效的 VPNCheap 邮箱和密码。' }, 400);
    }
    try { return json(await lookupVpncheapSource(input.email, input.password)); }
    catch (error) {
      return json({ error: /^VPNCheap|^订阅网址/.test(error.message) ? error.message : '无法获取 VPNCheap 账号订阅，请稍后重试。' }, 502);
    }
  },
};
