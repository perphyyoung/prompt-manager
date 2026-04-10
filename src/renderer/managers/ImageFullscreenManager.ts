import { Constants } from '../../constants.ts';
import { ListNavigator } from '../../utils/index.ts';
import { contextStack, IContextStackEntry } from './ContextStackManager.ts';
import type { IClosableElement } from '../../types/entities.ts';

interface ImageFullscreenManagerOptions {
  app: unknown;
}

interface ViewerImage {
  path?: string;
  relativePath?: string;
  fileName?: string;
}

/**
 * 图像全屏查看器管理器
 * 负责管理图像全屏查看器的所有功能
 */
export class ImageFullscreenManager {
  private app: unknown;

  // 查看器状态
  private viewerImages: ViewerImage[] = [];
  private viewerCurrentIndex = 0;
  private viewerZoom = 1;
  private viewerTranslateX = 0;
  private viewerTranslateY = 0;

  // 是否已绑定事件
  private eventsBound = false;

  // 导航器
  private navigator: ListNavigator<ViewerImage> | null = null;

  constructor(options: ImageFullscreenManagerOptions) {
    this.app = options.app;

    // 查看器状态
    this.viewerImages = [];
    this.viewerCurrentIndex = 0;
    this.viewerZoom = 1;
    this.viewerTranslateX = 0;
    this.viewerTranslateY = 0;

    // 是否已绑定事件
    this.eventsBound = false;

    // 导航器
    this.navigator = null;
  }

  /**
   * 初始化
   */
  init(): void {
    this.bindFullscreenEvents();
  }

  /**
   * 打开全屏图像查看器
   * @param images - 图像数组
   * @param startIndex - 起始图像索引
   */
  async open(images: Array<{ id?: string; relativePath?: string; fileName?: string }>, startIndex: number): Promise<void> {
    const viewer = document.getElementById('imageFullscreenViewer');
    if (!viewer) return;

    this.viewerImages = this.buildViewerImages(images.filter(img => img.id));
    this.viewerCurrentIndex = startIndex || 0;

    if (this.viewerImages.length === 0) return;

    // 重置缩放和位置
    this.viewerZoom = 1;
    this.viewerTranslateX = 0;
    this.viewerTranslateY = 0;
    this.updateImageTransform();

    // 填充导航按钮 SVG
    this.fillNavButtonSVGs();

    // 初始化导航器
    this.initNavigator();

    await this.updateViewer();

    // 显示查看器
    viewer.classList.add('active');

    // 压栈：进入全屏查看器上下文
    const stackEntry: IContextStackEntry = {
      id: Constants.Ids.IMAGE_FULLSCREEN_VIEWER,
      state: { isBatchToolbarVisible: false },
      close: () => { this.close(); }
    };
    contextStack.push(stackEntry);

    // 添加 close 方法供 ShortcutManager 调用
    (viewer as IClosableElement).close = () => this.close();

    // 聚焦以接收键盘事件
    viewer.focus();

    // 进入系统全屏模式（隐藏标题栏）
    try {
      if (window.electronAPI.setFullscreen) {
        await window.electronAPI.setFullscreen(true);
      }
    } catch (error) {
      window.electronAPI?.logError?.('ImageFullscreenManager.ts', 'Failed to enter fullscreen:', error);
    }

    // 重置提示文字动画
    const hint = document.getElementById('imageFullscreenViewerHint');
    if (hint) {
      hint.classList.remove('fade-out');
      setTimeout(() => {
        hint.classList.add('fade-out');
      }, 2000);
    }
  }

  /**
   * 构建查看器图像数据
   * @param images - 原始图像数组
   * @returns 格式化后的图像数组
   */
  buildViewerImages(images: Array<{ relativePath?: string; fileName?: string }>): ViewerImage[] {
    return images.map(img => ({
      path: img.relativePath,
      relativePath: img.relativePath,
      fileName: img.fileName
    }));
  }

  /**
   * 更新查看器显示
   */
  async updateViewer(): Promise<void> {
    const img = document.getElementById('imageFullscreenViewerImg') as HTMLImageElement | null;
    const counter = document.getElementById('imageFullscreenViewerCounter');

    if (this.viewerImages.length === 0) return;

    const currentImage = this.viewerImages[this.viewerCurrentIndex];

    // 检查是否有 relativePath
    if (!currentImage.relativePath) {
      window.electronAPI?.logError?.('ImageFullscreenManager.ts', 'Image missing relativePath:', currentImage);
      img!.src = '';
      img!.alt = 'Image not found';
      return;
    }

    // 获取图像完整路径
    const imagePath = await window.electronAPI.getImagePath(currentImage.relativePath);
    img!.src = `file://${imagePath}`;
    img!.alt = currentImage.fileName || '';

    // 更新文件名和索引
    const fileNameEl = document.getElementById('imageFullscreenViewerFileName');
    if (fileNameEl) {
      fileNameEl.textContent = currentImage.fileName || '';
    }
    if (counter) {
      counter.textContent = `${this.viewerCurrentIndex + 1} / ${this.viewerImages.length}`;
    }
  }

