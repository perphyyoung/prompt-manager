import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // 支持 .ts 扩展名导入
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
  },
  test: {
    // 测试环境
    environment: 'happy-dom',
    
    // 测试文件匹配模式
    include: ['tests/**/*.test.{js,ts}'],
    
    // 排除的文件
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    
    // 测试超时时间
    testTimeout: 10000,
    
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['renderer/**/*.{js,ts}'],
      exclude: ['node_modules', 'tests/**/*.{js,ts}']
    },
    
    // UI 配置
    ui: true,
    
    // 全局测试设置
    globals: true,
    
    // 模拟配置
    mockReset: true,
    clearMocks: true,
    
    // 设置文件
    setupFiles: ['./tests/setup.js'],

    // 类型检查
    typecheck: {
      enabled: true
    }
  }
});
