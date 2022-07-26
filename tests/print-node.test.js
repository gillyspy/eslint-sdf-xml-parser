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
  const code = `
<!-- hi -->
<entityForm scriptid="custform123">
  <!-- two
   -->
  <somegroup>
    <sometag>somevalue</sometag>
    <label/>
  </somegroup>
</entityForm><!-- last one -->`;
  ruleTester.run('print-node', rule, {
    valid: [],
    invalid: [
      {
        code,
        options: [
          {
            selector: 'Tag[tagName="entityForm"][scriptid!="custform123"]',
            force: false
          }
        ],
        errors: [
          {
            line: 1,
            column: 2,
            messageId: 'YouSelected'
          }
        ]
      },
      {
        code,
        options: [
          {
            selector: 'Tag[$scriptid] > Attr > AttrName[value="scriptid"]',
            force: false
          }
        ],
        output: '',
        errors: [
          {
            line: 0,
            column: 2,
            messageId: 'YouSelected'
          }
        ]
      },
      // this will remove the attribute
      {
        code,
        options: [
          {
            selector: 'Tag[$scriptid] > Attr[name="scriptid"] ',
            force: true
          }
        ],
        output: '',
        errors: [
          {
            line: 0,
            column: 2,
            messageId: 'YouSelected'
          }
        ]
      },
      {
        code,
        options: [
          {
            selector: 'Tag[$scriptid] > Line , Block ',
            force: true
          }
        ],
        output: '',
        errors: [
          {
            line: 0,
            column: 2,
            messageId: 'YouSelected'
          }
        ]
      },
      {
        code,
        options: [
          {
            selector: 'Tag[tagName="lable"] > Tag.parent  ',
            force: true
          }
        ],
        output: '',
        errors: [
          {
            line: 0,
            column: 2,
            messageId: 'YouSelected'
          }
        ]
      }
    ]
  });
});
