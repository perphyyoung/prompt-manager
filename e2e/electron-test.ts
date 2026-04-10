import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Electron 测试辅助类
 * 封装 Electron 应用的启动和常用操作
 */
export class ElectronTestHelper {
  electronApp: ElectronApplication | null = null;
  page: Page | null = null;

  /**
   * 启动 Electron 应用
   */
  async launch() {
    const electronPath = join(__dirname, '../node_modules/.bin/electron.cmd');
    const mainPath = join(__dirname, '../out/main/index.js');

    this.electronApp = await electron.launch({
      executablePath: electronPath,
      args: [mainPath],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    this.page = await this.electronApp.firstWindow();

    // 等待应用加载完成
    await this.page.waitForLoadState('domcontentloaded');

    return { electronApp: this.electronApp, page: this.page };
  }

  /**
   * 关闭应用
   */
  async close() {
    if (this.electronApp) {
      await this.electronApp.close();
      this.electronApp = null;
      this.page = null;
    }
  }

  /**
   * 获取主窗口
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Electron app not launched. Call launch() first.');
    }
    return this.page;
  }

  /**
   * 等待元素出现
   */
  async waitForSelector(selector: string, timeout = 5000) {
    const page = this.getPage();
    await page.waitForSelector(selector, { timeout });
  }

  /**
   * 点击元素
   */
  async click(selector: string) {
    const page = this.getPage();
    await page.click(selector);
  }

  /**
   * 获取元素文本
   */
  async getText(selector: string): Promise<string> {
    const page = this.getPage();
    return await page.textContent(selector) || '';
  }

  /**
   * 检查元素是否存在
   */
  async exists(selector: string): Promise<boolean> {
    const page = this.getPage();
    const element = await page.$(selector);
    return element !== null;
  }

  /**
   * 等待指定时间
   */
  async wait(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 截图
   */
  async screenshot(name: string) {
    const page = this.getPage();
    await page.screenshot({ path: join(__dirname, `screenshots/${name}.png`) });
  }

  /**
   * 记录测试开始日志
   * @param testName - 测试名称
   */
  async logTestStart(testName: string): Promise<void> {
    const page = this.getPage();
    await page.evaluate((name: string) => {
      window.electronAPI.logInfo('E2E-Test', `Starting test: ${name}`);
    }, testName);
  }
}

/**
 * 创建测试辅助实例
 */
export function createElectronTest() {
  return new ElectronTestHelper();
}
