import { randomBytes } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { convert, parseProtocolFilter } from '../lib/convert.js';
import { buildProfiles } from '../lib/profiles.js';
import { prepareLiveSource, refreshLiveSource, retainLiveNodes } from '../lib/live-subscription.js';

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const json = (body, status = 200) => Response.json(body, { status, headers });
const invalid = '订阅不存在或已删除。';
const formats = {
  universal: 'text/plain; charset=utf-8',
  verge: 'application/yaml; charset=utf-8',
  clash: 'application/yaml; charset=utf-8',
};
const pathFor = id => 'alltoan/subscriptions/' + id + '.json';
const PROFILE_VERSION = 2;
const MAX_OUTPUT = 4 * 1024 * 1024;

async function publish(request, filter) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: '请在本站页面生成订阅。' }, 403);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return json({ error: '本站尚未配置订阅存储。' }, 503);
  const contentType = request.headers.get('content-type') || '';
  const live = /^application\/json(?:\s*;|$)/i.test(contentType);
  if (!live && !/^text\/plain(?:\s*;|$)/i.test(contentType)) {
    return json({ error: '请提交节点链接文本或动态订阅设置。' }, 415);
  }

  let input, source;
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request.body ?? []) {
      size += chunk.length;
      if (size > (live ? MAX_OUTPUT : 3 * 1024 * 1024)) {
        return json({ error: '订阅发布内容太长，请分批生成。' }, 413);
      }
      chunks.push(chunk);
    }
    input = Buffer.concat(chunks).toString('utf8');
    if (live) {
      const body = JSON.parse(input);
      input = body?.nodes;
      source = prepareLiveSource(body?.source);
    }
  } catch (error) {
    return json({ error: error instanceof SyntaxError ? '动态订阅设置格式无效。' : error.message }, 422);
  }
  let nodes;
  try {
    if (typeof input !== 'string' || Buffer.byteLength(input) > 3 * 1024 * 1024) {
      return json({ error: '节点链接无效或超过 3 MB。' }, 422);
    }
    const result = convert(input);
    if (result.skipped) return json({ error: '节点列表包含无法识别的链接，请重新转换。' }, 422);
    nodes = source ? retainLiveNodes(result.nodes, source) : result.nodes;
  } catch {
    return json({ error: '没有可发布的节点，请先转换订阅。' }, 422);
  }

  const profiles = buildProfiles(nodes);
  for (const profile of Object.values(profiles)) {
    if (Buffer.byteLength(profile.body) > MAX_OUTPUT) {
      return json({ error: '生成的订阅内容超过 4 MB，请分批发布。' }, 413);
    }
  }
  const selectedNodes = filter ? nodes.filter(node => filter.has(node.protocol)) : nodes;
  if (!selectedNodes.length) return json({ error: '没有符合筛选条件的节点。' }, 422);
  const selectedProfiles = selectedNodes.length === nodes.length ? profiles : buildProfiles(selectedNodes);
  const id = randomBytes(24).toString('base64url');
  try {
    await put(pathFor(id), JSON.stringify({ ...profiles, version: PROFILE_VERSION, source }), {
      token, access: 'private', contentType: 'application/json', addRandomSuffix: false,
    });
  } catch {
    return json({ error: '无法保存订阅，请检查私有 Blob 配置后重试。' }, 502);
  }
  return json(Object.fromEntries(Object.entries(selectedProfiles).map(([target, { count, skipped }]) => {
    const params = new URLSearchParams({ id, format: target });
    if (filter) params.set('protocols', [...filter].join(','));
    return [target, { count, skipped, path: count ? '/api/subscription?' + params : null }];
  })), 201);
}

function selectProfile(saved, format, filter, freshNodes) {
  if (!freshNodes && !filter && (format === 'universal' || saved.version === PROFILE_VERSION)) return saved[format];
  const nodes = freshNodes || convert(saved.universal.body).nodes;
  const selected = filter ? nodes.filter(node => filter.has(node.protocol)) : nodes;
  return selected.length ? buildProfiles(selected)[format] : null;
}

async function read(request, params, filter) {
  const id = params.get('id') || '';
  const format = params.get('format') || 'universal';
  if (!/^[a-zA-Z0-9_-]{32}$/.test(id) || !Object.hasOwn(formats, format)) return json({ error: invalid }, 404);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return json({ error: '订阅存储暂不可用。' }, 503);
  try {
    const blob = await get(pathFor(id), { token, access: 'private', useCache: false });
    if (!blob || blob.statusCode !== 200) return json({ error: invalid }, 404);
    const saved = await new Response(blob.stream).json();
    let freshNodes, refreshStatus;
    if (saved.source && request.method === 'GET') {
      try { freshNodes = await refreshLiveSource(saved.source); }
      catch { /* keep the saved profile when upstream is unavailable */ }
      refreshStatus = freshNodes ? 'live' : 'fallback';
    }
    let profile = selectProfile(saved, format, filter, freshNodes);
    if (freshNodes && profile && Buffer.byteLength(profile.body) > MAX_OUTPUT) {
      refreshStatus = 'fallback';
      profile = selectProfile(saved, format, filter);
    }
    if (!profile?.count) return json({ error: profile === null ? '没有符合筛选条件的节点。' : '该格式没有可用节点。' }, 404);
    return new Response(request.method === 'HEAD' ? null : profile.body, {
      headers: {
        ...headers,
        ...(refreshStatus ? { 'X-AllToan-Refresh': refreshStatus } : {}),
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
    const params = new URL(request.url).searchParams;
    let filter;
    try { filter = parseProtocolFilter(params.get('protocols')); }
    catch (error) { return json({ error: error.message }, 400); }
    if (request.method === 'POST') return publish(request, filter);
    if (request.method === 'GET' || request.method === 'HEAD') return read(request, params, filter);
    return json({ error: '不支持的请求方式。' }, 405);
  },
};
