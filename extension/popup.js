(() => {
  'use strict';
  const controls = [
    { key: 'hideNotificationCount', id: 'hide-notification-count', label: '通知数字', defaultValue: true },
    { key: 'hideLeftSidebar', id: 'hide-left-sidebar', label: '左侧导航', defaultValue: false },
    { key: 'hideSidebarRecommendations', id: 'hide-sidebar-recommendations', label: '右侧栏', defaultValue: true }
  ];
  const status = document.getElementById('status');
  const defaults = Object.fromEntries(controls.map(({ key, defaultValue }) => [key, defaultValue]));
  chrome.storage.local.get(defaults, settings => {
    if (chrome.runtime.lastError) { status.textContent = '读取设置失败，请重新打开插件'; return; }
    for (const { key, id, label } of controls) {
      const toggle = document.getElementById(id);
      let saved = typeof settings[key] === 'boolean' ? settings[key] : defaults[key];
      toggle.checked = saved;
      toggle.disabled = false;
      toggle.addEventListener('change', () => {
        const next = toggle.checked;
        toggle.disabled = true;
        chrome.storage.local.set({ [key]: next }, () => {
          if (chrome.runtime.lastError) {
            toggle.checked = saved;
            status.textContent = '设置未保存，请重试';
          } else {
            saved = next;
            status.textContent = `${saved ? '已隐藏' : '已恢复显示'}${label}`;
          }
          toggle.disabled = false;
        });
      });
    }
    status.textContent = '设置自动保存，切换后立即生效';
  });
})();
