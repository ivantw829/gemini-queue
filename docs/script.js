(() => {
  'use strict';

  /* ---------- Theme Toggle ---------- */
  const root = document.documentElement;
  const themeBtn = document.getElementById('themeToggle');
  const sunIcon = document.getElementById('iconSun');
  const moonIcon = document.getElementById('iconMoon');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (sunIcon && moonIcon) {
      sunIcon.style.display = theme === 'dark' ? 'block' : 'none';
      moonIcon.style.display = theme === 'dark' ? 'none' : 'block';
    }
  }

  const savedTheme = localStorage.getItem('gq-docs-theme');
  const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(savedTheme || (systemDark ? 'dark' : 'light'));

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      localStorage.setItem('gq-docs-theme', next);
      applyTheme(next);
    });
  }

  /* ---------- Mobile Navigation ---------- */
  const menuBtn = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');

  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Interactive Hero Demo ---------- */
  const demoStates = {
    full: {
      statusText: '用量已滿',
      statusOk: false,
      fivePct: 100,
      fiveMeta: '預計 15:30 重置（剩餘 1 小時 12 分）',
      weekPct: 42,
      weekMeta: '週日 08:00 重置',
      queueCount: '待送出佇列（1）',
      badgeClass: 'badge badge-waiting',
      badgeText: '等待重置',
      itemTime: '預計 15:30 提醒',
      itemReady: false,
      hint: '目前為「用量已滿」狀態：按下送出後訊息與附件已安全存入本機佇列。'
    },
    reset: {
      statusText: '額度已重置',
      statusOk: true,
      fivePct: 0,
      fiveMeta: '5 小時工作階段已歸零，隨時可送出',
      weekPct: 42,
      weekMeta: '週日 08:00 重置',
      queueCount: '待送出佇列（1）',
      badgeClass: 'badge badge-ready',
      badgeText: '可送出',
      itemTime: '已發出桌面通知',
      itemReady: true,
      hint: '額度已透過 /usage 確認恢復：點桌面通知就會自動開啟原對話並填回文字與附件！'
    },
    sent: {
      statusText: '正常運作中',
      statusOk: true,
      fivePct: 6,
      fiveMeta: '新工作階段倒數中（預計 20:30 重置）',
      weekPct: 43,
      weekMeta: '週日 08:00 重置',
      queueCount: '待送出佇列（0）',
      badgeClass: 'badge badge-sent',
      badgeText: '已送出並清除',
      itemTime: '本機附件已自動 GC',
      itemReady: true,
      hint: '訊息確認出現在對話後，佇列與本機暫存附件立即清除，回到零干擾模式。'
    }
  };

  const els = {
    status: document.getElementById('demoStatus'),
    fivePct: document.getElementById('demoFivePct'),
    fiveFill: document.getElementById('demoFiveFill'),
    fiveMeta: document.getElementById('demoFiveMeta'),
    weekPct: document.getElementById('demoWeekPct'),
    weekFill: document.getElementById('demoWeekFill'),
    weekMeta: document.getElementById('demoWeekMeta'),
    queueCount: document.getElementById('demoQueueCount'),
    queueCard: document.getElementById('demoQueueCard'),
    badge: document.getElementById('demoBadge'),
    itemTime: document.getElementById('demoItemTime'),
    hint: document.getElementById('demoHint')
  };

  const demoBtns = document.querySelectorAll('[data-demo-state]');

  function setDemoState(key) {
    const s = demoStates[key];
    if (!s || !els.status) return;
    els.status.textContent = s.statusText;
    els.status.classList.toggle('ok', s.statusOk);
    els.fivePct.textContent = `${s.fivePct}%`;
    els.fiveFill.style.width = `${s.fivePct}%`;
    els.fiveFill.classList.toggle('full', s.fivePct >= 100);
    els.fiveMeta.textContent = s.fiveMeta;
    els.weekPct.textContent = `${s.weekPct}%`;
    els.weekFill.style.width = `${s.weekPct}%`;
    els.weekMeta.textContent = s.weekMeta;
    els.queueCount.textContent = s.queueCount;
    els.queueCard.classList.toggle('ready', s.itemReady);
    els.badge.className = s.badgeClass;
    els.badge.textContent = s.badgeText;
    els.itemTime.textContent = s.itemTime;
    els.hint.textContent = s.hint;

    demoBtns.forEach((btn) => {
      const active = btn.getAttribute('data-demo-state') === key;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  demoBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      setDemoState(btn.getAttribute('data-demo-state'));
    });
  });

  /* ---------- Install Method Tabs ---------- */
  const tabBtns = document.querySelectorAll('[data-tab-target]');
  const tabPanels = document.querySelectorAll('[data-tab-panel]');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab-target');
      tabBtns.forEach((b) => {
        const isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', String(isActive));
      });
      tabPanels.forEach((panel) => {
        panel.hidden = panel.getAttribute('data-tab-panel') !== target;
      });
    });
  });

  /* ---------- Copy Code Buttons ---------- */
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy');
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        const orig = btn.textContent;
        btn.textContent = '已複製 ✓';
        setTimeout(() => {
          btn.textContent = orig;
        }, 1600);
      } catch {
        // Fallback for older browsers or non-HTTPS local preview
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        const orig = btn.textContent;
        btn.textContent = '已複製 ✓';
        setTimeout(() => {
          btn.textContent = orig;
        }, 1600);
      }
    });
  });

  /* ---------- Scroll Spy for Navigation ---------- */
  const sections = document.querySelectorAll('main section[id]');
  const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

  if ('IntersectionObserver' in window && sections.length && navAnchors.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.getAttribute('id');
          navAnchors.forEach((a) => {
            a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
          });
        });
      },
      { rootMargin: '-25% 0px -65% 0px' }
    );
    sections.forEach((sec) => observer.observe(sec));
  }
})();
