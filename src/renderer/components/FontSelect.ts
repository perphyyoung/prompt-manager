/**
 * FontSelect - 搜索式字体家族选择器（设置页「界面字体」）
 *
 * 交互对齐 chat-manager：首次展开才枚举本机字体（Local Font Access API 要求用户手势）、
 * 关键字过滤、过滤后最多渲染 200 项、展开即定位选中项；面板挂 body 用 fixed 定位，
 * Esc 只关面板、不冒泡给 ShortcutManager 关掉设置页。
 */

import { logger } from "../../utils/Logger.ts";
import { filterFonts, fontListWindow, loadFontList } from "../renderer_utils/index.ts";

/** 过滤后最多渲染的项数（本机字体常上千，避免长列表卡顿） */
const MAX_VISIBLE = 200;
/** 定位选中项时，其上方保留的上下文项数 */
const SELECTED_OFFSET = 40;
/** 面板最小宽度（px） */
const PANEL_MIN_WIDTH = 320;

export interface FontSelectOptions {
  /** 挂载容器 id */
  containerId: string;
  /** 选中变化：family 名，空串表示跟随系统 */
  onChange: (fontFamily: string) => void;
}

export class FontSelect {
  private readonly onChange: (fontFamily: string) => void;

  private trigger: HTMLButtonElement | null = null;
  private labelEl: HTMLSpanElement | null = null;
  private panel: HTMLDivElement | null = null;
  private overlay: HTMLDivElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private hintEl: HTMLParagraphElement | null = null;
  private listEl: HTMLUListElement | null = null;

  private families: string[] = [];
  private keyword = "";
  private value = "";
  private opened = false;
  private loading = false;
  private loaded = false;

  constructor(options: FontSelectOptions) {
    this.onChange = options.onChange;

    const container = document.getElementById(options.containerId);
    if (container) {
      this.mount(container);
    }
  }

  /**
   * 同步当前选中值（family 名，空串表示跟随系统）
   */
  setValue(fontFamily: string): void {
    this.value = fontFamily;
    this.updateLabel();
  }

  /**
   * 关闭面板（设置页关闭时调用）
   */
  close(): void {
    if (!this.opened) return;

    this.opened = false;
    document.removeEventListener("keydown", this.handleKeydown, true);
    this.overlay?.remove();
    this.panel?.remove();
    this.overlay = null;
    this.panel = null;
    this.searchInput = null;
    this.hintEl = null;
    this.listEl = null;
  }

  // ==================== 挂载与开关 ====================

  private mount(container: HTMLElement): void {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "font-select__trigger";

    const label = document.createElement("span");
    label.className = "font-select__label";

    const arrow = document.createElement("span");
    arrow.className = "font-select__arrow";
    arrow.textContent = "▾";

    trigger.append(label, arrow);
    trigger.addEventListener("click", () => this.toggle());
    container.appendChild(trigger);

    this.trigger = trigger;
    this.labelEl = label;
    this.updateLabel();
  }

  private updateLabel(): void {
    const text = this.value || "跟随系统";
    if (this.labelEl) {
      this.labelEl.textContent = text;
    }
    this.trigger?.setAttribute("title", text);
  }

  private toggle(): void {
    if (this.opened) {
      this.close();
      return;
    }
    this.open();
  }

  private open(): void {
    const trigger = this.trigger;
    if (!trigger || this.opened) return;

    this.opened = true;
    this.keyword = "";

    const rect = trigger.getBoundingClientRect();

    const overlay = document.createElement("div");
    overlay.className = "font-select__overlay";
    overlay.addEventListener("click", () => this.close());

    const panel = document.createElement("div");
    panel.className = "font-select__panel";
    // 与触发按钮右缘对齐向左展开，避免越出设置弹窗右边界
    panel.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    panel.style.top = `${rect.bottom + 4}px`;
    panel.style.width = `${Math.max(rect.width, PANEL_MIN_WIDTH)}px`;

    const searchBox = document.createElement("div");
    searchBox.className = "font-select__search";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "搜索字体";
    input.addEventListener("input", () => {
      this.keyword = input.value;
      this.renderList();
    });
    searchBox.appendChild(input);

    // 枚举失败提示条固定在列表上方，放列表末尾会看不见
    const hint = document.createElement("p");
    hint.className = "font-select__hint";
    hint.hidden = true;

    const list = document.createElement("ul");
    list.className = "font-select__list";

    panel.append(searchBox, hint, list);
    document.body.append(overlay, panel);

    this.overlay = overlay;
    this.panel = panel;
    this.searchInput = input;
    this.hintEl = hint;
    this.listEl = list;

    // 捕获阶段拦截 Esc：只关面板，不触发 ShortcutManager 关闭设置页
    document.addEventListener("keydown", this.handleKeydown, true);

    input.focus();
    this.renderList();
    void this.loadFonts();
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !this.opened) return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
  };

  // ==================== 数据与渲染 ====================

  /** 首次展开才枚举本机字体（枚举单例由 FontFamilies 保证只执行一次） */
  private async loadFonts(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    this.loading = true;
    this.renderList();

    try {
      const { families, status } = await loadFontList();
      this.families = families;
      if (status === "fallback") {
        this.showHint("未能读取本机字体（授权被拒或环境不支持），以下仅显示内置的常用字体");
      }
    } catch (error) {
      logger.warn("FontSelect", "字体枚举失败", error);
      this.showHint("未能读取本机字体，以下仅显示内置的常用字体");
    } finally {
      this.loading = false;
      if (this.opened) {
        this.renderList();
        this.scrollToSelected();
      }
    }
  }

  private showHint(text: string): void {
    if (this.hintEl) {
      this.hintEl.textContent = text;
      this.hintEl.hidden = false;
    }
  }

  private renderList(): void {
    const list = this.listEl;
    if (!list) return;

    const items: HTMLLIElement[] = [this.createItem("跟随系统", "", !this.value)];

    if (this.loading) {
      items.push(this.createMessage("读取本机字体…"));
    } else {
      const matched = filterFonts(this.families, this.keyword);
      const visible = fontListWindow(matched, this.value, MAX_VISIBLE, SELECTED_OFFSET);
      for (const family of visible) {
        items.push(this.createItem(family, family, family === this.value));
      }
      if (matched.length === 0) {
        items.push(this.createMessage("没有匹配的字体家族"));
      }
    }

    list.replaceChildren(...items);
  }

  private createItem(label: string, value: string, selected: boolean): HTMLLIElement {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = selected ? "font-select__item selected" : "font-select__item";
    button.textContent = label;
    button.addEventListener("click", () => this.pick(value));
    item.appendChild(button);
    return item;
  }

  private createMessage(text: string): HTMLLIElement {
    const item = document.createElement("li");
    item.className = "font-select__empty";
    item.textContent = text;
    return item;
  }

  /** 展开后滚动到当前选中项并居中（无选中或不在窗口内则停在顶部） */
  private scrollToSelected(): void {
    this.listEl
      ?.querySelector<HTMLElement>(".font-select__item.selected")
      ?.scrollIntoView({ block: "center", inline: "nearest" });
  }

  private pick(family: string): void {
    this.value = family;
    this.updateLabel();
    this.onChange(family);
    this.close();
  }
}
