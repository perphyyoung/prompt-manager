/**
 * ESLint 规则：禁止硬编码 DOM 元素 ID 字符串
 * 强制使用 Constants.Ids 常量
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止硬编码 DOM 元素 ID 字符串，强制使用 Constants.Ids 常量',
      category: 'Best Practices',
      recommended: true
    },
    schema: [],
    messages: {
      noHardcodedId: "禁止使用硬编码的 DOM ID '{{id }}'，请使用 Constants.Ids.{{constantName}}",
      noHardcodedSelector: "禁止使用硬编码的选择器 '#{{id}}'，请使用 `#${Constants.Ids.{{constantName}}}`"
    }
  },

  create(context) {
    // 常见的 DOM ID 模式（小驼峰命名）
    const idPattern = /^[a-z][a-zA-Z0-9]*$/;

    // 常见的 ID 后缀，用于识别 DOM 元素 ID
    const idSuffixes = [
      'Btn', 'Button',
      'Modal', 'Dialog',
      'Panel', 'Container',
      'Grid', 'List',
      'Input', 'Select', 'Textarea',
      'Toggle', 'Switch',
      'Toolbar', 'Header', 'Footer',
      'Content', 'Wrapper',
      'Preview', 'Thumbnail',
      'Status', 'Indicator',
      'Menu', 'Dropdown',
      'Tab', 'Nav',
      'Form', 'Field',
      'Area', 'Zone',
      'Viewer', 'Player',
      'Tooltip', 'Popover',
      'Autocomplete', 'Suggestions'
    ];

    // 常见的 DOM ID 属性名
    const idPropertyNames = [
      'id', 'elementId', 'modalId', 'containerId',
      'toolbarId', 'gridId', 'listId', 'inputId', 'statusId'
    ];

    // 检查字符串是否可能是 DOM ID
    function isLikelyDomId(str) {
      if (!idPattern.test(str)) return false;
      if (str.length < 3) return false;

      // 检查是否包含常见的 ID 后缀
      return idSuffixes.some(suffix => str.endsWith(suffix));
    }

    // 转换 ID 为建议的常量名（小驼峰转大写下划线）
    function toConstantName(id) {
      return id
        .replace(/([A-Z])/g, '_$1')
        .toUpperCase();
    }

    // 检查 getElementById('hardcoded')
    function checkGetElementById(node) {
      const { callee, arguments: args } = node;
      if (
        callee.type !== 'MemberExpression' ||
        callee.property.type !== 'Identifier' ||
        callee.property.name !== 'getElementById' ||
        args.length === 0 ||
        args[0].type !== 'Literal' ||
        typeof args[0].value !== 'string'
      ) return;

      const id = args[0].value;
      if (isLikelyDomId(id)) {
        context.report({
          node: args[0],
          messageId: 'noHardcodedId',
          data: { id, constantName: toConstantName(id) }
        });
      }
    }

    // 检查 querySelector('#xxx') 或 querySelectorAll('#xxx')
    function checkQuerySelector(node) {
      const { callee, arguments: args } = node;
      if (
        callee.type !== 'MemberExpression' ||
        callee.property.type !== 'Identifier' ||
        (callee.property.name !== 'querySelector' && callee.property.name !== 'querySelectorAll') ||
        args.length === 0 ||
        args[0].type !== 'Literal' ||
        typeof args[0].value !== 'string'
      ) return;

      const selector = args[0].value;
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        if (isLikelyDomId(id)) {
          context.report({
            node: args[0],
            messageId: 'noHardcodedSelector',
            data: { id, constantName: toConstantName(id) }
          });
        }
      }
    }

    // 检查对象属性中的 id: 'xxx'
    function checkPropertyId(node) {
      if (
        node.key.type !== 'Identifier' ||
        !idPropertyNames.includes(node.key.name) ||
        node.value.type !== 'Literal' ||
        typeof node.value.value !== 'string'
      ) return;

      const id = node.value.value;
      if (isLikelyDomId(id)) {
        context.report({
          node: node.value,
          messageId: 'noHardcodedId',
          data: { id, constantName: toConstantName(id) }
        });
      }
    }

    return {
      CallExpression(node) {
        checkGetElementById(node);
        checkQuerySelector(node);
      },

      Property(node) {
        checkPropertyId(node);
      }
    };
  }
};
