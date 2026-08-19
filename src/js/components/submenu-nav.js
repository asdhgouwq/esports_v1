import { MENUS, navigateTo } from '../router.js';

export function renderSubmenuNav(activeLeague, activePage) {
  const menuItems = MENUS.map(menu => {
    const active = menu.id === activePage ? ' aria-current="page"' : '';
    return `
      <button class="submenu-btn" data-page="${menu.id}"${active}>
        ${menu.label}
      </button>
    `;
  }).join('');

  return menuItems;
}

export function bindSubmenuNavEvents(container, currentLeague) {
  container.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', e => {
      const page = e.currentTarget.getAttribute('data-page');
      navigateTo(currentLeague, page);
    });
  });
}
