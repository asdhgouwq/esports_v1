/**
 * RIFT.GG - Global State Management
 * 앱 전역 상태 및 이벤트 에미터
 */

class Store {
  constructor() {
    this.state = {
      theme: localStorage.getItem('theme') || 'dark',
      currentView: 'home',
      filters: {
        league: 'LCK',
        tab: 'upcoming'
      },
      activeMatch: null,
      activeTeam: null,
      homeLeagueFilter: 'LCK'
    };

    this.listeners = {};
  }

  /**
   * 상태 조회
   */
  getState() {
    return { ...this.state };
  }

  /**
   * 상태 업데이트
   */
  setState(path, value) {
    const keys = path.split('.');
    let current = this.state;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;

    this.emit('change', { path, value });
    if (path === 'theme') {
      localStorage.setItem('theme', value);
    }
  }

  /**
   * 이벤트 구독
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  /**
   * 이벤트 발생
   */
  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(data));
  }

  /**
   * 테마 전환
   */
  toggleTheme() {
    const current = this.state.theme;
    const next = current === 'dark' ? 'light' : 'dark';
    this.setState('theme', next);
  }

  /**
   * 현재 뷰 변경
   */
  setView(view) {
    this.setState('currentView', view);
  }

  /**
   * 필터 업데이트
   */
  setFilter(key, value) {
    this.setState(`filters.${key}`, value);
  }
}

export const store = new Store();
