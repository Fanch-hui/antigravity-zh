import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
function mount(body) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${body}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only',
  });
  dom.window.eval(script);
  return dom;
}

test('media actions translate while generated captions and descriptions remain intact', () => {
  const dom = mount(`<div role="dialog" data-testid="media-modal" aria-label="image.png">
    <div data-testid="media-modal-header"><button data-testid="media-modal-copy" title="Copy image" aria-label="Copy image"></button>
      <button data-testid="media-modal-download" title="Download image" aria-label="Download image"></button></div>
    <video data-testid="media-modal-video" aria-label="Enlarged media: Settings"></video>
    <div data-testid="media-modal-title"><div><div class="truncate text-sm font-medium text-white">Settings</div>
      <div class="line-clamp-2 text-xs text-white/70">Downloads</div></div></div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="media-modal-copy"]').title, '复制图片');
  assert.equal(doc.querySelector('[data-testid="media-modal-download"]').getAttribute('aria-label'), '下载图片');
  assert.equal(doc.querySelector('video').getAttribute('aria-label'), '放大的媒体：Settings');
  assert.equal(doc.querySelector('[data-testid="media-modal-title"] .truncate').textContent, 'Settings');
  assert.equal(doc.querySelector('[data-testid="media-modal-title"] .line-clamp-2').textContent, 'Downloads');
  dom.window.close();
});

test('security descriptions translate while certificate fields preserve their original values', () => {
  const dom = mount(`<div role="dialog" data-testid="url-security-popover">
    <span data-testid="url-security-host">Settings</span><span data-testid="url-security-origin">Downloads</span>
    <div class="flex items-start gap-3 px-3 py-2.5 text-xs"><div class="flex flex-col gap-1 min-w-0">
      <span class="text-foreground">Certificate is not valid</span>
      <span class="text-error">This site uses an unsupported TLS protocol or cipher suite.</span>
      <dl data-testid="url-security-certificate"><dt>Issued to</dt><dd>Settings</dd></dl></div></div>
    <div class="flex items-start gap-3 px-3 py-2.5 text-xs"><div class="flex flex-col gap-0.5 min-w-0">
      <span class="text-foreground" data-testid="url-security-summary">Your connection to this site is not fully secure</span></div></div>
    </div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="url-security-host"]').textContent, 'Settings');
  assert.equal(doc.querySelector('[data-testid="url-security-origin"]').textContent, 'Downloads');
  assert.equal(doc.querySelector('[data-testid="url-security-certificate"] dd').textContent, 'Settings');
  assert.equal(doc.querySelector('.gap-1 > .text-foreground').textContent, '证书无效');
  assert.equal(doc.querySelector('.text-error').textContent, '此网站使用了不受支持的 TLS 协议或加密套件。');
  assert.equal(doc.querySelector('[data-testid="url-security-summary"]').textContent, '你与此网站的连接并非完全安全');
  dom.window.close();
});

test('fixed fields in link previews translate without changing the dynamic values or authentication command', () => {
  const dom = mount(`<div role="dialog" data-hover-card-popup="">
    <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs"><span class="text-muted-foreground">From</span>
      <span class="text-foreground min-w-0 break-words">Settings</span><span class="text-muted-foreground">Members</span>
      <span class="text-foreground min-w-0 break-words">Downloads</span></div>
    <div data-testid="github-hover-auth-actions" class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] leading-snug text-muted-foreground">
      <span>Run</span><code class="font-mono">gh auth login</code><span class="whitespace-nowrap">in a terminal</span></div>
    <a data-testid="github-hover-action-url">Grant repository access</a></div>`);
  const doc = dom.window.document;
  const grid = doc.querySelector('.grid');
  assert.deepEqual([...grid.children].map(node => node.textContent), ['发件人','Settings','成员','Downloads']);
  assert.equal(doc.querySelector('code').textContent, 'gh auth login');
  assert.equal(doc.querySelector('[data-testid="github-hover-auth-actions"]').textContent.replace(/\s+/g, ' ').trim(), '运行gh auth login（在终端中）');
  assert.equal(doc.querySelector('[data-testid="github-hover-action-url"]').textContent, '授予仓库访问权限');
  dom.window.close();
});

