import { AST } from 'eslint';
import { ScopeManager, Scope } from 'eslint-scope';

/* eslint-disable object-curly-newline */
import { Parser } from 'htmlparser2';
import {
  ESLintXmlParserToken,
  XmlElement,
  XmlAttribute,
  XmlText,
  XmlRoot,
  XmlComment,
  ESLintXmlParseResult,
  XmlSyntaxTree,
  ParserOptions,
  SdfParserOptions
} from '../types';
import SdfParser from './Parser';
/* eslint-enable object-curly-newline */

// const startsWithHtmlTag: RegExp = /^\s*</;

/**
 * @description By default an element can have XmlText children. But sometimes it should be restricted in its
 * ability to contain text.
 *
 * # Can-have-text if:
 * - has a closing tag but no XmlElement children.
 * - not on the "cannot-have-text" list.
 * - exempted by special awareness.
 *
 * # Cannot-have-text if:
 * - Has XmlElement children.
 *
 * if an element has a parent then it can tell the parent that it is no longer allowed to have text.
 * @todo Create the list.
 * @throws {TypeError} On invalid element type.
 */

/**
 * @description
 * @param childElement
 * @returns {boolean}
 * @private
 */
const parentCanHaveTextChildren = (childElement: XmlElement | XmlRoot): boolean => {
  // irrelevant for the root
  const { type: childType, parent, tagName } = childElement;

  if (parent === null) return true;

  const acceptableType = 'XmlElement';

  if (childType !== acceptableType) throw new TypeError(`you can only call this with type '${acceptableType}'`);

  // for efficiency of checking children;
  if (parent.canHoldText === false) return false;

  // if it has text children already then throw an error
  if (parent.children.filter(({ type }) => type === 'XmlElement').length) throw new TypeError(`${tagName} already has XmlText as children`);

  return false;
};

const contentsOfTagRgx = /^(?:<(?<tagname>[^ >]+))(?:[^\/>]*\/[>]$|[^\/>]*[>](?<content>.*?)(?:<\/\k<tagname>)>$)/;

/**
 * @description Extracts the content.
 * @param {string} raw
 * @returns {string|null}
 * @example
 */
const extractInner = ({ raw }): string | null => raw.match(contentsOfTagRgx)?.groups?.content || null;

/**
 *
 * @param code
 * @param parserOptions
 * @example
 */

/**
 *
 */
export const parseForEsLint = (code: string, options): ESLintXmlParseResult => {
  const parser = new SdfParser({ code, parser: Parser, parserOptions: options });

  // parser.parse()

  const syntaxTree: XmlSyntaxTree = {
    type: 'Program',
    comments: [],
    tokens,
    raw: code.slice(root.range[0], root.range[1]),
    root,
    loc: root.loc,
    range: root.range,
    value: code.slice(root.range[0], root.range[1] - root.range[0])
  };

  // Can't augment the type declarations to include constructors, so we're
  // stuck with ignoring these two instantiations

  // @ts-ignore
  const scopeManager: ScopeManager = new ScopeManager({});
  // @ts-ignore
  const globalScope: Scope = new Scope(scopeManager, 'module', null, syntaxTree, false);

  const result: ESLintXmlParseResult = {
    ast: syntaxTree,
    visitorKeys,
    scopeManager,
    services: {}
  };

  return result;
};

/**
 * @function
 * @param {string} code
 * @param {object} options
 * @example
 */
export function parse(code: string, options?: object): XmlSyntaxTree | AST.Program {
  return parseForESLint(code, options).ast;
}
