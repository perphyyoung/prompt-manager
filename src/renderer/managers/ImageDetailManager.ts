/**
 * 图像详情管理器
 * 负责管理图像详情模态框
 */
import { DetailViewManager } from "./DetailViewManager.ts";
import type { IDetailTagManager } from "../../types/entities.ts";
import { HtmlUtils, validateFileName, cacheManager } from "../../utils/index.ts";
import { SaveManager, ImageSaveStrategy, ErrorHandler } from "../renderer_utils/index.ts";
import { Constants, Events } from "../../constants.ts";
import { TagAutocomplete, DialogService, DialogConfig, TagService } from "../services/index.ts";
import { IImage, IPrompt } from "../../types/entities.ts";
import type { DetailViewManagerDeps } from "../app.types.ts";
import { showContextMenu } from "../renderer_utils/ContextMenuUtils.ts";
import { createDetailTagController } from "./DetailTagController.ts";

// 选项接口
interface IOpenOptions {
  filteredList?: IImage[];
  returnToManager?: DetailViewManager<IImage> | null;
  returnToItem?: unknown;
}

interface IImageDetailManagerOptions {
  app: DetailViewManagerDeps;
}

export class ImageDetailManager extends DetailViewManager<IImage> {
  private tagAutocomplete: TagAutocomplete | null = null;
  private imageSaveManager: SaveManager | null = null;
  private favoriteBtnHandler: (() => void) | null = null;
  private returnToManager: DetailViewManager<IImage> | null = null;
  private returnToItem: unknown = null;
  private returnToOptions: IOpenOptions = {};
  private currentDetailPromptId: string | null = null;
  private currentDetailPromptRefs: IPrompt[] = [];
  private currentTags: string[] = [];

  constructor(options: IImageDetailManagerOptions) {
    super({
      app: options.app,
      modalId: Constants.Ids.IMAGE_DETAIL_MODAL,
      closeBtnId: Constants.Ids.IMAGE_DETAIL_CLOSE_BTN,
    });
  }

  /**
   * 打开图像详情模态框
   * @param item - 图像对象
   * @param options - 选项
   */
  async open(item: IImage, options: IOpenOptions = {}): Promise<void> {
    const image = item;
    const modal = document.getElementById(this.modalId);
    if (!modal) {
      window.electronAPI.logError("ImageDetailManager.ts", "Image detail modal not found");
      return;
    }

    this.returnToManager = options.returnToManager || null;
    this.returnToItem = options.returnToItem;
    this.returnToOptions = options;
    this.app.isFromDetailJump = !!options.returnToManager || this.app.isFromDetailJump;

    try {
      // 从缓存获取最新的图像数据，确保 isSafe 是最新的
      const latestImage = cacheManager.getCachedImage(image.id) || image;

      this.currentItem = latestImage;

      this.fillFormData(latestImage);

      this.setSafeState(latestImage.isSafe === 1);

      // 更新收藏按钮
      this.updateFavoriteBtnUI(!!latestImage.isFavorite);

      // 渲染图像信息
      await this.renderImageInfo(latestImage);

      // 初始化标签管理器
      this.initTagManager(latestImage);

      // 渲染关联提示词信息
      await this.renderPromptInfo(latestImage);

      // 初始化保存管理器
      this.initSaveManager(latestImage);

      // 初始化导航器
      await this.initNavigatorForImage(latestImage, options);

      // 初始化图像右键菜单
      this.initImageContextMenu();

      // 显示模态框
      this.showModal();

      // 自动调整文本框高度
      const noteInput = document.getElementById(Constants.Ids.IMAGE_DETAIL_NOTE);
      if (noteInput) {
        this.app.autoResizeTextarea(noteInput);
      }
    } catch (error) {
      ErrorHandler.handleError(
        { module: "ImageDetailManager.ts", operation: "open image detail modal" },
        error,
        { userMessage: "打开图像详情失败" },
      );
    }
  }

  /**
   * 填充表单数据
   * @param image - 图像对象
   * @private
   */
  private fillFormData(image: IImage): void {
    const fileNameInput = document.getElementById(
      Constants.Ids.IMAGE_DETAIL_FILE_NAME,
    ) as HTMLInputElement | null;
    if (fileNameInput) {
      fileNameInput.value = image.fileName || "";
    }

    const noteInput = document.getElementById(
      Constants.Ids.IMAGE_DETAIL_NOTE,
    ) as HTMLTextAreaElement | null;
    if (noteInput) {
      noteInput.value = image.note || "";
    }
  }

  /**
   * 获取导航按钮前缀
   * @returns 前缀
   */
  getNavButtonPrefix(): string {
    return "imageDetail";
  }

