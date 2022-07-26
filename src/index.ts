import { ScopeManager } from 'eslint-scope';

import { ESLintXmlParseResult, XmlSyntaxTree } from '../types';
import SdfParser from './Parser';

// const startsWithHtmlTag: RegExp = /^\s*</;

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

  const { visitorKeys, tokens, root } = parser;

  const syntaxTree: XmlSyntaxTree = {
    type: 'Program',
    comments: [],
    tokens,
    root,
    // loc: root.loc, // can get the location programmatically later
    range: root.range
    // value: code.substr(root.range[0], root.range[1] - root.range[0])
  };

  // Can't augment the type declarations to include constructors, so we're
  // stuck with ignoring these two instantiations

  const scopeManager: ScopeManager = new ScopeManager();

  const result: ESLintXmlParseResult = {
    ast: syntaxTree,
    visitorKeys,
    scopeManager: null,
    services: {}
  };

  return result;
};

/**
 * @function
 * @param {string} code
 * @param {object} options
 * @example //
 * @returns {XmlSyntaxTree}
 */
export function parse(code: string, options?: object): XmlSyntaxTree {
  const { ast } = parseForESLint(code, options);
  return ast;
}
