/**
 * 全局清理
 * 在测试结束后执行
 */
async function globalTeardown() {
  console.log('E2E tests completed');
}

export default globalTeardown;
