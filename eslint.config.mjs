import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import noHardcodedElementIds from './eslint-rules/no-hardcoded-element-ids.js';
import noDynamicImport from './eslint-rules/no-dynamic-import.js';

export default [
  {
    files: ['src/**/*.ts', 'e2e/**/*.ts', 'tests/**/*.ts'],
    ignores: ['out/**', 'dist/**', 'node_modules/**'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2023,
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'custom': {
        rules: {
          'no-hardcoded-element-ids': noHardcodedElementIds,
          'no-dynamic-import': noDynamicImport
        }
      }
    },
    rules: {
      // 未使用变量检测
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      // 其他推荐规则
      '@typescript-eslint/no-unused-expressions': 'error',
      // 禁止硬编码 DOM ID 字符串
      'custom/no-hardcoded-element-ids': 'error',
      // 禁止动态 import()
      'custom/no-dynamic-import': 'error'
    }
  }
];