  /**
   * 获取收藏按钮元素 ID
   * @returns 收藏按钮的元素 ID
   */
  protected getFavoriteBtnId(): string {
    return Constants.Ids.IMAGE_DETAIL_FAVORITE_BTN;
  }

  /**
   * 获取安全状态切换元素 ID
   * @returns 安全状态切换的元素 ID
   */
  protected getSafeToggleId(): string {
    return Constants.Ids.IMAGE_DETAIL_SAFE_TOGGLE;
  }

  /**
   * 渲染图像信息
   * @param image - 图像对象
   * @private
   */
  private async renderImageInfo(image: IImage): Promise<void> {
    // 更新时间
    const updatedAtEl = document.getElementById(Constants.Ids.IMAGE_DETAIL_UPDATED_AT);
    if (updatedAtEl) {
      updatedAtEl.textContent = image.updatedAt || "-";
    }

    // 上传时间
    const createdAtEl = document.getElementById(Constants.Ids.IMAGE_DETAIL_CREATED_AT);
    if (createdAtEl) {
      createdAtEl.textContent = image.createdAt || "-";
    }

    // 图像尺寸
    const dimensionsEl = document.getElementById(Constants.Ids.IMAGE_DETAIL_DIMENSIONS);
    if (dimensionsEl) {
      dimensionsEl.textContent =
        image.width && image.height ? `${image.width} × ${image.height}` : "-";
    }

    // 文件大小
    const fileSizeEl = document.getElementById(Constants.Ids.IMAGE_DETAIL_FILE_SIZE);
    if (fileSizeEl) {
      fileSizeEl.textContent = image.fileSize ? HtmlUtils.formatFileSize(image.fileSize) : "-";
    }

    // 设置图像 - 异步获取完整路径
    const imgEl = document.getElementById(
      Constants.Ids.IMAGE_DETAIL_IMG,
    ) as HTMLImageElement | null;
    if (imgEl && image.relativePath) {
      try {
        const fullPath = await window.electronAPI.getImagePath(image.relativePath);
        imgEl.src = `file://${fullPath.replace(/"/g, "&quot;")}`;
        imgEl.alt = image.fileName || "图像";

        // 绑定双击打开全屏查看器
        if (this.app.imageFullscreenManager) {
          imgEl.ondblclick = () => {
            if (this.itemsSnapshot && this.itemsSnapshot.length > 0) {
              const currentIndex = this.itemsSnapshot.findIndex((i) =>
                this.app.isSameId(i.id, image.id),
              );
              this.app.imageFullscreenManager?.open(
                this.itemsSnapshot,
                currentIndex >= 0 ? currentIndex : 0,
              );
            } else {
              this.app.imageFullscreenManager?.open([image], 0);
            }
          };
        }
      } catch (error) {
        ErrorHandler.handleError(
          { module: "ImageDetailManager.ts", operation: "load image" },
          error,
          { showToast: false },
        );
        imgEl.alt = "加载图像失败";
      }
    }
  }

