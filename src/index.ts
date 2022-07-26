/**
 * @file
 *
 * # Features:
 * - Full Support of [EsLintRule.RuleContext]{@link https://eslint.org/docs/latest/developer-guide/working-with-custom-parsers} methods.
 * - Support for [Selectors]{@link https://eslint.org/docs/latest/developer-guide/selectors}.
 *
 * # Parser Options
 * - `commentNodes` : boolean - specifies whether to also expose comments as nodes attached top tag.children with a
 * value that includes their braces.  Regardless of this setting the Comments are accessible as Eslint's default
 * (i.e. via `Tag.comments` property using Types `Line|Block`) e.g. `Tag > Line.comments[value*=text]`
 * - `tab` : What respresents a tab. Default is `  ` (two spaces).
 * - `attrProperties` : boolean - specifies whether attribute name,value pairs exist on the Tag node for
 * convenience. e.g. `Tag[tagName="entityForm"][$scriptid="custform123"]` which is very difficult to select
 * otherwise. Default is `true`. All attributes linked this way are still related as normal but on the Tag attribute
 * the keys appear pre-fixed by `$`.
 * - All relevant parser options of [htmlparser2]{@link https://www.npmjs.com/package/htmlparser2}.
 * @module @suitegeezus/eslint-sdf-xml-parser/Parser
 */

import { ScopeManager, Scope } from 'eslint-scope';

import { ESLintXmlParseResult, XmlSyntaxTree } from '../types';
import SdfParser from './Parser';


/**
 *
 * @param code
 * @param options
 * @example //
 * @returns {ESLintXmlParseResult}
 */
export const parseForESLint = (code: string, options): ESLintXmlParseResult => {
  const parser = new SdfParser({ code, parserOptions: options });

  // trigger the parser but we do not need the output
  parser.parse();

  const { visitorKeys, tokens, root, comments } = parser;

  const syntaxTree: XmlSyntaxTree = {
    type: 'Program',
    comments,
    tokens,
    root,
    loc: root.loc, // can get the location programmatically later
    range: root.range
    // value: code.substr(root.range[0], root.range[1] - root.range[0])
  };

  // Can't augment the type declarations to include constructors, so we're
  // stuck with ignoring these two instantiations

  /* eslint-disable @typescript-eslint/ban-ts-comment, no-new */
  // @ts-ignore
  const scopeManager: ScopeManager = new ScopeManager({});
  // @ts-ignore
  new Scope(scopeManager, 'module', null, syntaxTree, false);
  /* eslint-enable @typescript-eslint/ban-ts-comment */

  const result: ESLintXmlParseResult = {
    ast: syntaxTree,
    visitorKeys,
    scopeManager,
    services: {}
  };

  return result;
};

/**
 * @function Required function for a parser
 * @param {string} code
 * @param {object} options
 * @example //
 * @returns {XmlSyntaxTree}
 */
export function parse(code: string, options?: object): XmlSyntaxTree {
  const { ast } = parseForESLint(code, options);
  return ast;
}
