/**
 * 标签组模态框管理器
 * 专门负责标签组编辑模态框的显示、隐藏和交互
 */
import { DialogService, DialogConfig } from '../services/index.ts';
import { focusInput } from '../renderer_utils/index.ts';

export class TagGroupModalManager {
  private app: any;
  private activeModal: boolean;

  constructor(options: { app: any }) {
    this.app = options.app;
    this.activeModal = false;
  }

  init(): void {
    this.bindEvents();
  }

  private bindEvents(): void {
    document.getElementById('closeTagGroupEditModal')?.addEventListener('click', () => this.closeEdit());
    document.getElementById('cancelTagGroupEditBtn')?.addEventListener('click', () => this.closeEdit());
    document.getElementById('saveTagGroupBtn')?.addEventListener('click', () => this.handleSave());
  }

  async openEdit(type: 'prompt' | 'image', groupId: number | null = null): Promise<void> {
    const modal = document.getElementById('tagGroupEditModal');
    if (!modal) return;

    const typeInput = document.getElementById('tagGroupEditType') as HTMLInputElement | null;
    const idInput = document.getElementById('tagGroupEditId') as HTMLInputElement | null;
    const nameInput = document.getElementById('tagGroupEditName') as HTMLInputElement | null;
    const sortOrderInput = document.getElementById('tagGroupEditSortOrder') as HTMLInputElement | null;

    if (typeInput) typeInput.value = type;
    if (idInput) idInput.value = groupId ? String(groupId) : '';
    if (nameInput) {
      nameInput.value = '';
      focusInput(nameInput);
    }
    if (sortOrderInput) sortOrderInput.value = '0';

    if (groupId) {
      const tagRegistry = type === 'prompt' ? this.app.tagRegistry : this.app.imageTagRegistry;
      if (tagRegistry) {
        const groups = await tagRegistry.service.getTagGroups();
        const group = groups.find((g: any) => String(g.id) === String(groupId));
        if (group && nameInput && sortOrderInput) {
          nameInput.value = group.name || '';
          sortOrderInput.value = String(group.sortOrder || '0');
        }
      }
    }

    modal.classList.add('active');
    this.activeModal = true;
  }

  closeEdit(): void {
    const modal = document.getElementById('tagGroupEditModal');
    if (modal) {
      modal.classList.remove('active');
    }
    this.activeModal = false;
  }

  private async handleSave(): Promise<void> {
    const typeInput = document.getElementById('tagGroupEditType') as HTMLInputElement | null;
    const idInput = document.getElementById('tagGroupEditId') as HTMLInputElement | null;
    const nameInput = document.getElementById('tagGroupEditName') as HTMLInputElement | null;
    const sortOrderInput = document.getElementById('tagGroupEditSortOrder') as HTMLInputElement | null;

    const type = typeInput?.value as 'prompt' | 'image';
    const groupId = idInput?.value;
    const name = nameInput?.value.trim() || '';
    const sortOrder = parseInt(sortOrderInput?.value || '0', 10);

    if (!name) {
      this.app.showToast('请输入标签组名称', 'error');
      return;
    }

    try {
      const tagRegistry = type === 'prompt' ? this.app.tagRegistry : this.app.imageTagRegistry;
      if (tagRegistry) {
        if (groupId) {
          await tagRegistry.service.updateGroup(groupId, { name, sortOrder });
        } else {
          await tagRegistry.service.createGroup(name, sortOrder);
        }
        await tagRegistry.render();
        await tagRegistry.refreshPanel();
      }

      this.closeEdit();
      this.app.showToast(groupId ? '标签组已更新' : '标签组已创建', 'success');
    } catch (error: any) {
      window.electronAPI?.logError('TagGroupModalManager.ts', 'Failed to save tag group:', error);
      if (error.message?.includes('DUPLICATE_NAME')) {
        this.closeEdit();
        const name = nameInput?.value || '';
        await DialogService.showConfirmDialogByConfig(
          { ...DialogConfig.TAG_GROUP_DUPLICATE_NAME, type: 'info' },
          { name }
        );
      } else {
        this.app.showToast('保存失败: ' + error.message, 'error');
      }
    }
  }

  isActive(): boolean {
    return this.activeModal;
  }
}

export default TagGroupModalManager;
