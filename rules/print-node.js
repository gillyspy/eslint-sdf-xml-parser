require('eslint');
/**
 * @description This is an example rule called `print-node`.
 */

/**
 * @description Constructs a rule that can demonstrate using selectors to suggest action.
 * @param {function} report
 * @param {string} selector
 * @param {object} SC
 * @returns {function(node) : void}
 */
const makePrinter = (report, selector) => (node) => {
  console.log({ selector }, node.value || node.tagName || node.value);

  report({
    node,
    messageId: 'YouSelected',
    data: {
      type: node.type,
      selector
    },
    suggest: [
      {
        messageId: 'RemoveThis',
        /**
         * @description Removes the node.
         * @param {object} fixer Function containing fixer methods.
         * @returns {void}
         */
        fix: (fixer) => fixer.remove(node)
      }
    ]
  });
};

/**
 * @description Constructs a rule that can demonstrate using selectors to force action.
 * @param {function} report
 * @param {string} selector
 * @param {getSourceCode} SC
 * @returns {function(node) : void}
 */
const makeForcer = (report, selector) => (node) => {
  console.log({ selector }, node.value || node.tagName || node.value);
  report({
    node,
    messageId: 'RemoveThis',
    data: {
      type: node.type,
      selector
    },
    /**
     * @description Removes the node.
     * @param {object} fixer Function containing fixer methods.
     * @returns {void}
     */
    fix: (fixer) => {
      fixer.remove(node);
    }
  });
};

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prints selector used to find this node',
      recommended: false,
      url: 'https://npmjs.org/@suitegeezus/eslint-sdf-xml-parser'
    },
    messages: {
      YouSelected: 'You selected a {{type}} node via {{selector}}',
      RemoveThis: 'Example fix: Remove this node (and contents)'
    },
    hasSuggestions: true,
    fixable: 'code'
    // schema: [] // no options
  },
  /**
   * @description Exposes callbacks for the visitor keys and /or selectors.
   * @param {object} context Options Object.
   * @param {string} context.id Rule id.
   * @param {object} context.options Configuration requested for the rule.
   * @param {Function} context.report Built-in reporter.
   * @param {Function} context.getSourceCode Gets An object to expose the sourcecode.
   * @returns {Object<string,Function>} Object of functions for visitors.
   */
  create({ id, options, report, getSourceCode }) {
    const visitorFns = {};

    const SourceCode = getSourceCode();

    options.forEach(({ selector, force }) => {
      const newFn = force ? makeForcer(report, selector) : makePrinter(report, selector);

      Object.assign(visitorFns, { [selector]: newFn });
    });

    return visitorFns;
  }
};
