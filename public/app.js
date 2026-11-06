const $ = id => document.getElementById(id);
const form = $('form');
const input = $('content');
let nodes = [], visibleNodes = [], showNodeList = false, editingNodes = false, noticeTimer, pending = false;
const removedNodes = new Set();
const retainedNodes = () => nodes.filter(node => !removedNodes.has(node.link));
input.addEventListener('input', () => { $('error').hidden = true; });

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
const links = list => list.map(node => node.link).join('\n');
$('copy-all').addEventListener('click', () => copy(links(visibleNodes), '已复制 ' + visibleNodes.length + ' 个节点'));
$('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([links(visibleNodes) + '\n'], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'allToan-nodes.txt';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function render(data, previewNodes = false) {
  nodes = data.nodes;
  removedNodes.clear();
  editingNodes = false;
  showNodeList = previewNodes && data.inputType === 'url';
  const notes = [];
  if (data.sourceCount > 1) {
    notes.push('已合并 ' + (data.sourceCount - data.failedSources.length) + ' / ' + data.sourceCount + ' 个订阅');
  }
  if (data.duplicates) notes.push('已合并 ' + data.duplicates + ' 条重复链接');
  if (data.skipped) notes.push('跳过 ' + data.skipped + ' 条无法转换的记录');
  for (const failure of data.failedSources || []) notes.push('第 ' + failure.source + ' 条输入的订阅：' + failure.message);
  $('note').textContent = notes.join(' · ');
  $('note').hidden = !notes.length;
  $('protocol-filter').hidden = !nodes.length;
  const counts = new Map();
  for (const node of nodes) counts.set(node.protocol, (counts.get(node.protocol) || 0) + 1);
  const choices = document.createDocumentFragment();
  for (const protocol of data.protocols || []) {
    const count = counts.get(protocol);
    if (!count) continue;
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = protocol;
    checkbox.checked = true;
    label.append(checkbox, protocol.toUpperCase() + ' (' + count + ')');
    choices.append(label);
  }
  $('protocol-choices').replaceChildren(choices);
  applyFilter();
}

const protocolChoices = () => [...$('protocol-choices').querySelectorAll('input')];
const selectedProtocols = () => protocolChoices().filter(input => input.checked).map(input => input.value);
function applyFilter() {
  const selected = new Set(selectedProtocols());
  visibleNodes = retainedNodes().filter(node => selected.has(node.protocol));
  $('subscription').hidden = !visibleNodes.length;
  $('profiles').replaceChildren();
  $('publish-error').hidden = true;
  $('empty').hidden = !!visibleNodes.length;
  $('empty').querySelector('p').textContent = nodes.length ? '没有符合筛选条件的节点。' : '转换完成后，节点会显示在这里。';
  $('result-actions').hidden = !visibleNodes.length;
  $('count').hidden = !nodes.length;
  $('count').textContent = visibleNodes.length === nodes.length ? nodes.length + ' 个' : visibleNodes.length + ' / ' + nodes.length + ' 个';
  $('copy-all').textContent = visibleNodes.length === nodes.length ? '复制全部' : '复制筛选结果';
  renderNodeList();
}

function renderNodeList() {
  const editButton = $('edit-nodes');
  editButton.hidden = !visibleNodes.length && !editingNodes;
  editButton.textContent = editingNodes ? '取消选择' : '选择要移除的节点';
  editButton.setAttribute('aria-expanded', String(editingNodes));
  $('node-management').hidden = !visibleNodes.length && !removedNodes.size && !editingNodes;
  $('remove-nodes').hidden = !editingNodes;
  $('remove-nodes').disabled = true;
  $('restore-nodes').hidden = !removedNodes.size;
  $('removed-count').textContent = removedNodes.size ? '已移除 ' + removedNodes.size + ' 个节点' : '';
  $('nodes').hidden = !(showNodeList || editingNodes) || !visibleNodes.length;
  if ($('nodes').hidden) {
    $('nodes').replaceChildren();
    return;
  }
  const list = document.createDocumentFragment();
  for (const node of visibleNodes) {
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
    if (editingNodes) {
      const label = document.createElement('label');
      label.className = 'remove-choice';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = node.link;
      checkbox.setAttribute('aria-label', '移除 ' + node.name);
      label.append(checkbox, '移除');
      row.append(info, label);
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiet';
      button.textContent = '复制';
      button.setAttribute('aria-label', '复制 ' + node.name);
      button.addEventListener('click', () => copy(node.link, '已复制：' + node.name));
      row.append(info, button);
    }
    list.append(row);
  }
  $('nodes').replaceChildren(list);
}

$('edit-nodes').addEventListener('click', () => {
  editingNodes = !editingNodes;
  renderNodeList();
});
const checkedNodes = () => [...$('nodes').querySelectorAll('input:checked')];
$('nodes').addEventListener('change', () => {
  $('remove-nodes').disabled = !checkedNodes().length;
});
$('remove-nodes').addEventListener('click', () => {
  const selected = checkedNodes();
  if (!selected.length) return;
  for (const checkbox of selected) removedNodes.add(checkbox.value);
  editingNodes = false;
  applyFilter();
  $('restore-nodes').focus();
});
$('restore-nodes').addEventListener('click', () => {
  removedNodes.clear();
  editingNodes = false;
  applyFilter();
  if (!$('edit-nodes').hidden) $('edit-nodes').focus();
});

