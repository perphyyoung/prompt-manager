const noDynamicImportRule = {
  create(context) {
    return {
      ImportExpression(node) {
        context.report({
          node,
          message: "禁止使用动态 import()，请使用静态 import 声明"
        });
      }
    };
  }
};

const noHardcodedElementIdsRule = {
  create(context) {
    const idPattern = /^[a-z][a-zA-Z0-9]*$/;

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

    function isLikelyDomId(str) {
      if (!idPattern.test(str)) return false;
      if (str.length < 3) return false;
      return idSuffixes.some(suffix => str.endsWith(suffix));
    }

    function toConstantName(id) {
      return id
        .replace(/([A-Z])/g, '_$1')
        .toUpperCase();
    }

    return {
      CallExpression(node) {
        const { callee } = node;

        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'getElementById' &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'Literal' &&
          typeof node.arguments[0].value === 'string'
        ) {
          const id = node.arguments[0].value;
          if (isLikelyDomId(id)) {
            context.report({
              node: node.arguments[0],
              message: `禁止使用硬编码的 DOM ID '${id}'，请使用 Constants.Ids.${toConstantName(id)}`
            });
          }
        }

        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          (callee.property.name === 'querySelector' || callee.property.name === 'querySelectorAll') &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'Literal' &&
          typeof node.arguments[0].value === 'string'
        ) {
          const selector = node.arguments[0].value;
          if (selector.startsWith('#')) {
            const id = selector.slice(1);
            if (isLikelyDomId(id)) {
              context.report({
                node: node.arguments[0],
                message: `禁止使用硬编码的选择器 '#${id}'，请使用 Constants.Ids.${toConstantName(id)}`
              });
            }
          }
        }

        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'locator' &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'Literal' &&
          typeof node.arguments[0].value === 'string'
        ) {
          const selector = node.arguments[0].value;
          if (selector.startsWith('#')) {
            const id = selector.slice(1);
            if (isLikelyDomId(id)) {
              context.report({
                node: node.arguments[0],
                message: `禁止使用硬编码的选择器 '#${id}'，请使用 Constants.Ids.${toConstantName(id)}`
              });
            }
          }
        }
      },

      Property(node) {
        if (
          node.key.type === 'Identifier' &&
          (node.key.name === 'id' || node.key.name === 'elementId' || node.key.name === 'modalId' ||
           node.key.name === 'containerId' || node.key.name === 'toolbarId' || node.key.name === 'gridId' ||
           node.key.name === 'listId' || node.key.name === 'inputId' || node.key.name === 'statusId') &&
          node.value.type === 'Literal' &&
          typeof node.value.value === 'string'
        ) {
          const id = node.value.value;
          if (isLikelyDomId(id)) {
            context.report({
              node: node.value,
              message: `禁止使用硬编码的 DOM ID '${id}'，请使用 Constants.Ids.${toConstantName(id)}`
            });
          }
        }
      }
    };
  }
};

const plugin = {
  meta: {
    name: 'prompt-manager-custom'
  },
  rules: {
    'no-dynamic-import': noDynamicImportRule,
    'no-hardcoded-element-ids': noHardcodedElementIdsRule
  }
};

export default plugin;