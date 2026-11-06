import { convert, MAX_NODES } from './convert.js';
import { readSubscription } from './subscription.js';
import { parseRequestHeaders } from './request-headers.js';

export const MAX_SOURCES = 8;
export const MAX_URL_LENGTH = 8192;
export const inputLines = input => input.split(/\r\n|\n|\r/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
export const isSubscriptionUrl = line => /^https?:\/\//i.test(line);

export function prepareAggregation(input, { includeNodes = false, headerText = '', headerSource = 1 } = {}) {
  const sources = inputLines(input).map((value, index) => ({
    value, source: index + 1, isUrl: !includeNodes || isSubscriptionUrl(value),
  }));
  const urls = sources.filter(item => item.isUrl);
  if (urls.length > MAX_SOURCES) throw new Error('每次最多可输入 8 个订阅网址。');
  const unique = new Map();
  for (const { value, source } of urls) {
    if (value.length > MAX_URL_LENGTH) throw new Error('第 ' + source + ' 条输入的订阅网址太长。');
    if (!unique.has(value)) unique.set(value, source);
  }
  let headerTarget, customHeaders;
  if (headerText.trim()) {
    headerTarget = [...unique.keys()][headerSource - 1];
    if (!headerTarget) throw new Error('自定义请求头指定的订阅网址不存在。');
    customHeaders = parseRequestHeaders(headerText, headerTarget);
  }
  return { sources, unique, headerTarget, customHeaders };
}

export async function aggregate(input, { load = readSubscription, ...options } = {}) {
  const { sources, unique, headerTarget, customHeaders } = prepareAggregation(input, options);
  const outcomes = await Promise.all([...unique].map(async ([url, source]) => {
    let content;
    try {
      content = await load(url, url === headerTarget ? customHeaders : undefined);
    } catch (error) {
      const message = error.code || error.name === 'TimeoutError' || error.name === 'AbortError'
        ? '无法读取订阅。请检查网址，或在浏览器打开订阅后粘贴内容。' : error.message;
      return { source, message };
    }
    try { return convert(content); }
    catch (error) { return { source, message: error.message }; }
  }));

  const nodes = new Map();
  const failedSources = [];
  let skipped = 0, duplicates = 0;
  const bySource = new Map([...unique.values()].map((source, index) => [source, outcomes[index]]));
  for (const { value, source, isUrl } of sources) {
    let outcome = bySource.get(source);
    if (isUrl && !outcome) continue;
    if (!isUrl) {
      try { outcome = convert(value); }
      catch { skipped++; continue; }
    }
    if (!outcome.nodes) {
      failedSources.push(outcome);
      continue;
    }
    skipped += outcome.skipped;
    duplicates += outcome.duplicates;
    for (const node of outcome.nodes) {
      if (nodes.has(node.link)) duplicates++;
      else nodes.set(node.link, node);
    }
  }
  if (!nodes.size) {
    const detail = failedSources.map(({ source, message }) => '第 ' + source + ' 个：' + message).join(' ');
    if (sources.length === 1 && failedSources.length) throw new Error(failedSources[0].message);
    throw new Error('未找到可用节点。' + detail);
  }
  if (nodes.size > MAX_NODES) throw new Error('合并后超过 2,000 个节点，请分批转换。');
  return {
    nodes: [...nodes.values()], skipped, duplicates, failedSources,
    sourceCount: unique.size,
  };
}
