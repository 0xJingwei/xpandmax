'use strict';
const toggle = document.getElementById('demo-toggle');
const demo = document.getElementById('feed-demo');
if (toggle && demo) {
  toggle.addEventListener('click', () => {
    const enabled = toggle.getAttribute('aria-checked') !== 'true';
    toggle.setAttribute('aria-checked', String(enabled));
    demo.classList.toggle('counts-off', !enabled);
  });
}

// 示例仅改变本页展示，不连接 X 或实际关注账号。
for (const button of document.querySelectorAll('.demo-follow')) {
  button.addEventListener('click', () => {
    button.textContent = 'Following';
    button.disabled = true;
  });
}
for (const button of document.querySelectorAll('.demo-bio')) {
  button.addEventListener('click', () => {
    const opened = button.getAttribute('aria-expanded') !== 'true';
    for (const other of document.querySelectorAll('.demo-bio')) {
      other.setAttribute('aria-expanded', 'false');
      other.closest('.post-body').querySelector('.demo-bio-full').hidden = true;
    }
    button.setAttribute('aria-expanded', String(opened));
    button.closest('.post-body').querySelector('.demo-bio-full').hidden = !opened;
  });
}
