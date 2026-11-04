const $ = id => document.getElementById(id);
const form = $('form');
const input = { url: $('url'), text: $('content') };
const hints = {
  url: '支持 HTTP / HTTPS 订阅网址。订阅链接可能含有访问令牌，请勿公开分享。',
  text: '支持 Base64、逐行排列的节点链接及含 proxies 的 Clash YAML / JSON。',
};
let nodes = [], noticeTimer, pending = false;
function mode() { return form.elements.mode.value; }
function updateMode() {
  for (const [key, el] of Object.entries(input)) {
    el.hidden = key !== mode();
    el.required = !el.hidden;
  }
  $('hint').textContent = hints[mode()];
  $('error').hidden = true;
}
form.addEventListener('change', e => { if (e.target.name === 'mode') updateMode(); });
updateMode();

function notice(message) {
  $('notice').textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('notice').textContent = ''; }, 4000);
}
async function copy(text, message) {
  try {
    if (!navigator.clipboard) throw new Error();
    await navigator.clipboard.writeText(text);
  } catch {
    const previous = document.activeElement;
    const field = document.createElement('textarea');
    field.value = text;
    field.className = 'sr-only';
    field.readOnly = true;
    document.body.append(field);
    field.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* clipboard permission */ }
    field.remove();
    previous?.focus();
    if (!copied) return notice('无法访问剪贴板，可以点击「下载 TXT」保存节点。');
  }
  notice(message);
}
const allLinks = () => nodes.map(node => node.link).join('\n');
$('copy-all').addEventListener('click', () => copy(allLinks(), '已复制全部 ' + nodes.length + ' 个节点'));
$('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([allLinks() + '\n'], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'allToan-nodes.txt';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function render(data) {
  nodes = data.nodes;
  $('nodes').replaceChildren();
  $('empty').hidden = !!nodes.length;
  for (const id of ['nodes', 'result-actions', 'count']) $(id).hidden = !nodes.length;
  $('count').textContent = nodes.length + ' 个';
  const notes = [];
  if (data.duplicates) notes.push('已合并 ' + data.duplicates + ' 条重复链接');
  if (data.skipped) notes.push('跳过 ' + data.skipped + ' 条无法转换的记录');
  $('note').textContent = notes.join(' · ');
  $('note').hidden = !notes.length;
  const list = document.createDocumentFragment();
  for (const node of nodes) {
    const row = document.createElement('li');
    row.className = 'node';
    const info = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'node-title';
    const badge = document.createElement('span');
    badge.className = 'protocol';
    badge.textContent = node.protocol.toUpperCase();
    title.append(badge, node.name);
    const link = document.createElement('code');
    link.textContent = node.link;
    info.append(title, link);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiet';
    button.textContent = '复制';
    button.setAttribute('aria-label', '复制 ' + node.name);
    button.addEventListener('click', () => copy(node.link, '已复制：' + node.name));
    row.append(info, button);
    list.append(row);
  }
  $('nodes').append(list);
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (pending) return;
  const selection = mode(), value = input[selection].value.trim();
  if (!value) { input[selection].focus(); return; }
  pending = true;
  $('error').hidden = true;
  render({ nodes: [] });
  const submit = $('submit');
  for (const el of [submit, $('example'), ...form.elements.mode, ...Object.values(input)]) el.disabled = true;
  submit.firstChild.textContent = '正在转换… ';
  try {
    const response = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: selection, input: value }),
      signal: AbortSignal.timeout(18000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error || '转换暂时不可用，请稍后重试。');
    render(data);
    notice('已提取 ' + data.nodes.length + ' 个节点');
  } catch (error) {
    $('error').textContent = error.name === 'TimeoutError' ? '请求超时，请重试或直接粘贴订阅内容。'
      : error instanceof TypeError ? '无法连接转换服务，请检查网络后重试。' : error.message;
    $('error').hidden = false;
  } finally {
    for (const el of [submit, $('example'), ...form.elements.mode, ...Object.values(input)]) el.disabled = false;
    submit.firstChild.textContent = '转换节点 ';
    pending = false;
  }
});

$('example').addEventListener('click', () => {
  form.elements.mode.value = 'text';
  updateMode();
  input.text.value = [
    'vless://00000000-0000-4000-8000-000000000000@example.com:443?encryption=none&security=tls&type=tcp#VLESS%20%E7%A4%BA%E4%BE%8B',
    'trojan://demo-password@example.net:443?security=tls#Trojan%20%E7%A4%BA%E4%BE%8B',
    'ss://YWVzLTEyOC1nY206ZGVtby1wYXNzd29yZA@example.org:8388#SS%20%E7%A4%BA%E4%BE%8B',
  ].join('\n');
  form.requestSubmit();
});
