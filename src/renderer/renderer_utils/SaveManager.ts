import { Constants } from "../constants.ts";
import { logger } from "../../utils/Logger.ts";
import { SaveStrategy } from "./SaveStrategy.ts";

interface FieldConfig {
  fieldId?: string;
  saveMode?: "debounce" | "immediate" | "manual";
  delay?: number;
  elementId?: string;
  getValue?: (element: HTMLElement) => unknown;
  validate?: (
    value: unknown,
    fieldId: string,
  ) => Promise<{ valid: boolean; error?: string }> | { valid: boolean; error?: string };
  beforeSave?: (value: unknown) => Promise<unknown> | unknown;
  onChange?: (value: unknown) => void | Promise<void>;
  autoResize?: boolean;
  statusId?: string;
}

interface SaveResult {
  success: boolean;
  fieldId?: string;
  value?: unknown;
  unchanged?: boolean;
  error?: string;
  reason?: string;
}

interface EventListenerInfo {
  element: HTMLElement;
  listeners: Array<{ event: string; fn: EventListener }>;
}

/**
 * 保存管理器
 * 管理表单字段的自动保存，支持多种保存策略
 * 集成字段变更追踪功能
 */
export class SaveManager {
  private strategy: SaveStrategy;
  private onAfterSave?: (fieldId: string, value: unknown) => void | Promise<void>;
  private itemId?: string;

  private fields: Map<string, FieldConfig> = new Map();
  private originalValues: Map<string, unknown> = new Map();
  private currentValues: Map<string, unknown> = new Map();
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private eventListeners: Map<string, EventListenerInfo> = new Map();

  private isSaving = false;

  constructor(options: {
    strategy: SaveStrategy;
    onAfterSave?: (fieldId: string, value: unknown) => void | Promise<void>;
    itemId?: string;
  }) {
    this.strategy = options.strategy;
    this.onAfterSave = options.onAfterSave;
    this.itemId = options.itemId;
  }

  /**
   * 注册字段
   */
  registerField(fieldId: string, config: FieldConfig = {} as FieldConfig): void {
    const {
      saveMode = "debounce",
      delay = 800,
      elementId,
      getValue,
      validate,
      beforeSave,
      onChange,
      autoResize,
      statusId,
    } = config;

    // 获取初始值
    const element = elementId ? document.getElementById(elementId) : null;
    const initialValue = element ? this.getFieldValue(element, getValue) : null;

    // 存储字段配置
    this.fields.set(fieldId, {
      fieldId,
      saveMode,
      delay,
      elementId,
      getValue,
      validate,
      beforeSave,
      onChange,
      autoResize,
      statusId,
    });

    // 初始化值
    this.originalValues.set(fieldId, initialValue);
    this.currentValues.set(fieldId, initialValue);

    // 绑定事件
    if (element) {
      this.bindFieldEvents(element, fieldId, this.fields.get(fieldId)!);
    }
  }

  /**
   * 绑定字段事件
   */
  private bindFieldEvents(element: HTMLElement, fieldId: string, config: FieldConfig): void {
    const { saveMode, autoResize, onChange, getValue } = config;
    const listeners: Array<{ event: string; fn: EventListener }> = [];

    // 自动调整高度
    if (autoResize && element.tagName === "TEXTAREA") {
      const autoResizeFn = () => {
        const textarea = element as HTMLTextAreaElement;
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
      };
      element.addEventListener("input", autoResizeFn);
      listeners.push({ event: "input", fn: autoResizeFn });
      autoResizeFn();
    }

    // 根据保存模式绑定事件
    switch (saveMode) {
      case "debounce": {
        const inputFn = () => {
          const newValue = this.getFieldValue(element, getValue);
          this.handleFieldChange(fieldId, newValue);
        };
        const blurFn = () => {
          this.saveField(fieldId, this.getFieldValue(element, getValue));
        };
        element.addEventListener("input", inputFn);
        element.addEventListener("blur", blurFn);
        listeners.push({ event: "input", fn: inputFn }, { event: "blur", fn: blurFn });
        break;
      }

      case "immediate": {
        const changeFn = async () => {
          const newValue = this.getFieldValue(element, getValue);
          this.currentValues.set(fieldId, newValue);
          const result = await this.saveField(fieldId, newValue, this.itemId);
          if (result.success && onChange) {
            onChange(newValue);
          }
        };
        element.addEventListener("change", changeFn);
        listeners.push({ event: "change", fn: changeFn });
        break;
      }

      case "manual":
      default:
        // 手动保存模式，只触发 onChange 回调
        if (onChange) {
          const changeFn = () => {
            const newValue = this.getFieldValue(element, getValue);
            onChange(newValue);
          };
          element.addEventListener("change", changeFn);
          listeners.push({ event: "change", fn: changeFn });
        }
        break;
    }

    // 存储监听器用于清理
    this.eventListeners.set(fieldId, { element, listeners });
  }

  /**
   * 获取字段值
   */
  getFieldValue(element: HTMLElement, getValue?: (element: HTMLElement) => unknown): unknown {
    if (getValue) {
      return getValue(element);
    }
    return this.strategy.getFieldValue(element);
  }

