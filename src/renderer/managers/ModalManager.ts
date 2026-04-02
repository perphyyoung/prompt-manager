import { Constants } from '../../constants.ts';
import { focusInput } from '../renderer_utils/index.ts';
import type { IInputResult } from '../app.types.ts';

/**
 * 输入选项接口
 */
interface IInputOptions {
  multiline?: boolean;
  showGroupSelect?: boolean;
  groups?: Array<{ id: string | number; name: string }>;
  defaultGroupId?: string | number;
}

/**
 * 内部输入结果接口（包含 groupId）
 */
interface IInternalInputResult extends IInputResult {
  groupId: number | null;
}

/**
 * 选择选项接口
 */
interface ISelectOption {
  value: string;
  label: string;
}

/**
 * ModalManager 构造选项
 */
interface IModalManagerOptions {
  app: unknown;
}

/**
 * 回收站模态框配置
 */
interface ITrashModalConfig {
  modalId: string;
  name: string;
}

/**
 * 模态框管理器
 * 负责管理通用模态框的显示/隐藏和交互
 */
export class ModalManager {
  private app: unknown;

  // 模态框状态
  private activeModals: Set<string>;

  // 回调函数存储
  private confirmCallbacks: Map<string, (value: boolean) => void>;
  private inputCallbacks: Map<string, (value: string | IInternalInputResult | null) => void>;
  private selectCallbacks: Map<string, (value: string | null) => void>;

  /**
   * 回收站模态框配置
   */
  private static readonly TRASH_MODAL_CONFIG: Record<string, ITrashModalConfig> = {
    [Constants.TrashType.PROMPT]: { modalId: 'promptTrashModal', name: 'promptTrashModal' },
    [Constants.TrashType.IMAGE]: { modalId: 'imageTrashModal', name: 'imageTrashModal' }
  };

  constructor(options: IModalManagerOptions) {
    this.app = options.app;

    // 模态框状态
    this.activeModals = new Set<string>();

    // 回调函数存储
    this.confirmCallbacks = new Map<string, (value: boolean) => void>();
    this.inputCallbacks = new Map<string, (value: string | IInputResult | null) => void>();
    this.selectCallbacks = new Map<string, (value: string | null) => void>();
  }

  /**
   * 初始化
   */
  init(): void {
    this.bindEvents();
  }

  /**
   * 绑定事件
   * @private
   */
  private bindEvents(): void {
    // 输入模态框
    document.getElementById('closeInputModal')?.addEventListener('click', () => this.closeInput());
    document.getElementById('inputCancelBtn')?.addEventListener('click', () => this.closeInput());
    document.getElementById('inputOkBtn')?.addEventListener('click', () => this.handleInputOk());

    // 选择模态框
    document.getElementById('closeSelectModal')?.addEventListener('click', () => this.closeSelect());
    document.getElementById('selectCancelBtn')?.addEventListener('click', () => this.closeSelect());
    document.getElementById('selectOkBtn')?.addEventListener('click', () => this.handleSelectOk());

    // 设置模态框
    document.getElementById('closeSettingsModal')?.addEventListener('click', () => this.closeSettings());

    // 回收站模态框
    document.getElementById('closePromptTrashModal')?.addEventListener('click', () => this.closeTrashModal(Constants.TrashType.PROMPT));
    document.getElementById('closeImageTrashModal')?.addEventListener('click', () => this.closeTrashModal(Constants.TrashType.IMAGE));

    // 标签管理器模态框
    document.getElementById('closePromptTagManagerModal')?.addEventListener('click', () => this.closePromptTagManager());
    document.getElementById('closeImageTagManagerModal')?.addEventListener('click', () => this.closeImageTagManager());
  }

  /**
   * 显示输入对话框
   * @param title - 标题
   * @param label - 输入标签
   * @param defaultValue - 默认值
   * @param options - 选项
   * @returns 输入值，取消返回 null
   */
  showInput(title: string, label: string, defaultValue: string = '', options: IInputOptions = {}): Promise<string | IInternalInputResult | null> {
    return new Promise((resolve) => {
      const modal = document.getElementById('inputModal');
      const modalTitle = document.getElementById('inputModalTitle');
      const inputLabel = document.getElementById('inputModalLabel');
      const input = document.getElementById('inputModalField') as HTMLInputElement | HTMLTextAreaElement | null;
      const groupSection = document.getElementById('inputModalGroupSection');
      const groupSelect = document.getElementById('inputModalGroupSelect') as HTMLSelectElement | null;

      if (!modal || !input) {
        resolve(null);
        return;
      }

      if (modalTitle) modalTitle.textContent = title;
      if (inputLabel) inputLabel.textContent = label;
      input.value = defaultValue;

      // 将光标移到末尾
      setTimeout(() => {
        input.selectionStart = input.selectionEnd = input.value.length;
      }, 0);

      // 设置输入类型
      if (options.multiline) {
        (input as HTMLTextAreaElement).rows = 4;
      } else {
        (input as HTMLTextAreaElement).rows = 1;
      }

      // 处理组选择
      if (options.showGroupSelect && groupSection && groupSelect) {
        groupSection.style.display = 'block';
        // 清空并填充组选项
        groupSelect.innerHTML = '<option value="">未分组</option>';
        if (options.groups) {
          options.groups.forEach(group => {
            const option = document.createElement('option');
            option.value = String(group.id);
            option.textContent = group.name;
            groupSelect.appendChild(option);
          });
        }
        // 设置默认选中
        groupSelect.value = options.defaultGroupId ? String(options.defaultGroupId) : '';
      } else if (groupSection) {
        groupSection.style.display = 'none';
      }

      modal.style.display = 'flex';
      this.activeModals.add('inputModal');

      // 聚焦输入框
      focusInput(input);

      // 存储回调
      this.inputCallbacks.set('inputModal', resolve);
    });
  }

