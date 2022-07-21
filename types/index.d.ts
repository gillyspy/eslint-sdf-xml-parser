import { AST, SourceCode } from 'eslint';
import {
  /* Statement, ModuleDeclaration, BaseNodeWithoutComments, */
  BaseNode,
  Comment
  // eslint-disable-next-line import/no-unresolved
} from 'estree';
import { ScopeManager } from 'eslint-scope';


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

export type XmlTokenType =
  | 'XmlTagName'
  | 'XmlAttrExpression'
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

export type XmlComment = Comment;

// a Node is what the visitor keys will be based upon
export type ESLintXmlParserNode = 'XmlElement' | 'XmlAttribute' | 'XmlAttributeName' | 'XmlAttributeValue' | 'XmlText';

// element related

// base element is one that others are based on (and is never directly assigned)
// all elements can have attributes
export interface XmlBaseElement extends BaseNode {
  comments: null;
  type: string;
  parent: XmlElement | null;
  tagName: null;
  canHoldText: null;
  attributes: XmlAttribute[];
  isClosed: null;
  // no children
  children: null;
}

export interface XmlDynamicElement extends XmlBaseElement {
  comments: Comment[];
  type: string;
  parent: XmlElement;
  tagName: string;
  canHoldText: boolean;
  attributes: XmlAttribute[];
  isClosed: boolean;
  children: (XmlElement | XmlText)[];
}



export interface XmlText extends BaseNode {
  type: 'XmlText';
  value: string;
  parent: XmlElement;
}

export interface XmlRoot extends XmlBaseElement {
  comments: XmlComment[];
  type: 'XmlRoot';
  canHoldText: boolean;
  children: (XmlElement | XmlText)[];
  isClosed;
  boolean;
  parent: null;
}

// bottom element is one that
// can never have children (by SDF definition)
// and can never have comments
export interface XmlBottomElement extends XmlBaseElement {
  type: 'XmlBottomElement';
  comments: null;
  canHoldText: boolean;
  isClosed: boolean;
  parent: XmlElement;
}

// group element is one that
// can have child (by SDF definition)
// can never contain text
// can have comments
export interface XmlGroupElement extends XmlBaseElement {
  comments: Comment[];
  type: 'XmlGroupElement';
  tagName: string;
  canHoldText: false;
  isClosed: boolean;
  parent: XmlElement;
  children: (XmlElement | XmlText)[];
}

// the value of XmlElement is derived from the token methods
// every element has a parent otherwise it is a root
export interface XmlClosedElement extends XmlBaseElement {
  type: 'XmlClosedElement';
  parent: XmlElement;
  isClosed: boolean;
}

export type XmlElement = XmlRoot | XmlBottomElement | XmlGroupElement | XmlClosedElement | XmlBaseElement | XmlDynamicElement;

// ////// attribute related

export interface XmlAttributeValue extends BaseNode {
  type: 'XmlAttributeValue';
  tag: XmlElement;
}

export interface XmlAttributeName extends BaseNode {
  type: 'XmlAttributeName';
  tag: XmlElement;
  attributeValue: XmlAttributeValue;
}

export interface XmlAttribute extends BaseNode {
  type: 'XmlAttribute';
  tag: XmlElement;
  attributeName: XmlAttributeName;
  attributeValue: XmlAttributeValue;
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

export interface XmlSyntaxTree extends ESLintXmlParserToken {
  comments: any[];
  tokens: ESLintXmlParserToken[];
  root: XmlRoot;
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
