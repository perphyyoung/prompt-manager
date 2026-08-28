/**
 * 回收站类型常量
 * 主进程(为回收站条目打 type 标记)与渲染进程(消费)共用
 */

export const TrashType = Object.freeze({
  PROMPT: "trash-prompt",
  IMAGE: "trash-image",
});

export type TrashTypeValue = (typeof TrashType)["PROMPT"] | (typeof TrashType)["IMAGE"];
