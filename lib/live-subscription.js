import { createHash } from 'node:crypto';
import { aggregate, inputLines, isSubscriptionUrl, MAX_SOURCES, prepareAggregation } from './aggregate.js';
import { MAX_NODES } from './convert.js';
import { LIMIT } from './subscription.js';

const fingerprint = link => createHash('sha256').update(link).digest('hex');

export function prepareLiveSource(source) {
  const { input, headerText = '', headerSource = 1, removed = [] } = source ?? {};
  if (typeof input !== 'string' || Buffer.byteLength(input) > LIMIT ||
      typeof headerText !== 'string' || !Number.isInteger(headerSource) ||
      headerSource < 1 || headerSource > MAX_SOURCES ||
      !Array.isArray(removed) || removed.length > MAX_NODES ||
      removed.some(link => typeof link !== 'string' || link.length > 8192)) {
    throw new Error('动态订阅的来源设置无效。');
  }
  const excluded = new Set(removed.map(fingerprint));
  const lines = inputLines(input);
  if (!lines.every(line => /^[a-z][\w+.-]*:\/\//i.test(line))) {
    throw new Error('动态订阅只接受逐行排列的订阅网址和节点链接。');
  }
  const retained = lines.filter(line => isSubscriptionUrl(line) || !excluded.has(fingerprint(line))).join('\n');
  const { unique } = prepareAggregation(retained, { includeNodes: true, headerText, headerSource });
  if (!unique.size) throw new Error('动态订阅至少需要一个原始订阅网址。');
  return { input: retained, headerText, headerSource, excluded: [...excluded] };
}

export function retainLiveNodes(nodes, source) {
  if (!source.excluded.length) return nodes;
  const excluded = new Set(source.excluded);
  return nodes.filter(node => !excluded.has(fingerprint(node.link)));
}

export async function refreshLiveSource(source, load) {
  const result = await aggregate(source.input, {
    includeNodes: true, headerText: source.headerText, headerSource: source.headerSource, load,
  });
  if (result.failedSources.length) return null;
  return retainLiveNodes(result.nodes, source);
}
