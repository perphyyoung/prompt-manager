/**
 * 详情界面标签控制器工厂
 *
 * 图像详情与提示词详情的标签增删逻辑完全同构，仅差异为：
 *   - 标签归属类型（prompt / image）
 *   - 变更后广播的事件（由宿主通过 notifyChanged 决定）
 *   - 标签快照的宿主与提交方式（图像侧需同步缓存）
 * 本工厂将同构部分收敛为一处，差异经 options 注入。
 */
import { DialogService, DialogConfig } from "../services/index.ts";
import { TagService } from "../services/index.ts";
import { ErrorHandler } from "../renderer_utils/index.ts";
import { TagExistsError, InvalidTagNameError, TagOperationError } from "../../pyTagGroups/index.ts";
import type { IDetailTagManager } from "../../types/entities.ts";

export interface DetailTagControllerOptions {
  /** 标签归属类型 */
  type: "prompt" | "image";
  /** 日志模块名（错误上报定位用） */
  moduleLabel: string;
  /** 当前详情项 ID（详情生命周期内必存在；模态框关闭后可能为 undefined） */
  getCurrentItemId(): string | undefined;
  /** 读取当前标签快照 */
  getTags(): string[];
  /** 提交新的标签快照（宿主可在此同步缓存等派生状态） */
  commitTags(tags: string[]): void;
  /** 增删成功后广播变更（宿主决定具体事件：PROMPTS_CHANGED / IMAGES_CHANGED） */
  notifyChanged(): void;
  /** 用户提示（透传 app.showToast） */
  showToast(message: string, type?: string): void;
}

export function createDetailTagController(options: DetailTagControllerOptions): IDetailTagManager {
  const { type, moduleLabel } = options;

  const controller: IDetailTagManager = {
    getTags: () => options.getTags(),
    setTags: (tags: string[]) => options.commitTags(tags),

    removeTag: async (tagName: string) => {
      try {
        // 显示确认对话框
        const confirmed = await DialogService.showConfirmDialogByConfig(DialogConfig.DELETE_TAG, {
          name: tagName,
        });
        if (!confirmed) return false;

        // unlinkTagFromItem 解除标签与项目的关联（会更新 updated_at）
        // 详情生命周期内 currentItem 必存在，此处收窄为 string
        const success = await TagService.getInstance().unlinkTagFromItem({
          type,
          itemId: options.getCurrentItemId() as string,
          tagName,
        });
        if (success) {
          options.commitTags(options.getTags().filter((t) => t !== tagName));
          options.notifyChanged();
          // 触发重新渲染标签列表
          controller.onRender?.();
        }
        return success;
      } catch (error) {
        ErrorHandler.handleError({ module: moduleLabel, operation: "delete tag" }, error, {
          userMessage: "删除标签失败",
          logError: false,
        });
        return false;
      }
    },

    addTags: async (tagNames: string[]) => {
      try {
        const result = await TagService.getInstance().linkTagsToItem({
          tagNames,
          type,
          itemId: options.getCurrentItemId(),
        });

        if (result.success) {
          // 添加新创建的标签和已存在的标签（skipped）到本地状态
          const merged = [...options.getTags()];
          for (const tagName of [...result.created, ...result.skipped]) {
            if (!merged.includes(tagName)) {
              merged.push(tagName);
            }
          }
          options.commitTags(merged);
          options.notifyChanged();
          // 触发重新渲染
          controller.onRender?.();
        }
        return { success: result.success, added: result.created?.length || 0 };
      } catch (error) {
        // 根据错误类型显示不同的提示
        if (error instanceof TagExistsError) {
          options.showToast("标签已存在", "warning");
        } else if (error instanceof InvalidTagNameError) {
          options.showToast(`标签名无效: ${(error as Error).message}`, "warning");
        } else if (error instanceof TagOperationError) {
          options.showToast(`操作失败: ${(error as Error).message}`, "error");
        } else {
          options.showToast(
            `添加标签失败: ${error instanceof Error ? error.message : "未知错误"}`,
            "error",
          );
        }
        return { success: false, added: 0 };
      }
    },

    onRender: undefined,
  };

  return controller;
}
