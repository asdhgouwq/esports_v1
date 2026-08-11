/**
 * RIFT.GG - Main App Entry Point
 * 앱 초기화 및 전체 로직 조율
 */

import { store } from './state/store.js';
import { $, $$, addClass, removeClass, on } from './utils/dom.js';
import { renderHome } from './views/home.js';
import { renderSchedule } from './views/schedule.js';
import { renderStandings } from './views/standings.js';
import { renderTeams } from './views/teams.js';
import { renderAnalysis } from './views/analysis.js';

/**
 * 앱 초기화
 */
export function initApp() {
  initTheme();
  initNavigation();
  initEventListeners();
  renderInitialView();
}

/**
 * 테마 초기화 및 설정
 */
function initTheme() {
  const html = document.documentElement;
  html.setAttribute('data-theme', store.state.theme);

  // 테마 변경 리스너
  store.on('change', ({ path, value }) => {
    if (path === 'theme') {
      html.setAttribute('data-theme', value);
    }
  });
}

/**
 * 네비게이션 설정
 */
function initNavigation() {
  const navButtons = $$('.nav button');

  navButtons.forEach(btn => {
    on(btn, 'click', () => {
      const view = btn.getAttribute('data-view');
      setActiveView(view);
    });
  });
}

/**
 * 이벤트 리스너 설정
 */
function initEventListeners() {
  const themeBtn = $('#themeBtn');
  if (themeBtn) {
    on(themeBtn, 'click', () => store.toggleTheme());
  }

  // 상태 변경 감지
  store.on('change', ({ path }) => {
    if (path === 'currentView') {
      updateViewDisplay();
    }
  });
}

/**
 * 활성 뷰 설정
 */
function setActiveView(view) {
  const navButtons = $$('.nav button');
  navButtons.forEach(btn => {
    if (btn.getAttribute('data-view') === view) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  store.setView(view);
  renderViewContent(view);
}

/**
 * 뷰 표시 업데이트
 */
function updateViewDisplay() {
  const currentView = store.state.currentView;
  const sections = $$('.view');

  sections.forEach(section => {
    const viewId = section.getAttribute('id');
    const expectedId = `view-${currentView}`;

    if (viewId === expectedId) {
      addClass(section, 'is-active');
      section.style.display = 'block';
    } else {
      removeClass(section, 'is-active');
      section.style.display = 'none';
    }
  });
}

/**
 * 초기 뷰 렌더링
 */
function renderInitialView() {
  setActiveView('home');
  renderViewContent('home');
}

/**
 * 뷰 컨텐츠 렌더링
 */
function renderViewContent(view) {
  switch(view) {
    case 'home': renderHome(); break;
    case 'schedule': renderSchedule(); break;
    case 'standings': renderStandings(); break;
    case 'teams': renderTeams(); break;
    case 'ai': renderAnalysis(); break;
  }
}

// 앱 자동 시작
document.addEventListener('DOMContentLoaded', initApp);
