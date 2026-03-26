/**
 * HTML 工具类
 * 提供 HTML 相关的通用工具方法
 */
export class HtmlUtils {
  /**
   * HTML 转义
   * @param {string} text - 需要转义的文本
   * @returns {string} - 转义后的 HTML
   */
  static escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 转义 HTML 属性值
   * @param {string} text - 要转义的文本
   * @returns {string} 转义后的属性值
   */
  static escapeAttr(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '&#10;')
      .replace(/\r/g, '&#13;');
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} - 格式化后的文件大小
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
