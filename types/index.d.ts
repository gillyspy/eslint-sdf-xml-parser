import { AST, SourceCode } from 'eslint';
import { Statement, ModuleDeclaration } from 'estree';
import { ScopeManager } from 'eslint-scope';

export type XmlTokenType =
    | 'XmlAttribute'
    | 'XmlText'
    | 'XmlElement'
    | 'XmlComment'
    | 'Program'

export interface ParserOptions {
        xmlMode? : boolean;
        decodeEntities? : boolean;
        lowerCaseTags?: boolean;
        lowerCaseAttributeNames?: boolean;
        recognizeSelfClosing?: boolean;
}

export interface ESLintXmlParserToken {
    type: XmlTokenType | AST.TokenType;
    raw: string;
    value: string;
    range: AST.Range;
    loc: AST.SourceLocation;
}

export interface XmlAttribute extends ESLintXmlParserToken {
    type: 'XmlAttribute';
    parent: XmlElement;
    attribName : string;
    attribValue: string;
}

export interface XmlText extends ESLintXmlParserToken {
    type: 'XmlText';
    parent: XmlElement;
    text : string;
}


export interface XmlComment extends ESLintXmlParserToken {
    type: 'XmlComment';
    parent: XmlElement;
    comment: string;
}


export interface XmlElement extends ESLintXmlParserToken {
    comments: string[];
    type: 'XmlElement';
    tagName: string;
    parent?: XmlElement;
    attributes: XmlAttribute[];
    children: (XmlElement | XmlText | XmlComment | Statement | ModuleDeclaration)[];
}

export interface XmlSyntaxTree extends ESLintXmlParserToken {
    comments: any[];
    tokens: ESLintXmlParserToken[];
    root: XmlElement;
    type: 'Program'
}

export interface ESLintXmlParseResult {
    ast: XmlSyntaxTree | AST.Program;
    services?: Object;
    scopeManager?: ScopeManager;
    visitorKeys?: SourceCode.VisitorKeys;
}

export function parseForESLint(code: string, options?: any): ESLintXmlParseResult;

export function parse(code: string, options: any): XmlSyntaxTree | AST.Program;
