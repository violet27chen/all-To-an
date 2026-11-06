import { validateHeaderName, validateHeaderValue } from 'node:http';

export const MAX_HEADER_BYTES = 4096;
const controlled = new Set([
  'accept-encoding', 'connection', 'content-length', 'expect', 'forwarded', 'keep-alive',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'x-original-host', 'x-original-url',
  'x-rewrite-url', 'x-real-ip', 'x-http-method', 'x-http-method-override', 'x-method-override',
]);

export function parseRequestHeaders(text, target) {
  if (Buffer.byteLength(text) > MAX_HEADER_BYTES) throw new Error('自定义请求头最多 4 KB。');
  let host;
  try { host = new URL(target).host; }
  catch { throw new Error('自定义请求头对应的订阅网址无效。'); }

  const headers = Object.create(null);
  const seen = new Set();
  for (const [index, line] of text.split(/\r\n|\r|\n/).entries()) {
    if (!line.trim()) continue;
    const separator = line.indexOf(':');
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    try {
      if (separator < 1) throw new Error();
      validateHeaderName(name);
      validateHeaderValue(name, value);
    } catch {
      throw new Error('请求头第 ' + (index + 1) + ' 行无效，请使用「名称: 值」。');
    }
    if (seen.has(name)) throw new Error('请求头第 ' + (index + 1) + ' 行的名称重复。');
    seen.add(name);
    if (seen.size > 24) throw new Error('最多可填写 24 个自定义请求头。');
    if (name === 'host') {
      if (value.toLowerCase() !== host.toLowerCase()) throw new Error('Host 必须与所选订阅网址一致。');
      continue;
    }
    if (controlled.has(name) || /^(?:proxy-|x-forwarded-)/.test(name)) {
      throw new Error('请求头第 ' + (index + 1) + ' 行由服务器管理，不能自定义。');
    }
    headers[name] = value;
  }
  return headers;
}