  /**
   * 关闭输入对话框
   * @param value - 输入值
   */
  closeInput(value: string | null = null): void {
    const modal = document.getElementById('inputModal');
    const groupSection = document.getElementById('inputModalGroupSection');
    const groupSelect = document.getElementById('inputModalGroupSelect') as HTMLSelectElement | null;

    if (modal) {
      modal.style.display = 'none';
    }

    const callback = this.inputCallbacks.get('inputModal');
    if (callback) {
      // 如果显示了组选择，返回对象包含 value 和 groupId
      if (groupSection && groupSection.style.display !== 'none' && groupSelect) {
        callback({
          value: value || '',
          confirmed: true,
          groupId: groupSelect.value ? parseInt(groupSelect.value, 10) : null
        });
      } else {
        callback(value);
      }
      this.inputCallbacks.delete('inputModal');
    }

    this.activeModals.delete('inputModal');
  }

  /**
   * 处理输入确定
   * @private
   */
  private handleInputOk(): void {
    const input = document.getElementById('inputModalField') as HTMLInputElement | null;
    const value = input ? input.value.trim() : '';
    this.closeInput(value);
  }

  /**
   * 显示选择对话框
   * @param title - 标题
   * @param options - 选项列表
   * @param defaultValue - 默认值
   * @returns 选择的值，取消返回 null
   */
  showSelect(title: string, options: ISelectOption[], defaultValue: string = ''): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = document.getElementById('selectModal');
      const modalTitle = document.getElementById('selectModalTitle');
      const select = document.getElementById('selectModalSelect') as HTMLSelectElement | null;

      if (!modal || !select) {
        resolve(null);
        return;
      }

      if (modalTitle) modalTitle.textContent = title;

      // 清空并填充选项
      select.innerHTML = '';
      options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === defaultValue) {
          option.selected = true;
        }
        select.appendChild(option);
      });

      modal.style.display = 'flex';
      this.activeModals.add('selectModal');

      // 存储回调
      this.selectCallbacks.set('selectModal', resolve);
    });
  }

  /**
   * 关闭选择对话框
   * @param value - 选择的值
   */
  closeSelect(value: string | null = null): void {
    const modal = document.getElementById('selectModal');
    if (modal) {
      modal.style.display = 'none';
    }

    const callback = this.selectCallbacks.get('selectModal');
    if (callback) {
      callback(value);
      this.selectCallbacks.delete('selectModal');
    }

    this.activeModals.delete('selectModal');
  }

  /**
   * 处理选择确定
   * @private
   */
  private handleSelectOk(): void {
    const select = document.getElementById('selectModalSelect') as HTMLSelectElement | null;
    const value = select ? select.value : null;
    this.closeSelect(value);
  }

  /**
   * 打开设置模态框
   */
  async openSettings(): Promise<void> {
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.classList.add('active');
      this.activeModals.add('settingsModal');
    }
  }

  /**
   * 关闭设置模态框
   */
  closeSettings(): void {
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.classList.remove('active');
    }
    this.activeModals.delete('settingsModal');
  }

  /**
   * 打开回收站模态框
   * @param type - 类型
   */
  openTrashModal(type: string = Constants.TrashType.PROMPT): void {
    const config = ModalManager.TRASH_MODAL_CONFIG[type];
    if (!config) return;

    const modal = document.getElementById(config.modalId);
    if (modal) {
      modal.style.display = 'flex';
      this.activeModals.add(config.name);
    }
  }

  /**
   * 关闭回收站模态框
   * @param type - 类型
   */
  closeTrashModal(type: string = Constants.TrashType.PROMPT): void {
    const config = ModalManager.TRASH_MODAL_CONFIG[type];
    if (!config) return;

    const modal = document.getElementById(config.modalId);
    if (modal) {
      modal.style.display = 'none';
    }
    this.activeModals.delete(config.name);
  }

  /**
   * 打开提示词标签管理器模态框
   */
  openPromptTagManager(): void {
    const modal = document.getElementById('promptTagManagerModal');
    if (modal) {
      modal.classList.add('active');
      this.activeModals.add('promptTagManagerModal');
    }
  }

  /**
   * 关闭提示词标签管理器模态框
   */
  closePromptTagManager(): void {
    const modal = document.getElementById('promptTagManagerModal');
    if (modal) {
      modal.classList.remove('active');
    }
    this.activeModals.delete('promptTagManagerModal');
  }

  /**
   * 打开图像标签管理器模态框
   */
  openImageTagManager(): void {
    const modal = document.getElementById('imageTagManagerModal');
    if (modal) {
      modal.classList.add('active');
      this.activeModals.add('imageTagManagerModal');
    }
  }

  /**
   * 关闭图像标签管理器模态框
   */
  closeImageTagManager(): void {
    const modal = document.getElementById('imageTagManagerModal');
    if (modal) {
      modal.classList.remove('active');
    }
    this.activeModals.delete('imageTagManagerModal');
  }

  /**
   * 关闭所有模态框
   */
  closeAll(): void {
    this.activeModals.forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
      }
    });

    this.activeModals.clear();
    this.confirmCallbacks.clear();
    this.inputCallbacks.clear();
    this.selectCallbacks.clear();
  }

  /**
   * 检查是否有模态框处于活动状态
   * @returns 是否有活动模态框
   */
  hasActiveModal(): boolean {
    return this.activeModals.size > 0;
  }
}
