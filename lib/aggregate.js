import { convert, MAX_NODES } from './convert.js';
import { readSubscription } from './subscription.js';

export const MAX_SOURCES = 8;
export const MAX_URL_LENGTH = 8192;

export async function aggregate(input, load = readSubscription) {
  const sources = input.split(/\r\n|\n|\r/).map(line => line.trim()).filter(Boolean);
  if (sources.length > MAX_SOURCES) throw new Error('每次最多可输入 8 个订阅网址。');
  const unique = new Map();
  for (const [index, url] of sources.entries()) {
    if (url.length > MAX_URL_LENGTH) throw new Error('第 ' + (index + 1) + ' 个订阅网址太长。');
    if (!unique.has(url)) unique.set(url, index + 1);
  }
  const outcomes = await Promise.all([...unique].map(async ([url, source]) => {
    let content;
    try {
      content = await load(url);
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
  for (const outcome of outcomes) {
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
    throw new Error(sources.length === 1 ? failedSources[0].message : '未能读取任何订阅。' + detail);
  }
  if (nodes.size > MAX_NODES) throw new Error('合并后超过 2,000 个节点，请分批转换。');
  return {
    nodes: [...nodes.values()], skipped, duplicates, failedSources,
    sourceCount: unique.size,
  };
}
