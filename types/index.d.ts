import { AST, SourceCode } from 'eslint';
import {
  /* Statement, ModuleDeclaration, BaseNodeWithoutComments, */
  BaseNode,
  Comment
  // eslint-disable-next-line import/no-unresolved
} from 'estree';
import { ScopeManager } from 'eslint-scope';
import { Tokenizer } from 'htmlparser2';

/**
 * @description Tokens range should not overlap and so our choice of
 * how to deal with that is directly related to the base parser that is
 * already tokenizing the XML.
 *
 * For htmlparser2 there are key events in the parsing that are opportunities to tokenize.
 *
 * A token is not the same as a node.
 * A token is more like a physical breakdown of the xml. opentag, text, closetag
 * A node is a logical constructor like tag (which might have children that are also nodes.
 *
 * Relying on this mechanism will allow rules engines that use this parser to utilize `ESLint.RuleContext`
 * methods more directly.
 */

/* eslint-disable no-use-before-define */
export type SdfQuoteType = QuoteType;

export type XmlTokenType =
  | 'XmlTagName'

  // e.g. scriptid
  | 'XmlAttrName'

  // e.g. "="
  | 'XmlAttrOperator'

  // e.g. "custform123"
  | 'XmlAttrValue'

  // e.g. '"'
  | 'XmlAttrQuote'

  // e.g. "<"
  | 'XmlTagBeginSoft'

  // e.g. "</"
  | 'XmlTagBeginHard'

  // e.g. ">"
  | 'XmlTagEndSoft'

  // e.g. "/>"
  | 'XmlTagEndHard';

export interface ESLintXmlParserToken extends AST.Token {
  type: XmlTokenType;
  value: string;
  range: AST.Range;
  loc: AST.SourceLocation;
}

export interface XmlPosition {
  /** >= 1 */
  line: number;
  /** >= 0 */
  column: number;
}

export interface XmlSourceLocation extends AST.SourceLocation {
  start: XmlPosition;
  end: XmlPosition;
}

export type XmlComment = Comment;

// a Node is what the visitor keys will be based upon
export type ESLintXmlParserNode = 'Tag' | 'Attr' | 'AttrName' | 'AttrVal' | 'Text';

// element related

// base element is one that others are based on (and is never directly assigned)
// all elements can have attributes
export interface XmlBaseElement extends BaseNode {
  attr: Attr[];
  canHoldText: boolean;
  children: (Tag | Text)[];
  comments: Comment[];
  innerHTML: string;
  isClosed: boolean;
  parent: Tag | null;
  type: 'Tag';
  tagName: string;
  // no children
  // arbitrary keys based on attributes
  [key: string]: unknown;
}

export interface XmlAdhoc extends XmlBaseElement {
  type: string;
}

export interface Text extends BaseNode {
  type: 'Text';
  value: string;
  parent: Tag;
}

export type Tag = XmlBaseElement | XmlAdhoc;

// ////// attribute related

export interface AttrVal extends BaseNode {
  type: 'AttrVal';
  parent: Attr;
  // tag: Tag;
  value: string;
  quote: '"' | "'" | '' | undefined;
}

export interface AttrName extends BaseNode {
  type: 'AttrName';
  parent: Attr;
  // tag: Tag;
  value: string;
  // attributeValue: AttrVal;
}

export interface Attr extends BaseNode {
  type: 'Attr';
  // tag: Tag;
  parent: Tag;
  name: string;
  // these need to be fields of the Attr visitor key
  attrName: AttrName;
  attrValue: AttrVal;
}

// /////

export interface ParserOptions {
  xmlMode?: boolean;
  decodeEntities?: boolean;
  lowerCaseTags?: boolean;
  lowerCaseAttributeNames?: boolean;
  recognizeSelfClosing?: boolean;
  Tokenizer?: typeof Tokenizer;
}

export interface SdfParserOptions extends ParserOptions {
  hasScriptIds?: boolean;
}

export interface XmlSyntaxTree extends BaseNode {
  comments: any[];
  tokens: ESLintXmlParserToken[];
  root: Tag;
  type: 'Program';
}

export interface ESLintXmlParseResult {
  ast: XmlSyntaxTree;
  services?: Record<string, unknown>;
  scopeManager?: ScopeManager;
  visitorKeys?: SourceCode.VisitorKeys;
}

export function parseForESLint(code: string, options?: any): ESLintXmlParseResult;

export function parse(code: string, options: any): XmlSyntaxTree;
