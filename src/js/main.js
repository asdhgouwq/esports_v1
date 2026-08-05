/**
 * RIFT.GG - Main App Entry Point
 * 앱 초기화 및 전체 로직 조율
 */

import { store } from './state/store.js';
import { $, $$, addClass, removeClass, on } from './utils/dom.js';

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
  // 네비 버튼 활성화 상태 업데이트
  const navButtons = $$('.nav button');
  navButtons.forEach(btn => {
    if (btn.getAttribute('data-view') === view) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  // 상태 업데이트
  store.setView(view);
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
  // TODO: 각 뷰의 렌더링 함수 호출
}

// 앱 자동 시작
document.addEventListener('DOMContentLoaded', initApp);
