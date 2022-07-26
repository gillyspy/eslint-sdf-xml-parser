require('eslint');
/**
 * @description This is an example rule called `print-node`.
 */

/**
 * @description Constructs a rule that can demonstrate using selectors.
 * @param {function} report
 * @param {string} selector
 * @returns {function(node) : void}
 */
const makePrinter = (report, selector) => (node) =>
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
   * @param {Object} context Options Object.
   * @param {string} context.id rule id.
   * @param {Object} context.options configuration requested for the rule.
   * @param {Function} context.report Built-in reporter.
   * @returns {Object<string,function>}
   */
  create({ id, options, report }) {
    const visitorFns = {};

    options.forEach((selector) => Object.assign(visitorFns, { [selector]: makePrinter(report, selector) }));

    return visitorFns;
  }
};
