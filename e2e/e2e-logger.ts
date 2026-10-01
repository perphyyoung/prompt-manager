/**
 * e2e 日志：Node 侧直接追加写 pm.log
 *
 * 与业务日志同一文件、同一套级别体系（低于阈值丢弃）；不经过页面，页面挂了照样能记；
 * 也不往控制台输出，避免污染 Playwright 的运行输出。
 */

import { appendFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

type E2eLogLevel = "debug" | "info" | "warn" | "error";

/** 级别权重：低于阈值的日志丢弃 */
const LEVEL_WEIGHT: Record<E2eLogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/** e2e 日志阈值：默认记录 info 及以上；排障调 debug，降噪调 warn */
const LOG_LEVEL: E2eLogLevel = "info";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** 与业务日志同一文件：项目根目录 pm.log */
const LOG_PATH = join(__dirname, "..", "pm.log");

/** 与主进程日志同格式的时间戳：YYYY-MM-DD HH:mm:ss.SSS */
function timestamp(): string {
  const now = new Date();
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
  return `${date} ${time}`;
}

/**
 * 写一条 e2e 日志到 pm.log（写失败静默，不影响测试执行）
 * @param level - 日志级别
 * @param component - 组件名（如 `E2E w0-1`）
 * @param message - 日志内容
 */
export function e2eLog(level: E2eLogLevel, component: string, message: string): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[LOG_LEVEL]) {
    return;
  }

  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    appendFileSync(
      LOG_PATH,
      `[${timestamp()}] [${level}] [e2e] [${component}] ${message}\n`,
      "utf-8",
    );
  } catch {
    // 日志写入失败不影响测试
  }
}
