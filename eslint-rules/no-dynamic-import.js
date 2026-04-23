/**
 * ESLint 规则：禁止动态 import()
 * 强制使用静态 import 声明
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止动态 import()，强制使用静态 import 声明',
      category: 'Best Practices',
      recommended: true
    },
    schema: [],
    messages: {
      noDynamicImport: '禁止使用动态 import()，请使用静态 import 声明'
    }
  },

  create(context) {
    return {
      ImportExpression(node) {
        context.report({
          node,
          messageId: 'noDynamicImport'
        });
      }
    };
  }
};
