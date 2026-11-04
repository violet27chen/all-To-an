import { convert } from '../lib/convert.js';
import { LIMIT, readSubscription } from '../lib/subscription.js';

const headers = { 'Cache-Control': 'no-store' };
const json = (body, status = 200) => Response.json(body, { status, headers });

export default {
  async fetch(request) {
    if (request.method !== 'POST') return json({ error: '请在转换页面提交订阅。' }, 405);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: '请在本站页面提交订阅。' }, 403);
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
      return json({ error: '请求格式无效。' }, 415);
    }
    let size = 0, body;
    try {
      const chunks = [];
      for await (const chunk of request.body ?? []) {
        size += chunk.length;
        if (size > LIMIT + 8192) return json({ error: '内容超过 1 MB，请分批转换。' }, 413);
        chunks.push(chunk);
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { return json({ error: '请求格式无效。' }, 400); }
    if (!['url', 'text'].includes(body?.mode) || typeof body.input !== 'string' || !body.input.trim()) {
      return json({ error: '请先粘贴订阅网址或内容。' }, 400);
    }
    const input = body.input.trim();
    if (Buffer.byteLength(input) > (body.mode === 'url' ? 8192 : LIMIT)) {
      return json({ error: '输入太长，请检查网址或分批转换。' }, 413);
    }
    let source = input;
    if (body.mode === 'url') {
      try { source = await readSubscription(input); }
      catch (error) {
        const message = error.code || error.name === 'TimeoutError' || error.name === 'AbortError'
          ? '无法读取订阅。请检查网址，或在浏览器打开订阅后粘贴内容。' : error.message;
        return json({ error: message }, 422);
      }
    }
    try { return json(convert(source)); }
    catch (error) { return json({ error: error.message }, 422); }
  },
};
