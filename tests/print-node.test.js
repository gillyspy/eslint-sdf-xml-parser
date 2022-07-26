const { RuleTester } = require('eslint');
// eslint-disable-next-line import/extensions
const rule = require('../rules/print-node');

const ruleTester = new RuleTester({
  parser: require.resolve('../dist/index'),
  parserOptions: {
    ecmaVersion: 'es6',
    sourceType: 'module'
  },
  settings: {}
});

describe('print-node', () => {
  const code = `<entityForm scriptid="custform123"><somegroup><sometag>somevalue</sometag><label/></somegroup></entityForm>`;
  ruleTester.run('print-node', rule, {
    valid: [],
    invalid: [
      {
        code,
        options: ['Tag[tagName="entityForm"][scriptid!="custform123"]'],
        output: code,
        errors: [
          {
            line: 1,
            column: 2,
            messageId: 'youAreMakingMe'
          }
        ]
      },
      {
        code,
        options: ['Tag[$scriptid] > Attr > AttrName[value="scriptid"]'],
        output: ';lkjlk;j',
        errors: [
          {
            line: 0,
            column: 2,
            messageId: 'youAreMakingMe'
          }
        ]
      }
    ]
  });
});