  /**
   * 初始化图像右键菜单
   * @private
   */
  private initImageContextMenu(): void {
    // 绑定到主图像
    const imgEl = document.getElementById(Constants.Ids.IMAGE_DETAIL_IMG);
    if (imgEl) {
      imgEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const currentImage = this.currentItem;
        if (!currentImage?.relativePath) return;

        showContextMenu({
          x: e.clientX,
          y: e.clientY,
          items: [
            {
              id: "replaceImage",
              label: Constants.CONTEXT_MENU_REPLACE_IMAGE,
              onClick: async () => {
                try {
                  const result = await window.electronAPI.replaceImage(currentImage.id);
                  if (result.canceled) return;
                  if (result.reason === "same_image") {
                    this.app.showToast("选择的图像与当前图像相同", "info");
                    return;
                  }
                  if (result.success && result.image) {
                    this.app.showToast("图像已替换", "success");
                    // 刷新新图像缓存（包含最新的更新时间），确保主界面按最近更新排序正确
                    if (result.image) {
                      cacheManager.cacheImage(result.image);
                    }
                    this.app.eventBus.emit(Events.IMAGES_CHANGED);
                    // 刷新相关提示词缓存，并通知提示词面板刷新，确保提示词主界面按最近更新排序正确
                    if (result.relatedPromptIds && result.relatedPromptIds.length > 0) {
                      // 批量获取，避免循环内逐条 IPC
                      const updatedPrompts = await window.electronAPI.getPromptsByIds(
                        result.relatedPromptIds,
                      );
                      for (const updatedPrompt of updatedPrompts) {
                        cacheManager.cachePrompt(updatedPrompt);
                      }
                      this.app.eventBus.emit(Events.PROMPTS_CHANGED);
                    }
                    // 刷新当前详情显示
                    await this.updateView(result.image as IImage);
                  }
                } catch (error) {
                  ErrorHandler.handleError(
                    { module: "ImageDetailManager.ts", operation: "replace image" },
                    error,
                    { userMessage: "替换图像失败" },
                  );
                }
              },
            },
            {
              id: "openLocation",
              label: Constants.CONTEXT_MENU_OPEN_LOCATION,
              onClick: async () => {
                try {
                  await window.electronAPI.openImageLocation(currentImage.relativePath as string);
                } catch (error) {
                  ErrorHandler.handleError(
                    { module: "ImageDetailManager.ts", operation: "open image location" },
                    error,
                    { userMessage: "打开保存位置失败" },
                  );
                }
              },
            },
          ],
        });
      });
    }
  }

  /**
   * 初始化标签管理器
   * @param image - 图像对象
   * @private
   */
  private initTagManager(image: IImage): void {
    this.currentTags = [...(image.tags || [])];

    // 标签增删逻辑与提示词详情同构，统一由 DetailTagController 提供
    const detailTagManager: IDetailTagManager = createDetailTagController({
      type: "image",
      moduleLabel: "ImageDetailManager.ts",
      getCurrentItemId: () => this.currentItem?.id,
      getTags: () => this.currentTags,
      commitTags: (tags) => {
        this.currentTags = tags;
        this.syncImageTagsToCache();
      },
      notifyChanged: () => this.app.eventBus.emit(Events.IMAGES_CHANGED),
      showToast: (message, type) => this.app.showToast(message, type),
    });

    // 使用基类的标签管理功能
    this.initDetailTagManager(Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER, detailTagManager);

    // 触发渲染
    detailTagManager.onRender?.();

    // 绑定标签输入事件
    this.bindTagInputEvents();
  }

  /**
   * 绑定标签输入事件
   * @private
   */
  private bindTagInputEvents(): void {
    // 清理旧的自动完成组件
    if (this.tagAutocomplete) {
      this.tagAutocomplete.destroy();
    }

    // 创建新的自动完成组件
    this.tagAutocomplete = new TagAutocomplete({
      inputId: Constants.Ids.IMAGE_DETAIL_TAG_INPUT,
      dropdownId: Constants.Ids.IMAGE_DETAIL_TAG_AUTOCOMPLETE,
      onSelect: async (tagName: string) => {
        try {
          const currentItem = this.currentItem;
          const tagService = TagService.getInstance();
          const result = await tagService.linkTagsToItem({
            tagName,
            type: "image",
            itemId: currentItem?.id,
          });

          // 提示错误（如输入了特殊标签）
          if (result.errors.length > 0) {
            tagService.reportTagErrors(result.errors, (msg, type) =>
              this.app.showToast(msg, type as "success" | "warning" | "error"),
            );
          }

          if (result.success) {
            // 添加新创建的标签和已存在的标签（skipped）到本地状态
            const allTagsToAdd = [...result.created, ...result.skipped];
            for (const tag of allTagsToAdd) {
              if (!this.currentTags.includes(tag)) {
                this.currentTags.push(tag);
              }
            }
            this.syncImageTagsToCache();
            // 触发重新渲染
            this.detailTagManager?.onRender?.();
            this.app.eventBus.emit(Events.IMAGES_CHANGED);
          }
          return result.success;
        } catch (error) {
          ErrorHandler.handleError(
            { module: "ImageDetailManager.ts", operation: "add tag" },
            error,
            { userMessage: "添加标签失败" },
          );
          return false;
        }
      },
      containerSelector: ".image-tag-input-area",
      type: "image",
    });

    this.tagAutocomplete.init();
  }

  /**
   * 同步当前标签到图像缓存
   * 确保从图像详情返回其他界面时，图像标签显示为最新
   * 使用原地更新，避免改变缓存中的图像顺序
   * @private
   */
  private syncImageTagsToCache(): void {
    const currentImage = this.currentItem;
    if (!currentImage?.id) return;

    const tags = [...this.currentTags];
    const imageId = String(currentImage.id);

    // 原地更新 cacheManager，不改变 LRU 顺序
    cacheManager.updateCachedItemInPlace<IImage>(imageId, "image", (cachedImage) => {
      cachedImage.tags = tags;
    });

    // 原地更新 currentImagesCache，不改变 LRU 顺序
    const cachedImage = this.app.promptRefImagesCache.peek(imageId);
    if (cachedImage) {
      cachedImage.tags = tags;
    }
  }

  // ========== 提示词渲染辅助方法 ==========

  /**
   * 收集并缓存提示词引用
   */
  private collectPromptRefs(image: IImage): IPrompt[] {
    if (!image.promptRefs?.length) return [];

    return image.promptRefs
      .map((ref) => {
        const cachedPrompt = cacheManager.getCachedPrompt(ref.promptId);
        if (cachedPrompt) return cachedPrompt;

        if (ref.promptContent) {
          const prompt: IPrompt = {
            id: ref.promptId,
            title: ref.promptTitle || "",
            content: ref.promptContent,
            contentTranslate: ref.promptContentTranslate,
            note: ref.promptNote,
            tags: [],
            isDeleted: false,
          };
          cacheManager.cachePrompt(prompt);
          return prompt;
        }
        return null;
      })
      .filter((p): p is IPrompt => p !== null);
  }

  /**
   * 渲染提示词标题列表（多/单）并绑定事件
   */
  private renderPromptTitles(
    promptTitleContainer: HTMLElement | null,
    allPromptRefs: IPrompt[],
    image: IImage,
  ): void {
    if (!promptTitleContainer) return;

    if (allPromptRefs.length > 1) {
      promptTitleContainer.innerHTML = allPromptRefs
        .map(
          (p, index) =>
            `<div class="prompt-ref-item" data-prompt-id="${p.id}">
          <span class="prompt-ref-number">${index + 1}.</span>
          <span class="prompt-ref-title">${HtmlUtils.escapeHtml(p.title || "未命名")}</span>
          <span class="prompt-ref-unlink" title="解除关联">×</span>
        </div>`,
        )
        .join("");

      // 绑定标题点击切换
      promptTitleContainer.querySelectorAll(".prompt-ref-item").forEach((item) => {
        const titleEl = item.querySelector(".prompt-ref-title");
        if (titleEl) {
          titleEl.addEventListener("click", () => {
            const promptId = (item as HTMLElement).dataset.promptId;
            if (!promptId) return;
            const selectedPrompt = allPromptRefs.find((p) => this.app.isSameId(p.id, promptId));
            if (selectedPrompt) this.showPromptDetail(selectedPrompt);
          });
        }
      });

      // 绑定解除关联
      promptTitleContainer.querySelectorAll(".prompt-ref-unlink").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const item = (btn as HTMLElement).closest(".prompt-ref-item");
          const promptId = (item as HTMLElement | null)?.dataset.promptId;
          if (!promptId) return;
          const promptRef = allPromptRefs.find((p) => this.app.isSameId(p.id, promptId));
          if (promptRef) await this.unlinkFromPrompt(image.id, promptId, promptRef.title);
        });
      });
    } else {
      const p = allPromptRefs[0];
      promptTitleContainer.innerHTML = `<div class="prompt-ref-item single-ref" data-prompt-id="${p.id}">
          <span class="prompt-ref-title">${HtmlUtils.escapeHtml(p.title || "未命名")}</span>
          <span class="prompt-ref-unlink" title="解除关联">×</span>
        </div>`;

      promptTitleContainer
        .querySelector(".prompt-ref-unlink")
        ?.addEventListener("click", async (e) => {
          e.stopPropagation();
          await this.unlinkFromPrompt(image.id, p.id, p.title);
        });
    }
  }

  /**
   * 渲染提示词内容显示（内容/翻译/备注/标签）
   */
  private renderPromptContentDisplay(prompt: IPrompt): void {
    const promptContentEl = document.getElementById(Constants.Ids.IMAGE_DETAIL_PROMPT_CONTENT);
    const promptTranslateEl = document.getElementById(Constants.Ids.IMAGE_DETAIL_PROMPT_TRANSLATE);
    const promptNoteEl = document.getElementById(Constants.Ids.IMAGE_DETAIL_PROMPT_NOTE);
    const tagsContainer = document.getElementById(Constants.Ids.IMAGE_DETAIL_TAGS);

    if (promptContentEl) promptContentEl.textContent = prompt.content || "-";
    if (promptTranslateEl) promptTranslateEl.textContent = prompt.contentTranslate || "-";
    if (promptNoteEl) promptNoteEl.textContent = prompt.note || "-";

    if (tagsContainer) {
      if (prompt.tags?.length) {
        tagsContainer.innerHTML = prompt.tags
          .map((tag) => `<span class="tag-editable">${HtmlUtils.escapeHtml(tag)}</span>`)
          .join("");
      } else {
        tagsContainer.innerHTML = '<span style="color: var(--text-secondary);">无标签</span>';
      }
    }
  }

  /**
   * 清空提示词显示
   */
  private clearPromptDisplay(): void {
    const promptTitleContainer = document.getElementById(Constants.Ids.IMAGE_DETAIL_PROMPT_TITLE);
    const promptContentEl = document.getElementById(Constants.Ids.IMAGE_DETAIL_PROMPT_CONTENT);
    const promptTranslateEl = document.getElementById(Constants.Ids.IMAGE_DETAIL_PROMPT_TRANSLATE);
    const promptNoteEl = document.getElementById(Constants.Ids.IMAGE_DETAIL_PROMPT_NOTE);
    const tagsContainer = document.getElementById(Constants.Ids.IMAGE_DETAIL_TAGS);

    if (promptTitleContainer) promptTitleContainer.textContent = "-";
    if (promptContentEl) promptContentEl.textContent = "-";
    if (promptTranslateEl) promptTranslateEl.textContent = "-";
    if (promptNoteEl) promptNoteEl.textContent = "-";
    if (tagsContainer)
      tagsContainer.innerHTML = '<span style="color: var(--text-secondary);">无标签</span>';
  }

  /**
   * 统一设置编辑按钮状态
   */
  private setupEditPromptButton(
    editPromptBtn: HTMLButtonElement | null,
    editPromptBtnText: HTMLElement | null,
    allPromptRefs: IPrompt[],
    currentDetailPromptId: string | null,
    buttonText: string,
  ): void {
    if (!editPromptBtn) return;

    editPromptBtn.style.display = "flex";

    if (this.app.isFromDetailJump) {
      editPromptBtn.disabled = true;
      editPromptBtn.classList.add("disabled-secondary");
      editPromptBtn.title = "已从详情界面跳转，禁止再次跳转";
      editPromptBtn.onclick = null;
    } else {
      editPromptBtn.disabled = false;
      editPromptBtn.classList.remove("disabled-secondary");
      editPromptBtn.title = "";
      editPromptBtn.onclick = () => {
        // 动态读取当前选中的提示词ID，避免切换后仍打开之前绑定的提示词
        const promptId = this.currentDetailPromptId;
        if (!promptId) return;
        const currentPrompt =
          allPromptRefs.length > 0
            ? allPromptRefs.find((p) => this.app.isSameId(p.id, promptId))
            : null;
        if (currentPrompt) {
          this.openPromptDetail(currentPrompt);
        }
      };
    }

    if (editPromptBtnText) editPromptBtnText.textContent = buttonText;
  }

  // ========== 提示词渲染辅助方法结束 ==========

  /**
   * 渲染关联提示词信息
   * @param image - 图像对象
   * @private
   */
  private async renderPromptInfo(image: IImage): Promise<void> {
    const promptTitleContainer = document.getElementById(Constants.Ids.IMAGE_DETAIL_PROMPT_TITLE);
    const editPromptBtn = document.getElementById(
      Constants.Ids.EDIT_PROMPT_FROM_IMAGE_BTN,
    ) as HTMLButtonElement | null;
    const editPromptBtnText = document.getElementById(Constants.Ids.EDIT_PROMPT_BTN_TEXT);

    const allPromptRefs = this.collectPromptRefs(image);

    if (allPromptRefs.length > 0) {
      this.renderPromptTitles(promptTitleContainer, allPromptRefs, image);

      const firstPrompt = allPromptRefs[0];

      // 优先保持当前选中的提示词；若当前选中不在当前图像提示词列表中（如打开了新图像），则默认第一个
      const selectedPromptId = this.currentDetailPromptId;
      const currentPromptId =
        selectedPromptId && allPromptRefs.some((p) => this.app.isSameId(p.id, selectedPromptId))
          ? selectedPromptId
          : firstPrompt.id;
      const currentIndex = allPromptRefs.findIndex((p) => this.app.isSameId(p.id, currentPromptId));
      const currentPrompt = currentIndex >= 0 ? allPromptRefs[currentIndex] : firstPrompt;
      this.renderPromptContentDisplay(currentPrompt);

      const btnText =
        allPromptRefs.length > 1
          ? `编辑提示词 (${currentIndex >= 0 ? currentIndex + 1 : 1})`
          : "编辑提示词";
      this.setupEditPromptButton(
        editPromptBtn,
        editPromptBtnText,
        allPromptRefs,
        currentPromptId,
        btnText,
      );

      this.currentDetailPromptId = currentPromptId;
      this.currentDetailPromptRefs = allPromptRefs;
    } else {
      this.clearPromptDisplay();

      this.setupEditPromptButton(editPromptBtn, editPromptBtnText, [], null, "添加提示词");
      if (editPromptBtn && !this.app.isFromDetailJump) {
        editPromptBtn.onclick = () => this.createPromptForImage(image);
      }

      this.currentDetailPromptId = null;
      this.currentDetailPromptRefs = [];
    }
  }

  /**
   * 显示提示词详情
   * @param promptInfo - 提示词信息对象
   * @private
   */
  private showPromptDetail(promptInfo: IPrompt): void {
    if (!promptInfo) return;

    // 更新当前选中的提示词ID
    this.currentDetailPromptId = promptInfo.id;

    // 更新提示词标题区域的选中状态
    const promptTitleContainer = document.getElementById(Constants.Ids.IMAGE_DETAIL_PROMPT_TITLE);
    if (promptTitleContainer) {
      promptTitleContainer.querySelectorAll(".prompt-ref-item").forEach((item) => {
        const itemPromptId = (item as HTMLElement).dataset.promptId;
        if (itemPromptId && this.app.isSameId(itemPromptId, promptInfo.id)) {
          item.classList.add("active");
        } else {
          item.classList.remove("active");
        }
      });
    }

    // 使用提取的方法渲染内容
    this.renderPromptContentDisplay(promptInfo);

    // 更新编辑按钮文本
    const editPromptBtnText = document.getElementById(Constants.Ids.EDIT_PROMPT_BTN_TEXT);
    const allRefs = this.currentDetailPromptRefs || [];
    const currentIndex = allRefs.findIndex((p) => this.app.isSameId(p.id, promptInfo.id));
    if (editPromptBtnText && currentIndex >= 0) {
      editPromptBtnText.textContent = `编辑提示词 (${currentIndex + 1})`;
    }
  }

  /**
   * 解除图像与提示词的关联
   * @param imageId - 图像ID
   * @param promptId - 提示词ID
   * @param promptTitle - 提示词标题（用于确认消息）
   * @private
   */
  private async unlinkFromPrompt(
    imageId: string,
    promptId: string,
    promptTitle: string,
  ): Promise<void> {
    const confirmed = await DialogService.showConfirmDialogByConfig(
      DialogConfig.UNLINK_FROM_PROMPT,
      { promptTitle },
    );

    if (!confirmed) return;

    try {
      const currentItem = this.currentItem;
      const currentPrompts = currentItem?.promptRefs || [];
      const newPrompts = currentPrompts.filter((p) => !this.app.isSameId(p.promptId, promptId));
      // 转换为数据库需要的格式（只保留 id）
      const promptsForUpdate = newPrompts.map((p) => ({ id: p.promptId }));
      await window.electronAPI.updateImage(imageId, { prompts: promptsForUpdate });

      if (this.currentItem) {
        this.currentItem.promptRefs = newPrompts;
        const cachedImage = cacheManager.getCachedImage(imageId);
        if (cachedImage) {
          cachedImage.promptRefs = newPrompts;
        }
        await this.renderPromptInfo(this.currentItem);
      }

      // 通过事件通知刷新，避免直接调用导致的重复刷新
      this.app.eventBus.emit(Events.PROMPTS_CHANGED);
      this.app.eventBus.emit(Events.IMAGES_CHANGED);
      this.app.showToast("关联已解除", "success");
    } catch (error) {
      window.electronAPI.logError(
        "ImageDetailManager.ts",
        "Failed to unlink image from prompt:",
        error,
      );
      this.app.showToast("解除关联失败", "error");
    }
  }

  /**
   * 初始化保存管理器
   * @param image - 图像对象
   * @private
   */
  private initSaveManager(image: IImage): void {
    // 清理旧的
    if (this.imageSaveManager) {
      this.imageSaveManager.destroy();
    }

    // 清理收藏按钮事件监听器
    if (this.favoriteBtnHandler) {
      const favoriteBtn = document.getElementById(Constants.Ids.IMAGE_DETAIL_FAVORITE_BTN);
      if (favoriteBtn) {
        favoriteBtn.removeEventListener("click", this.favoriteBtnHandler);
      }
      this.favoriteBtnHandler = null;
    }

    // 创建保存策略
    const strategy = new ImageSaveStrategy(this.app as unknown as Record<string, unknown>);

    // 创建保存管理器
    this.imageSaveManager = new SaveManager({
      strategy,
      itemId: image.id,
      onAfterSave: async (fieldId: string, value: unknown) => {
        // 通过事件通知刷新，避免直接调用导致的重复刷新
        this.app.eventBus.emit(Events.IMAGES_CHANGED);

        if (fieldId === "isSafe") {
          await this.syncSafetyToRelatedPrompts(value as number);
        }
      },
    });

    // 注册所有字段
    this.registerFields();
  }

  /**
   * 注册所有字段到 SaveManager
   * @private
   */
  private registerFields(): void {
    if (!this.imageSaveManager) return;

    // 1. 文件名 - 防抖保存
    this.imageSaveManager.registerField("fileName", {
      saveMode: "debounce",
      delay: 800,
      elementId: Constants.Ids.IMAGE_DETAIL_FILE_NAME,
      statusId: Constants.Ids.IMAGE_DETAIL_FILE_NAME_STATUS,
      validate: (value: unknown) => validateFileName(value as string),
    });

    // 2. 备注 - 防抖保存
    this.imageSaveManager.registerField("note", {
      saveMode: "debounce",
      delay: 800,
      elementId: Constants.Ids.IMAGE_DETAIL_NOTE,
      autoResize: true,
      statusId: Constants.Ids.IMAGE_DETAIL_NOTE_STATUS,
    });

    // 3. 安全状态 - 防抖保存
    this.imageSaveManager.registerField("isSafe", {
      saveMode: "debounce",
      delay: 800,
      elementId: Constants.Ids.IMAGE_DETAIL_SAFE_TOGGLE,
      getValue: (element: HTMLElement) => ((element as HTMLInputElement).checked ? 1 : 0),
      onChange: (value: unknown) => {
        this.app.showToast(value ? "已标记为安全" : "已标记为敏感", "success");
      },
    });

    // 4. 收藏 - 防抖保存（通过按钮点击触发）
    this.imageSaveManager.registerField("isFavorite", {
      saveMode: "debounce",
      delay: 800,
      onChange: (value: unknown) => {
        const boolValue = Boolean(value);
        // 更新 currentItem 的收藏状态
        if (this.currentItem) {
          this.currentItem.isFavorite = boolValue ? 1 : 0;
        }
        this.updateFavoriteBtnUI(boolValue);
        this.app.showToast(boolValue ? "已收藏" : "已取消收藏", "success");
      },
    });

    // 手动绑定收藏按钮点击事件
    const favoriteBtn = document.getElementById(Constants.Ids.IMAGE_DETAIL_FAVORITE_BTN);
    if (favoriteBtn) {
      this.favoriteBtnHandler = async () => {
        const currentItem = this.currentItem;
        const newState = !currentItem?.isFavorite;
        await this.imageSaveManager?.triggerSave("isFavorite", newState, currentItem?.id);
      };
      favoriteBtn.addEventListener("click", this.favoriteBtnHandler);
    }
  }

  /**
   * 同步安全评级到关联提示词
   * @param isSafe - 安全评级值
   * @private
   */
  private async syncSafetyToRelatedPrompts(isSafe: number): Promise<void> {
    const image = this.currentItem;
    if (!image) return;
    if (!image.promptRefs || image.promptRefs.length === 0) return;

    const syncedIds: string[] = [];

    for (const ref of image.promptRefs) {
      const promptId = ref.promptId;
      if (!promptId) continue;

      try {
        await window.electronAPI.updatePrompt(promptId, { isSafe });

        const cachedPrompt = cacheManager.getCachedPrompt(promptId);
        if (cachedPrompt) {
          cachedPrompt.isSafe = isSafe;
        }
        syncedIds.push(promptId);
      } catch (error) {
        window.electronAPI.logError(
          "ImageDetailManager.ts",
          `Failed to sync safety to prompt ${promptId}: ${error}`,
        );
      }
    }

    if (syncedIds.length > 0) {
      this.app.eventBus.emit(Events.PROMPTS_CHANGED);
      this.updateOpenPromptDetailUI(syncedIds, isSafe);
    }
  }

  /**
   * 更新已打开的提示词详情界面 UI
   * @param promptIds - 已同步的提示词 ID 列表
   * @param isSafe - 安全评级值
   * @private
   */
  private updateOpenPromptDetailUI(promptIds: string[], isSafe: number): void {
    const promptDetailManager = this.app.promptDetailManager;
    if (!promptDetailManager) return;

    const modal = document.getElementById(Constants.Ids.PROMPT_DETAIL_MODAL);
    if (!modal || !modal.classList.contains("active")) return;

    const currentPromptId = (
      promptDetailManager as unknown as { currentItem: { id: string } | null }
    ).currentItem?.id;
    if (!currentPromptId) return;

    if (promptIds.some((id) => this.app.isSameId(id, currentPromptId))) {
      promptDetailManager.setSafeState(isSafe === 1);
    }
  }

  /**
   * 初始化图像导航器
   * @param image - 图像对象
   * @param options - 选项
   * @private
   */
  private async initNavigatorForImage(image: IImage, options: IOpenOptions = {}): Promise<void> {
    // 记录当前图像列表的快照
    const items =
      options.filteredList && options.filteredList.length > 0 ? [...options.filteredList] : [];

    const onNavigate = async (targetImage: IImage) => {
      // 直接使用 targetImage，不要重新查找，避免数据不一致
      await this.updateView(targetImage);
    };

    this.initNavigator(
      image,
      items,
      {
        first: document.getElementById(Constants.Ids.IMAGE_DETAIL_FIRST_NAV_BTN) ?? undefined,
        prev: document.getElementById(Constants.Ids.IMAGE_DETAIL_PREV_NAV_BTN) ?? undefined,
        next: document.getElementById(Constants.Ids.IMAGE_DETAIL_NEXT_NAV_BTN) ?? undefined,
        last: document.getElementById(Constants.Ids.IMAGE_DETAIL_LAST_NAV_BTN) ?? undefined,
      },
      onNavigate,
    );
  }

  /**
   * 更新视图
   * @param item - 数据项
   */
  async updateView(item: IImage): Promise<void> {
    const image = item;
    // 更新当前图像
    this.currentItem = item;

    // 更新当前标签
    this.currentTags = [...(image.tags || [])];

    // 重置 isFromDetailJump，因为导航到新图像后不再是"从详情跳转"状态
    this.app.isFromDetailJump = false;

    // 填充表单数据
    this.fillFormData(image);

    // 设置安全状态
    this.setSafeState(image.isSafe === 1);

    // 更新收藏按钮
    this.updateFavoriteBtnUI(!!image.isFavorite);

    // 渲染图像信息（包括图像显示）
    await this.renderImageInfo(image);

    // 重新初始化保存管理器
    this.initSaveManager(image);

    // 重新初始化标签管理器
    this.initTagManager(image);

    // 渲染关联提示词信息
    await this.renderPromptInfo(image);

    // 自动调整文本框高度
    const noteInput = document.getElementById(Constants.Ids.IMAGE_DETAIL_NOTE);
    if (noteInput) {
      this.app.autoResizeTextarea(noteInput);
    }
  }

  /**
   * 为图像创建新提示词
   * @param image - 图像对象
   * @private
   */
  private async createPromptForImage(image: IImage): Promise<void> {
    try {
      // 保存当前图像和返回信息，以便新建提示词页面关闭后返回
      const currentImage = image;
      const returnToManager = this.returnToManager;
      const returnToItem = this.returnToItem;

      // 打开新建提示词页面，预填充当前图像，并传递返回回调
      await this.app.newPromptManager?.open([image], {
        onClose: async (saved: boolean) => {
          if (saved) {
            // 如果保存了提示词，从缓存获取最新的图像信息（NewPromptManager 已更新缓存）
            const cachedImage = cacheManager.getCachedImage(currentImage.id);
            if (cachedImage) {
              // 更新当前图像的提示词关联信息
              currentImage.promptRefs = cachedImage.promptRefs || [];
              // 刷新图像详情中的提示词关联信息
              await this.renderPromptInfo(currentImage);
            }
          }
          // 重新打开图像详情界面
          await this.open(currentImage, {
            returnToManager: returnToManager,
            returnToItem: returnToItem,
          });
        },
      });

      // 关闭图像详情模态框（不清空 returnToManager/returnToItem，因为上面已经保存了）
      this.returnToManager = null;
      this.returnToItem = null;
      await super.close();
    } catch (error) {
      window.electronAPI.logError(
        "ImageDetailManager.ts",
        "Failed to create prompt for image:",
        error,
      );
      this.app.showToast("打开新建提示词页面失败", "error");
    }
  }

  /**
   * 打开提示词详情页面
   * @param prompt - 提示词对象
   * @private
   */
  private async openPromptDetail(prompt: IPrompt): Promise<void> {
    try {
      await this.app.promptDetailManager?.open(prompt, {
        returnToManager: this,
        returnToItem: this.currentItem,
      });
      // 隐藏图像详情（不关闭，保留状态），而不是关闭
      this.hide();
    } catch (error) {
      window.electronAPI.logError("ImageDetailManager.ts", "Failed to open prompt detail:", error);
      this.app.showToast("打开提示词详情失败", "error");
    }
  }

  /**
   * 隐藏模态框（不清理资源，用于跳转到提示词详情）
   */
  hide(): void {
    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.classList.remove("active");
    }
    // 临时重置 isFromDetailJump，允许提示词详情中的二级跳转
    this.app.isFromDetailJump = false;
  }

  /**
   * 显示模态框（用于从提示词详情返回）
   */
  show(): void {
    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.classList.add("active");
    }
    // 恢复禁止二级跳转状态
    this.app.isFromDetailJump = true;
  }

  async close(): Promise<void> {
    const returnToManager = this.returnToManager;
    const returnToItem = this.returnToItem;
    const returnToOptions = this.returnToOptions;

    // 销毁 TagAutocomplete，防止事件监听器残留
    if (this.tagAutocomplete) {
      this.tagAutocomplete.destroy();
      this.tagAutocomplete = null;
    }

    this.app.isFromDetailJump = false;

    await super.close();

    // 触发图像变更事件，让下层提示词详情界面重新渲染图像预览
    // 此时 isFromDetailJump 已重置，眼睛图标会恢复可点击
    this.app.eventBus.emit(Events.IMAGES_CHANGED);

    if (returnToManager && returnToItem) {
      // 使用保存的选项恢复状态，包括 filteredList
      await returnToManager.open(returnToItem as IImage, returnToOptions);
    }
  }
}
