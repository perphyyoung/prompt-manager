/**
 * 面板渲染器
 */

export class PanelRenderer {
  /**
   * 清空网格并显示空状态
   * @param containerId - 容器元素 ID
   * @param emptyStateId - 空状态元素 ID
   * @param message - 空状态消息
   * @param title - 空状态标题（可选，不传则使用默认标题）
   */
  static showEmptyState(
    containerId: string,
    emptyStateId: string,
    message = "暂无数据",
    title?: string,
  ): void {
    const container = document.getElementById(containerId);
    const emptyState = document.getElementById(emptyStateId);

    if (container) container.innerHTML = "";
    if (emptyState) {
      emptyState.style.display = "flex";
      const h3 = emptyState.querySelector("h3");
      const p = emptyState.querySelector("p");
      if (title && h3) h3.textContent = title;
      if (p) p.textContent = message;
    }
  }

  /**
   * 隐藏空状态并显示网格
   * @param containerId - 容器元素 ID
   * @param emptyStateId - 空状态元素 ID
   */
  static hideEmptyState(containerId: string, emptyStateId: string): void {
    const container = document.getElementById(containerId);
    const emptyState = document.getElementById(emptyStateId);

    if (container) container.style.display = "grid";
    if (emptyState) emptyState.style.display = "none";
  }
}
