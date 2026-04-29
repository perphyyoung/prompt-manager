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

    const idPropertyNames = {
      'id': 1, 'elementId': 1, 'modalId': 1, 'containerId': 1, 'toolbarId': 1,
      'gridId': 1, 'listId': 1, 'inputId': 1, 'statusId': 1
    };

    const playwrightMethods = {
      'click': 1, 'fill': 1, 'press': 1, 'waitForSelector': 1, 'waitForFunction': 1,
      'selectOption': 1, 'check': 1, 'uncheck': 1, 'dblclick': 1, 'hover': 1,
      'waitFor': 1, 'focus': 1, 'blur': 1, 'dragTo': 1, 'tap': 1
    };

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

    function extractIdFromSelector(selector) {
      // 处理 "#id", "#id.class", "#id[attr]" 等格式
      if (!selector.startsWith('#')) return null;
      const idPart = selector.slice(1).split(/[.\s[]/)[0];
      return idPart || null;
    }

    function reportHardcodedId(node, id) {
      if (isLikelyDomId(id)) {
        context.report({
          node,
          message: `禁止使用硬编码的 DOM ID '${id}'，请使用 Constants.Ids.${toConstantName(id)}`
        });
      }
    }

    function reportHardcodedSelector(node, selector) {
      const id = extractIdFromSelector(selector);
      if (id) {
        reportHardcodedId(node, id);
      }
    }

    return {
      CallExpression(node) {
        const { callee } = node;

        if (callee.type !== 'MemberExpression') return;
        if (callee.property.type !== 'Identifier') return;
        if (node.arguments.length === 0) return;
        if (node.arguments[0].type !== 'Literal') return;
        if (typeof node.arguments[0].value !== 'string') return;

        const methodName = callee.property.name;
        const argValue = node.arguments[0].value;

        // 检查 getElementById
        if (methodName === 'getElementById') {
          reportHardcodedId(node.arguments[0], argValue);
          return;
        }

        // 检查 querySelector / querySelectorAll / locator
        if (methodName in { querySelector: 1, querySelectorAll: 1, locator: 1 }) {
          reportHardcodedSelector(node.arguments[0], argValue);
          return;
        }

        // 检查 Playwright page 方法
        if (methodName in playwrightMethods) {
          reportHardcodedSelector(node.arguments[0], argValue);
          return;
        }
      },

      Property(node) {
        if (node.key.type !== 'Identifier') return;
        if (!(node.key.name in idPropertyNames)) return;
        if (node.value.type !== 'Literal') return;
        if (typeof node.value.value !== 'string') return;

        reportHardcodedId(node.value, node.value.value);
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
