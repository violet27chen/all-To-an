import { load, FAILSAFE_SCHEMA } from '../vendor/yaml.mjs';

const schemes = new Set('vless vmess trojan ss ssr hysteria hysteria2 hy2 tuic anytls socks socks5 wireguard'.split(' '));
const enc = encodeURIComponent;
const tag = name => name ? '#' + enc(String(name)) : '';
const b64 = s => Buffer.from(s).toString('base64');
const present = v => v !== undefined && v !== null && v !== '';
const yes = v => v === true || v === 'true';
const query = fields => {
  const value = new URLSearchParams(Object.entries(fields).filter(([, v]) => present(v))).toString().replaceAll('+', '%20');
  return value ? '?' + value : '';
};

function fromClash(p) {
  const { type, name, server, port, password, uuid, network = 'tcp' } = p;
  if (typeof server !== 'string' || !/^(?:[\w.-]+|\[?[\da-f:]+\]?)$/i.test(server) ||
      !Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) return;
  const host = server.includes(':') && !server.startsWith('[') ? '[' + server + ']' : server;
  const address = host + ':' + Number(port);
  const uri = (scheme, auth, fields) => scheme + '://' + auth + '@' + address + query(fields) + tag(name);
  const reality = p['reality-opts'];
  const opts = p[network + '-opts'] ?? {};
  const transportHost = opts.headers?.Host ?? opts.headers?.host ?? opts.host;
  const sni = p.servername || p.sni;
  const tls = {
    sni, fp: p['client-fingerprint'], alpn: Array.isArray(p.alpn) ? p.alpn.join(',') : p.alpn,
    allowInsecure: yes(p['skip-cert-verify']) ? '1' : undefined,
    pbk: reality?.['public-key'], sid: reality?.['short-id'], spx: reality?.['spider-x'],
  };
  const transport = {
    type: network, path: opts.path, host: Array.isArray(transportHost) ? transportHost.join(',') : transportHost,
    serviceName: opts['grpc-service-name'], mode: opts.mode,
  };
  if (type === 'vless' && uuid && ['tcp', 'ws', 'grpc', 'httpupgrade', 'xhttp'].includes(network)) {
    return uri(type, enc(uuid), { encryption: p.encryption || 'none', flow: p.flow, security: reality ? 'reality' : yes(p.tls) ? 'tls' : 'none', ...transport, ...tls });
  }
  if (type === 'vmess' && uuid && !reality && ['tcp', 'ws', 'grpc', 'http', 'h2'].includes(network)) {
    return 'vmess://' + b64(JSON.stringify({
      v: '2', ps: name || address, add: server, port: String(port), id: uuid, aid: String(p.alterId ?? 0),
      scy: p.cipher || 'auto', net: network, type: 'none', host: transport.host || '',
      path: transport.path || transport.serviceName || '', tls: yes(p.tls) ? 'tls' : '', sni: sni || '',
      alpn: tls.alpn || '', fp: tls.fp || '', allowInsecure: tls.allowInsecure || '0',
    }));
  }
  if (type === 'trojan' && password && ['tcp', 'ws', 'grpc', 'httpupgrade', 'xhttp'].includes(network)) {
    return uri(type, enc(password), { security: reality ? 'reality' : 'tls', ...transport, ...tls });
  }
  if (type === 'ss' && p.cipher && password) {
    const credentials = p.cipher.startsWith('2022-') ? enc(p.cipher) + ':' + enc(password) : Buffer.from(p.cipher + ':' + password).toString('base64url');
    let plugin;
    if (p.plugin) {
      if (!['obfs', 'obfs-local', 'v2ray-plugin'].includes(p.plugin)) return;
      const o = p['plugin-opts'] ?? {};
      plugin = [p.plugin === 'obfs' ? 'obfs-local' : p.plugin, ...Object.entries(o).flatMap(([k, v]) => {
        const key = p.plugin === 'obfs' && ['mode', 'host'].includes(k) ? 'obfs-' + k : k;
        return v === true || v === 'true' ? [key] : v === false || v === 'false' ? [] : [key + '=' + v];
      })].join(';');
    }
    return 'ss://' + credentials + '@' + address + (plugin ? '/' + query({ plugin }) : '') + tag(name);
  }
  if (type === 'hysteria2' && password && !p.ports) {
    return uri(type, enc(password), { sni, insecure: tls.allowInsecure, obfs: p.obfs, 'obfs-password': p['obfs-password'] });
  }
  if (type === 'tuic' && uuid && password) {
    return uri(type, enc(uuid) + ':' + enc(password), {
      sni, alpn: tls.alpn, allow_insecure: tls.allowInsecure,
      congestion_control: p['congestion-controller'], udp_relay_mode: p['udp-relay-mode'],
    });
  }
}

function decode(s) {
  const compact = s.replace(/\s/g, '');
  if (compact.length % 4 === 1 || !/^[\w+/-]+={0,2}$/.test(compact)) return '';
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(compact, 'base64')); }
  catch { return ''; }
}

function shareName(link, protocol) {
  const hash = link.indexOf('#');
  if (hash >= 0) {
    try { return decodeURIComponent(link.slice(hash + 1)); } catch { return link.slice(hash + 1); }
  }
  if (protocol === 'vmess') {
    try { return JSON.parse(decode(link.slice(8))).ps; } catch { /* URI form */ }
  }
}

export function convert(input) {
  let source = input.trim().replace(/^\uFEFF/, '');
  const decoded = decode(source);
  if (decoded) source = decoded.trim();
  const nodes = [], seen = new Set();
  let skipped = 0, duplicates = 0;
  function add(link, name) {
    const match = /^([a-z][\w+.-]*):\/\/(\S(?:.*\S)?)$/i.exec(link);
    const protocol = match?.[1].toLowerCase();
    if (!schemes.has(protocol) || link.length > 8192) { skipped++; return; }
    if (seen.has(link)) { duplicates++; return; }
    if (nodes.length >= 2000) throw new Error('节点超过 2,000 条，请分批转换。');
    seen.add(link);
    const label = name || shareName(link, protocol);
    nodes.push({ protocol, name: typeof label === 'string' && label ? label.slice(0, 180) : '节点 ' + (nodes.length + 1), link });
  }
  if (/(?:^|\n)\s*["']?proxies["']?\s*:/m.test(source) || source.startsWith('{') || source.startsWith('[')) {
    let config;
    try { config = load(source, { schema: FAILSAFE_SCHEMA }); }
    catch { throw new Error('无法读取 Clash 配置，请检查 YAML 或 JSON 格式。'); }
    const proxies = Array.isArray(config) ? config : config?.proxies;
    if (Array.isArray(proxies)) {
      for (const p of proxies) {
        let link;
        try { if (p && typeof p === 'object') link = fromClash(p); } catch { /* malformed entry */ }
        if (link) add(link, p.name); else skipped++;
      }
    }
  } else {
    for (const line of source.split(/\r?\n|\r/)) {
      const link = line.trim();
      if (link && !link.startsWith('#')) add(link);
    }
  }
  if (!nodes.length) throw new Error('未找到可转换的节点。请检查订阅是否过期，或是否为 Base64、节点列表或含 proxies 的 Clash 配置。');
  return { nodes, skipped, duplicates };
}
