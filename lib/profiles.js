import { dump } from '../vendor/yaml.mjs';

const targets = ['universal', 'verge', 'clash'];
const classic = new Set(['ss', 'vmess', 'socks', 'socks5']);
const legacyCiphers = new Set(['aes-128-gcm', 'aes-192-gcm', 'aes-256-gcm', 'chacha20-ietf-poly1305',
  'aes-128-cfb', 'aes-192-cfb', 'aes-256-cfb', 'chacha20-ietf']);
const decode = value => Buffer.from(value, 'base64').toString('utf8');
const enabled = value => value === '1' || value === 'true';

function applyTransport(proxy, network, host, path, service) {
  if (!network || network === 'tcp' || network === 'raw') return true;
  if (network === 'ws') {
    proxy.network = 'ws';
    proxy['ws-opts'] = { path: path || '/' };
    if (host) proxy['ws-opts'].headers = { Host: host };
    return true;
  }
  if (network === 'grpc') {
    proxy.network = 'grpc';
    proxy['grpc-opts'] = { 'grpc-service-name': service || path || '' };
    return true;
  }
  return false;
}

function vmess(link) {
  const data = JSON.parse(decode(link.slice(8)));
  if (!data.id || !data.add || (data.type && data.type !== 'none') ||
      (data.tls && data.tls !== 'tls')) return;
  const proxy = {
    type: 'vmess', server: data.add, port: Number(data.port), uuid: data.id,
    alterId: Number(data.aid || 0), cipher: data.scy || 'auto', tls: data.tls === 'tls',
  };
  if (data.sni) proxy.servername = data.sni;
  if (data.fp) proxy['client-fingerprint'] = data.fp;
  if (data.alpn) proxy.alpn = data.alpn.split(',');
  if (enabled(String(data.allowInsecure))) proxy['skip-cert-verify'] = true;
  if (applyTransport(proxy, data.net, data.host, data.path)) return proxy;
}

function shadowsocks(link) {
  let url = new URL(link);
  if (!url.username) {
    const legacy = decode(url.hostname);
    if (!legacy.includes('@')) return;
    const at = legacy.lastIndexOf('@');
    const credentials = Buffer.from(legacy.slice(0, at)).toString('base64url');
    url = new URL('ss://' + credentials + legacy.slice(at));
  }
  const secret = url.password ? decodeURIComponent(url.username) + ':' + decodeURIComponent(url.password)
    : decode(decodeURIComponent(url.username));
  const divider = secret.indexOf(':');
  if (divider <= 0 || divider === secret.length - 1) return;
  const proxy = {
    type: 'ss', server: url.hostname, port: Number(url.port), cipher: secret.slice(0, divider),
    password: secret.slice(divider + 1),
  };
  const plugin = url.searchParams.get('plugin');
  if (!plugin) return proxy;
  const [name, ...options] = plugin.split(';');
  if (!['obfs-local', 'obfs', 'v2ray-plugin'].includes(name)) return;
  proxy.plugin = name === 'obfs-local' ? 'obfs' : name;
  proxy['plugin-opts'] = Object.fromEntries(options.filter(Boolean).map(option => {
    const split = option.indexOf('=');
    if (split < 0) return [option, true];
    return [option.slice(0, split).replace(/^obfs-/, ''), option.slice(split + 1)];
  }));
  return proxy;
}

