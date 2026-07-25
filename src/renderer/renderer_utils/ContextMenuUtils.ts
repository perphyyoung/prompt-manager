/**
 * 右键菜单项
 */
export interface IContextMenuItem {
  id: string;
  label: string;
  visible?: boolean;
  onClick: () => void;
}

/**
 * 显示右键菜单
 * 每次调用都会动态创建 DOM，交互结束后自动移除
 * @param options - 显示选项
 */
export function showContextMenu(options: {
  x: number;
  y: number;
  items: IContextMenuItem[];
}): void {
  removeExistingMenus();

  const { x, y, items } = options;
  const visibleItems = items.filter((item) => item.visible !== false);

  if (visibleItems.length === 0) {
    return;
  }

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.position = 'fixed';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.zIndex = '10000';
  menu.innerHTML = visibleItems
    .map(
      (item) => `
      <div class="context-menu-item" data-item-id="${item.id}">
        <span class="context-menu-label">${item.label}</span>
      </div>
    `
    )
    .join('');

  document.body.appendChild(menu);
  adjustMenuPosition(menu);

  menu.addEventListener('click', (e) => {
    const menuItem = (e.target as HTMLElement).closest('.context-menu-item') as HTMLElement | null;
    if (!menuItem) return;

    const item = visibleItems.find((i) => i.id === menuItem.dataset.itemId);
    if (item) {
      item.onClick();
    }
    removeExistingMenus();
  });

  const closeMenu = (e: Event) => {
    if (!menu.contains(e.target as Node)) {
      removeExistingMenus();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 0);

  const hideOnChange = () => removeExistingMenus();
  window.addEventListener('resize', hideOnChange, { once: true });
  window.addEventListener('scroll', hideOnChange, { once: true, capture: true });
}

/**
 * 移除已存在的右键菜单
 */
function removeExistingMenus(): void {
  document.querySelectorAll('.context-menu').forEach((el) => el.remove());
}

/**
 * 调整菜单位置，确保不超出视口
 * @param menu - 菜单元素
 */
function adjustMenuPosition(menu: HTMLElement): void {
  const rect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = parseInt(menu.style.left || '0', 10);
  let top = parseInt(menu.style.top || '0', 10);

  if (left + rect.width > viewportWidth) {
    left = viewportWidth - rect.width - 10;
  }

  if (top + rect.height > viewportHeight) {
    top = viewportHeight - rect.height - 10;
  }

  left = Math.max(10, left);
  top = Math.max(10, top);

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}