  /**
   * 处理图像缩放
   * @param e - 滚轮事件
   */
  handleZoom(e: WheelEvent): void {
    e.preventDefault();
    const img = document.getElementById('imageFullscreenViewerImg');
    if (!img) return;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.viewerZoom = (this.viewerZoom || 1) * delta;

    // 限制缩放范围（0.5 - 5 倍）
    this.viewerZoom = Math.max(0.5, Math.min(5, this.viewerZoom));

    this.updateImageTransform();
  }

  /**
   * 更新图像变换
   */
  updateImageTransform(): void {
    const img = document.getElementById('imageFullscreenViewerImg');
    if (!img) return;

    const zoom = this.viewerZoom || 1;
    const translateX = this.viewerTranslateX || 0;
    const translateY = this.viewerTranslateY || 0;

    img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoom})`;
  }

  /**
   * 绑定图像拖拽
   */
  bindImageDrag(): void {
    const wrapper = document.getElementById('imageFullscreenViewerWrapper');
    if (!wrapper) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialTranslateX = 0, initialTranslateY = 0;

    wrapper.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // 只响应左键
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialTranslateX = this.viewerTranslateX || 0;
      initialTranslateY = this.viewerTranslateY || 0;
      wrapper.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      this.viewerTranslateX = initialTranslateX + dx;
      this.viewerTranslateY = initialTranslateY + dy;

      this.updateImageTransform();
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        wrapper.style.cursor = 'grab';
      }
    });

    // 双击重置
    wrapper.addEventListener('dblclick', () => {
      this.viewerZoom = 1;
      this.viewerTranslateX = 0;
      this.viewerTranslateY = 0;
      this.updateImageTransform();
    });
  }

  /**
   * 初始化导航器
   */
  initNavigator(): void {
    const viewer = document.getElementById('imageFullscreenViewer');
    if (!viewer) return;

    this.navigator = new ListNavigator<ViewerImage>({
      items: this.viewerImages,
      currentIndex: this.viewerCurrentIndex,
      onSave: undefined, // 全屏查看器不需要保存
      onNavigate: async (_targetItem, currentIndex) => {
        this.viewerCurrentIndex = currentIndex;

        // 重置缩放和位置
        this.viewerZoom = 1;
        this.viewerTranslateX = 0;
        this.viewerTranslateY = 0;
        this.updateImageTransform();

        await this.updateViewer();
      },
      onClose: () => this.close(),
      navButtons: {
        first: document.getElementById('imageFullscreenViewerFirstNavBtn') ?? undefined,
        prev: document.getElementById('imageFullscreenViewerPrevNavBtn') ?? undefined,
        next: document.getElementById('imageFullscreenViewerNextNavBtn') ?? undefined,
        last: document.getElementById('imageFullscreenViewerLastNavBtn') ?? undefined
      },
      targetElement: document,
      shouldHandleKeyboard: (e: KeyboardEvent) => {
        // 只在查看器打开时响应
        if (!viewer.classList.contains('active')) return false;
        // 如果正在编辑输入框，不响应导航键
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return false;
        return true;
      }
    });
  }

  /**
   * 绑定全屏查看器事件（只绑定一次）
   */
  bindFullscreenEvents(): void {
    if (this.eventsBound) return;

    const viewer = document.getElementById('imageFullscreenViewer');

    // 关闭按钮
    const closeBtn = document.getElementById('imageFullscreenViewerClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // 点击遮罩关闭
    if (viewer) {
      viewer.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('fullscreen-viewer-overlay')) {
          this.close();
        }
      });
    }

    // 滚轮缩放
    const wrapper = document.getElementById('imageFullscreenViewerWrapper');
    if (wrapper) {
      wrapper.addEventListener('wheel', (e) => this.handleZoom(e as WheelEvent), { passive: false });
    }

    // 拖拽移动
    this.bindImageDrag();

    this.eventsBound = true;
  }

  /**
   * 关闭全屏查看器
   */
  async close(): Promise<void> {
    const viewer = document.getElementById('imageFullscreenViewer');
    if (viewer) {
      viewer.classList.remove('active');
    }

    // 出栈：退出全屏查看器上下文
    contextStack.pop(Constants.Ids.IMAGE_FULLSCREEN_VIEWER);

    this.viewerImages = [];
    this.viewerCurrentIndex = 0;
    this.viewerZoom = 1;
    this.viewerTranslateX = 0;
    this.viewerTranslateY = 0;

    // 销毁导航器
    if (this.navigator) {
      this.navigator.destroy();
      this.navigator = null;
    }

    // 退出系统全屏模式（恢复标题栏）
    try {
      if (window.electronAPI.setFullscreen) {
        await window.electronAPI.setFullscreen(false);
      }
    } catch (error) {
      window.electronAPI?.logError?.('ImageFullscreenManager.ts', 'Failed to exit fullscreen:', error);
    }
  }

  /**
   * 填充导航按钮 SVG
   */
  fillNavButtonSVGs(): void {
    const navButtons = [
      { id: 'imageFullscreenViewerFirstNavBtn', type: 'first' as const },
      { id: 'imageFullscreenViewerPrevNavBtn', type: 'prev' as const },
      { id: 'imageFullscreenViewerNextNavBtn', type: 'next' as const },
      { id: 'imageFullscreenViewerLastNavBtn', type: 'last' as const }
    ];

    navButtons.forEach(({ id, type }) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.innerHTML = Constants.ICONS.nav[type];
      }
    });
  }
}

export default ImageFullscreenManager;
