import { convert, protocols } from '../lib/convert.js';
import { aggregate, inputLines, isSubscriptionUrl, MAX_SOURCES, MAX_URL_LENGTH } from '../lib/aggregate.js';
import { LIMIT } from '../lib/subscription.js';

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
    if (!['auto', 'url', 'text'].includes(body?.mode) || typeof body.input !== 'string' || !body.input.trim()) {
      return json({ error: '请先粘贴订阅网址或内容。' }, 400);
    }
    const input = body.input.trim();
    const { headerText = '', headerSource = 1 } = body;
    if (typeof headerText !== 'string' || !Number.isInteger(headerSource) || headerSource < 1 || headerSource > MAX_SOURCES) {
      return json({ error: '自定义请求头设置无效。' }, 400);
    }
    let mode = body.mode;
    if (mode === 'auto') {
      const lines = inputLines(input);
      mode = 'text';
      if (lines.some(isSubscriptionUrl) && lines.every(line => /^[a-z][\w+.-]*:\/\//i.test(line))) {
        mode = lines.every(isSubscriptionUrl) ? 'url' : 'mixed';
      }
    }
    if (Buffer.byteLength(input) > (mode === 'url' ? MAX_SOURCES * (MAX_URL_LENGTH + 2) : LIMIT)) {
      return json({ error: '输入太长，请检查网址或分批转换。' }, 413);
    }
    if (mode === 'text' && headerText.trim()) {
      return json({ error: '自定义请求头需要与 HTTP / HTTPS 订阅网址一起使用。' }, 422);
    }
    try {
      const result = mode === 'text' ? convert(input) : await aggregate(input, {
        includeNodes: mode === 'mixed', headerText, headerSource,
      });
      const payload = JSON.stringify({ ...result, protocols, inputType: mode });
      if (Buffer.byteLength(payload) > 4 * LIMIT) {
        return json({ error: '转换结果超过 4 MB，请分批转换。' }, 413);
      }
      return new Response(payload, { headers: { ...headers, 'Content-Type': 'application/json' } });
    }
    catch (error) { return json({ error: error.message }, 422); }
  },
};