test('PDF toolbar localizes labels and tooltip changes without translating document text or comment content', async () => {
  const dom = mount(`<div role="dialog"><div class="pdf-sdk-root jetski-pdf-viewer-host">
    <div class="pdf-toolbar pdf-toolbar--nowrap" data-testid="pdf-floating-toolbar" data-jetski-pdf-toolbar="true">
      <button class="action-button" data-testid="toolbar-thumbnail-sidebar-button" aria-label="Show Thumbnail Sidebar" title="Toggle Thumbnails" data-tooltip="Toggle Thumbnails"></button>
      <div class="toolbar-controls toolbar-navigation"><button class="nav-button nav-button-prev" aria-label="Previous Page" title="Previous Page" data-tooltip="Previous Page"></button></div>
      <button class="action-button" data-testid="toolbar-fit-mode-button" aria-label="Fit to Width" title="Fit to Width" data-tooltip="Fit to Width"></button>
      <div class="toolbar-overflow-menu"><div role="menu"><div role="menuitem" class="toolbar-overflow-dropdown-item" aria-label="Thumbnails"></div></div></div></div>
    <div class="pdf-viewport" data-testid="pdf-viewport"><div class="page-container" data-testid="page-container"><div class="textLayer" data-testid="pdf-text-layer"><span>Settings</span></div></div></div>
    <div class="document-comments-floating"><div class="comments-header-bar"><span>Comments (3)</span><div role="none">+ Add</div></div>
      <form><input placeholder="Target text in PDF..."><textarea placeholder="Write a comment...">Settings</textarea><div><button type="submit">Post</button></div></form>
      <div class="no-comments"><div>No comments yet</div><div>Select text in the PDF and click + Add to start commenting.</div></div>
      <div role="button" class="floating-comment-card"><div class="comment-header"><span class="comment-author">Settings</span></div><p class="comment-content">Downloads</p></div></div>
    <div class="pdf-smart-text-notice" role="status"><span>Text selection is paused for smoother viewing. Search, comments, and annotations still work. Use the toolbar text button when selection is needed.</span></div></div></div>
    <button data-tooltip="Fit to Width">untouched</button>`);
  const doc = dom.window.document;
  const fit = doc.querySelector('[data-testid="toolbar-fit-mode-button"]');
  assert.equal(fit.getAttribute('aria-label'), '适合宽度');
  assert.equal(fit.title, '适合宽度');
  assert.equal(fit.getAttribute('data-tooltip'), '适合宽度');
  assert.equal(doc.querySelector('.nav-button-prev').getAttribute('data-tooltip'), '上一页');
  assert.equal(doc.querySelector('[data-testid="toolbar-thumbnail-sidebar-button"]').getAttribute('aria-label'), '显示缩略图侧栏');
  assert.equal(doc.querySelector('.toolbar-overflow-dropdown-item').getAttribute('aria-label'), '缩略图');
  assert.equal(doc.querySelector('[data-testid="pdf-text-layer"]').textContent, 'Settings');
  assert.equal(doc.querySelector('.comment-author').textContent, 'Settings');
  assert.equal(doc.querySelector('.comment-content').textContent, 'Downloads');
  assert.equal(doc.querySelector('.comments-header-bar > span').textContent, '评论（3）');
  assert.equal(doc.querySelector('.comments-header-bar > [role="none"]').textContent, '＋ 添加');
  assert.equal(doc.querySelector('.document-comments-floating input').placeholder, 'PDF 中的目标文字…');
  assert.equal(doc.querySelector('.document-comments-floating textarea').value, 'Settings');
  assert.equal(doc.querySelector('.document-comments-floating form button').textContent, '发布');
  assert.equal(doc.querySelector('.no-comments > div').textContent, '暂无评论');
  assert.match(doc.querySelector('.pdf-smart-text-notice span').textContent, /^为使浏览更流畅/);
  assert.equal(doc.querySelector('body > button').getAttribute('data-tooltip'), 'Fit to Width');
  fit.setAttribute('aria-label', 'Fit to Page');
  fit.setAttribute('title', 'Fit to Page');
  fit.setAttribute('data-tooltip', 'Fit to Page');
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(fit.getAttribute('aria-label'), '适合页面');
  assert.equal(fit.getAttribute('data-tooltip'), '适合页面');
  dom.window.close();
});