  /**
   * 处理字段变更
   */
  private handleFieldChange(fieldId: string, value: unknown): void {
    const field = this.fields.get(fieldId);
    if (!field) return;

    // 更新当前值
    this.currentValues.set(fieldId, value);

    // 防抖保存
    if (field.saveMode === "debounce") {
      this.debounceSave(fieldId, value, field.delay || 800);
    }
  }

  /**
   * 防抖保存
   */
  private debounceSave(fieldId: string, value: unknown, delay: number): void {
    // 清除之前的定时器
    if (this.debounceTimers.has(fieldId)) {
      clearTimeout(this.debounceTimers.get(fieldId));
    }

    // 设置新定时器
    const timer = setTimeout(() => {
      this.saveField(fieldId, value);
      this.debounceTimers.delete(fieldId);
    }, delay);

    this.debounceTimers.set(fieldId, timer);
  }

  /**
   * 检查字段是否有变化
   */
  hasChanged(fieldId: string): boolean {
    const original = this.originalValues.get(fieldId);
    const current = this.currentValues.get(fieldId);
    return original !== current;
  }

  /**
   * 获取所有变更的字段
   */
  getChanges(): Record<string, unknown> {
    const changes: Record<string, unknown> = {};
    for (const [fieldId, currentValue] of this.currentValues.entries()) {
      const originalValue = this.originalValues.get(fieldId);
      if (currentValue !== originalValue) {
        changes[fieldId] = currentValue;
      }
    }
    return changes;
  }

  /**
   * 更新原始值（保存成功后调用）
   */
  setOriginal(fieldId: string, value: unknown): void {
    this.originalValues.set(fieldId, value);
    this.currentValues.set(fieldId, value);
  }

  /**
   * 保存单个字段
   */
  async saveField(fieldId: string, value: unknown, itemId?: string): Promise<SaveResult> {
    if (this.isSaving) return { success: false, reason: "saving_in_progress" };

    const field = this.fields.get(fieldId);
    if (!field) {
      logger.warn("SaveManager", `Field ${fieldId} not registered, skipping save`);
      return { success: false, fieldId, error: "Field not registered" };
    }

    const statusEl = field.statusId ? document.getElementById(field.statusId) : null;

    // 检查字段是否有变化，没有变化则不保存
    if (!this.hasChanged(fieldId)) {
      return { success: true, fieldId, value, unchanged: true };
    }

    this.isSaving = true;
    try {
      // 执行 beforeSave 钩子
      let finalValue = value;
      if (field.beforeSave) {
        finalValue = await field.beforeSave(value);
      }

      // 执行验证
      if (field.validate) {
        const validationResult = await field.validate(finalValue, fieldId);
        if (!validationResult.valid) {
          throw new Error(validationResult.error || "Validation failed");
        }
      }

      // 执行保存
      const result = await this.strategy.save(itemId || this.itemId || "", fieldId, finalValue);

      if (result.success) {
        // 更新原始值
        this.setOriginal(fieldId, finalValue);

        // 显示成功状态
        this.setStatus(statusEl, "success");

        // 执行 onChange 回调
        if (field.onChange) {
          await field.onChange(finalValue);
        }

        // 执行保存后回调
        if (this.onAfterSave) {
          await this.onAfterSave(fieldId, finalValue);
        }
      }

      return { success: true, fieldId, value: finalValue };
    } catch (error) {
      logger.error("SaveManager", `Failed to save ${fieldId}:`, error);
      this.setStatus(statusEl, "error", (error as Error).message);
      return { success: false, fieldId, error: (error as Error).message };
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * 手动触发字段保存（用于按钮等需要立即保存的场景）
   */
  async triggerSave(fieldId: string, value: unknown, itemId?: string): Promise<SaveResult> {
    // 更新当前值
    this.currentValues.set(fieldId, value);
    return await this.saveField(fieldId, value, itemId);
  }

  /**
   * 保存所有变更的字段
   */
  async saveAll(
    itemId?: string,
  ): Promise<{ success: boolean; message?: string; results?: SaveResult[] }> {
    const changes = this.getChanges();
    const changedFieldIds = Object.keys(changes);

    if (changedFieldIds.length === 0) {
      return { success: true, message: "No changes to save" };
    }

    const results: SaveResult[] = [];

    for (const fieldId of changedFieldIds) {
      // 跳过未在 SaveManager 中注册的字段
      if (!this.fields.has(fieldId)) {
        continue;
      }
      const value = changes[fieldId];
      const result = await this.saveField(fieldId, value, itemId);
      results.push(result);
    }

    return { success: true, results };
  }

  /**
   * 设置状态显示
   */
  private setStatus(element: HTMLElement | null, status: "success" | "error", message = ""): void {
    if (!element) return;

    element.className = `save-status save-status-${status}`;

    switch (status) {
      case "success":
        element.textContent = Constants.STATUS_SAVED;
        setTimeout(() => {
          element.className = "save-status";
          element.textContent = "";
        }, 1000);
        break;
      case "error":
        element.textContent = message || Constants.STATUS_SAVE_FAILED;
        break;
    }
  }

  /**
   * 清理资源
   */
  destroy(): void {
    // 清除所有定时器
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // 移除所有事件监听器
    for (const { element, listeners } of this.eventListeners.values()) {
      for (const { event, fn } of listeners) {
        element.removeEventListener(event, fn);
      }
    }
    this.eventListeners.clear();

    this.fields.clear();
    this.originalValues.clear();
    this.currentValues.clear();
  }
}
