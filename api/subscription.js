import { randomBytes } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { convert } from '../lib/convert.js';
import { buildProfiles } from '../lib/profiles.js';

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const json = (body, status = 200) => Response.json(body, { status, headers });
const invalid = '订阅不存在或已删除。';
const formats = {
  universal: 'text/plain; charset=utf-8',
  verge: 'application/yaml; charset=utf-8',
  clash: 'application/yaml; charset=utf-8',
};
const pathFor = id => 'alltoan/subscriptions/' + id + '.json';

async function publish(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: '请在本站页面生成订阅。' }, 403);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return json({ error: '本站尚未配置订阅存储。' }, 503);
  if (!/^text\/plain(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    return json({ error: '请提交节点链接文本。' }, 415);
  }

  let nodes;
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request.body ?? []) {
      size += chunk.length;
      if (size > 3 * 1024 * 1024) return json({ error: '节点链接超过 3 MB，请分批生成订阅。' }, 413);
      chunks.push(chunk);
    }
    const result = convert(Buffer.concat(chunks).toString('utf8'));
    if (result.skipped) return json({ error: '节点列表包含无法识别的链接，请重新转换。' }, 422);
    nodes = result.nodes;
  } catch {
    return json({ error: '没有可发布的节点，请先转换订阅。' }, 422);
  }

  const profiles = buildProfiles(nodes);
  for (const profile of Object.values(profiles)) {
    if (Buffer.byteLength(profile.body) > 4 * 1024 * 1024) {
      return json({ error: '生成的订阅内容超过 4 MB，请分批发布。' }, 413);
    }
  }
  const id = randomBytes(24).toString('base64url');
  try {
    await put(pathFor(id), JSON.stringify(profiles), {
      token, access: 'private', contentType: 'application/json', addRandomSuffix: false,
    });
  } catch {
    return json({ error: '无法保存订阅，请检查私有 Blob 配置后重试。' }, 502);
  }
  return json(Object.fromEntries(Object.entries(profiles).map(([target, { count, skipped }]) => [
    target, { count, skipped, path: count ? '/api/subscription?id=' + id + '&format=' + target : null },
  ])), 201);
}

async function read(request) {
  const params = new URL(request.url).searchParams;
  const id = params.get('id') || '';
  const format = params.get('format') || 'universal';
  if (!/^[a-zA-Z0-9_-]{32}$/.test(id) || !Object.hasOwn(formats, format)) return json({ error: invalid }, 404);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return json({ error: '订阅存储暂不可用。' }, 503);
  try {
    const blob = await get(pathFor(id), { token, access: 'private', useCache: false });
    if (!blob || blob.statusCode !== 200) return json({ error: invalid }, 404);
    const profiles = await new Response(blob.stream).json();
    if (!profiles[format]?.count) return json({ error: '该格式没有可用节点。' }, 404);
    return new Response(request.method === 'HEAD' ? null : profiles[format].body, {
      headers: {
        ...headers,
        'Content-Type': formats[format],
        'Content-Disposition': 'inline; filename="allToan-' + format + (format === 'universal' ? '.txt"' : '.yaml"'),
      },
    });
  } catch {
    return json({ error: '无法读取订阅，请稍后重试。' }, 502);
  }
}

export default {
  fetch(request) {
    if (request.method === 'POST') return publish(request);
    if (request.method === 'GET' || request.method === 'HEAD') return read(request);
    return json({ error: '不支持的请求方式。' }, 405);
  },
};