function uriProxy(node) {
  const url = new URL(node.link);
  const q = url.searchParams;
  const type = node.protocol === 'hy2' ? 'hysteria2' : node.protocol === 'socks' ? 'socks5' : node.protocol;
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const proxy = { type, server: url.hostname, port: Number(url.port || 443) };
  if (q.get('sni')) proxy[type === 'vless' ? 'servername' : 'sni'] = q.get('sni');
  if (q.get('alpn')) proxy.alpn = q.get('alpn').split(',');
  if (enabled(q.get('allowInsecure') || q.get('insecure') || q.get('allow_insecure'))) {
    proxy['skip-cert-verify'] = true;
  }
  if (type === 'socks5') {
    if (!url.port) return;
    if (user) proxy.username = user;
    if (password) proxy.password = password;
    return proxy;
  }
  if (!user) return;
  if (type === 'hysteria2') {
    if (q.has('mport') || q.has('ports') || (q.get('obfs') && q.get('obfs') !== 'salamander')) return;
    proxy.password = user;
    if (q.get('obfs')) proxy.obfs = q.get('obfs');
    if (q.get('obfs-password')) proxy['obfs-password'] = q.get('obfs-password');
    return proxy;
  }
  if (type === 'tuic' && password) {
    proxy.uuid = user;
    proxy.password = password;
    if (q.get('congestion_control')) proxy['congestion-controller'] = q.get('congestion_control');
    if (q.get('udp_relay_mode')) proxy['udp-relay-mode'] = q.get('udp_relay_mode');
    return proxy;
  }
  if (type === 'anytls') {
    proxy.password = user;
    return proxy;
  }
  if (!['vless', 'trojan'].includes(type) || password) return;
  const security = q.get('security') || (type === 'trojan' ? 'tls' : 'none');
  if (!['none', 'tls', 'reality'].includes(security) || (type === 'trojan' && security === 'none') ||
      (q.get('headerType') && q.get('headerType') !== 'none')) return;
  if (type === 'vless') {
    if (q.get('encryption') && q.get('encryption') !== 'none') return;
    proxy.uuid = user;
    proxy.tls = security !== 'none';
    if (q.get('flow')) proxy.flow = q.get('flow');
  } else proxy.password = user;
  if (security === 'reality') {
    if (!q.get('pbk')) return;
    proxy['reality-opts'] = { 'public-key': q.get('pbk'), 'short-id': q.get('sid') || '' };
  }
  if (q.get('fp')) proxy['client-fingerprint'] = q.get('fp');
  if (applyTransport(proxy, q.get('type'), q.get('host'), q.get('path'), q.get('serviceName'))) return proxy;
}

function toProxy(node, legacy) {
  if (legacy && !classic.has(node.protocol)) return;
  const proxy = node.protocol === 'vmess' ? vmess(node.link) : node.protocol === 'ss' ? shadowsocks(node.link) : uriProxy(node);
  if (!proxy || typeof proxy.server !== 'string' || !proxy.server ||
      !Number.isInteger(proxy.port) || proxy.port < 1 || proxy.port > 65535) return;
  if (legacy && ((proxy.type === 'ss' && !legacyCiphers.has(proxy.cipher)) ||
      proxy.network === 'grpc')) return;
  proxy.server = proxy.server.replace(/^\[|\]$/g, '');
  if (legacy) delete proxy['client-fingerprint'];
  return proxy;
}

export function buildProfiles(nodes) {
  const formats = {
    universal: { count: nodes.length, skipped: 0, body: Buffer.from(nodes.map(node => node.link).join('\n')).toString('base64') },
  };
  for (const target of targets.slice(1)) {
    const names = new Set(['allToan', 'DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE', 'GLOBAL']);
    const proxies = [];
    for (const node of nodes) {
      let proxy;
      try { proxy = toProxy(node, target === 'clash'); } catch { /* unsupported or malformed URI */ }
      if (!proxy) continue;
      let name = node.name.trim() || '节点';
      for (let suffix = 2; names.has(name); suffix++) name = (node.name.trim() || '节点') + ' (' + suffix + ')';
      names.add(name);
      proxies.push({ name, ...proxy });
    }
    const body = proxies.length ? dump({
      proxies,
      'proxy-groups': [{ name: 'allToan', type: 'select', proxies: proxies.map(proxy => proxy.name) }],
      rules: ['MATCH,allToan'],
    }, { lineWidth: -1, noRefs: true, quotingType: '"', forceQuotes: true }) : '';
    formats[target] = { count: proxies.length, skipped: nodes.length - proxies.length, body };
  }
  return formats;
}
