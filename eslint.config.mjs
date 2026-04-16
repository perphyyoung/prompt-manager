import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

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
      '@typescript-eslint': tseslint
    },
    rules: {
      // 未使用变量检测
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      // 其他推荐规则
      '@typescript-eslint/no-unused-expressions': 'error'
    }
  }
];