$('protocol-choices').addEventListener('change', applyFilter);
for (const [id, checked] of [['filter-all', true], ['filter-none', false]]) {
  $(id).addEventListener('click', () => {
    for (const input of protocolChoices()) input.checked = checked;
    applyFilter();
  });
}

const profileLabels = {
  universal: '通用 Base64 / v2rayN',
  verge: 'Clash Verge Rev / Mihomo',
  clash: '旧版 Clash 兼容（过滤 Trojan 等）',
};

function showProfiles(profiles) {
  const list = $('profiles');
  list.replaceChildren();
  for (const [format, label] of Object.entries(profileLabels)) {
    const profile = profiles[format];
    const row = document.createElement('li');
    row.className = 'node profile-row';
    const info = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'node-title';
    title.textContent = label;
    const detail = document.createElement('p');
    detail.className = 'hint';
    detail.textContent = profile.count + ' 个节点' + (profile.skipped ? '，跳过 ' + profile.skipped + ' 个不兼容节点' : '');
    info.append(title, detail);
    row.append(info);
    if (profile.path) {
      const url = new URL(profile.path, location.origin).href;
      const buttons = document.createElement('div');
      buttons.className = 'result-actions';
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'quiet';
      copyButton.textContent = '复制订阅';
      copyButton.setAttribute('aria-label', '复制订阅：' + label);
      copyButton.addEventListener('click', () => copy(url, '已复制订阅地址'));
      buttons.append(copyButton);
      if (format !== 'universal') {
        const importLink = document.createElement('a');
        importLink.className = 'quiet import-link';
        importLink.href = 'clash://install-config?url=' + encodeURIComponent(url) + '&name=allToan';
        importLink.textContent = '一键导入';
        importLink.setAttribute('aria-label', '一键导入：' + label);
        buttons.append(importLink);
      }
      row.append(buttons);
    }
    list.append(row);
  }
}

async function publishSubscription() {
  const button = $('publish-button');
  const errorBox = $('publish-error');
  const selection = visibleNodes;
  if (button.disabled || !selection.length) return;
  errorBox.hidden = true;
  button.disabled = true;
  $('quick-publish').disabled = true;
  button.textContent = '正在生成…';
  try {
    const retained = retainedNodes();
    const endpoint = new URL('/api/subscription', location.origin);
    if (selection.length !== retained.length) endpoint.searchParams.set('protocols', selectedProtocols().join(','));
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: links(retained),
      signal: AbortSignal.timeout(18000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error || '生成订阅失败，请稍后重试。');
    if (visibleNodes !== selection) return;
    showProfiles(data);
    notice('已生成新订阅地址');
  } catch (error) {
    if (visibleNodes !== selection) return;
    errorBox.textContent = error.name === 'TimeoutError' ? '生成订阅超时，请稍后重试。' : error.message;
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
    $('quick-publish').disabled = pending;
    button.textContent = '生成订阅链接';
  }
}

$('publish-form').addEventListener('submit', event => {
  event.preventDefault();
  void publishSubscription();
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (pending) return;
  const value = input.value.trim();
  const headerInput = $('request-headers');
  const sourceInput = $('header-source');
  const headerText = headerInput.value.trim();
  const headerSource = headerText ? Number(sourceInput.value || 1) : 1;
  const quick = e.submitter === $('quick-publish');
  if (!value) { input.focus(); return; }
  pending = true;
  $('error').hidden = true;
  render({ nodes: [] });
  const submit = $('submit');
  const quickButton = $('quick-publish');
  const controls = [submit, quickButton, input, headerInput, sourceInput];
  for (const el of controls) el.disabled = true;
  if (quick) quickButton.textContent = '正在解析节点…';
  else submit.firstChild.textContent = '正在转换… ';
  try {
    const response = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'auto', input: value, headerText, headerSource }),
      signal: AbortSignal.timeout(18000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error || '转换暂时不可用，请稍后重试。');
    render(data, !quick);
    if (quick) {
      quickButton.textContent = '正在生成订阅…';
      await publishSubscription();
      if (!$('subscription').hidden) $('subscription-title').focus();
    } else {
      notice('已提取 ' + data.nodes.length + ' 个节点');
    }
  } catch (error) {
    $('error').textContent = error.name === 'TimeoutError' ? '请求超时，请重试或直接粘贴订阅内容。'
      : error instanceof TypeError ? '无法连接转换服务，请检查网络后重试。' : error.message;
    $('error').hidden = false;
  } finally {
    for (const el of controls) el.disabled = false;
    quickButton.disabled = $('publish-button').disabled;
    quickButton.textContent = '一键生成订阅';
    submit.firstChild.textContent = '解析节点 ';
    pending = false;
  }
});
