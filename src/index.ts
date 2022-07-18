import {AST, SourceCode} from 'eslint';
import {ScopeManager, Scope} from 'eslint-scope';
import {Parser} from 'htmlparser2';
import {Handler} from "htmlparser2/lib/Parser";
import {
    ESLintXmlParserToken,
    XmlElement,
    XmlAttribute,
    XmlText,
    XmlComment,
    ESLintXmlParseResult,
    XmlSyntaxTree,
    ParserOptions
} from '../types';

// const startsWithHtmlTag: RegExp = /^\s*</;


/**
 * @description
 * @param {Pick<Parser, 'startIndex'|'endIndex'>} indices
 * @param {number} indices.startIndex
 * @param {number} indices.endIndex
 * @returns {[number,number]}
 */
const rangePlus1  = ({ startIndex , endIndex } :  Pick<Parser,'startIndex'|'endIndex'>) : [number,number] => [startIndex, endIndex+1];

/**
 * @description slices the code string properly
 * @param {object} options Options object
 * @param {string} options.code
 * @param {number} options.startIndex
 * @param {number} options.endIndex
 * @returns {string}
 */
const slicedCodePlus1 = ({code, startIndex, endIndex} : { code : string , startIndex : number, endIndex : number}) : string =>code.slice(...rangePlus1({startIndex,endIndex}));



const contentsOfTagRgx = /^(?:<(?<tagname>[^ >]+))(?:[^\/>]*\/[>]$|[^\/>]*[>](?<content>.*?)(?:<\/\k<tagname>)>$)/

/**
 * @description Extracts the content
 * @param {string} raw
 * @returns {string|null}
 */
const extractInner = ({raw}) : string|null => raw.match(contentsOfTagRgx)?.groups?.content || null;

export const parseForESLint = (code: string, parserOptions :Partial<ParserOptions>): ESLintXmlParseResult => {

    let lineBreakIndices: number[] = [-1];
    let currentIndex = code.indexOf('\n');

    while (currentIndex != -1) {
        lineBreakIndices.push(currentIndex);
        currentIndex = code.indexOf('\n', currentIndex + 1);
    }

    let tabIndices: number[] = [];
    currentIndex = code.indexOf('\t');

    while (currentIndex != -1) {
        tabIndices.push(currentIndex);
        currentIndex = code.indexOf('\t', currentIndex + 1);
    }

    function getLineAndColumn(index: number) {
        let lineNumber: number = 0;

        for (; lineNumber < lineBreakIndices.length; lineNumber++) {
            if (index < lineBreakIndices[lineNumber]) {
                break;
            }
        }

        let column: number = index - lineBreakIndices[lineNumber - 1] - 1;
        let tabNumber: number = -1;

        while (++tabNumber < tabIndices.length) {
            if (tabIndices[tabNumber] <= lineBreakIndices[lineNumber - 1]) {
                continue;
            }

            if (tabIndices[tabNumber] < index) {
                column += 4;
            } else {
                break;
            }
        }

        return {
            line: lineNumber,
            column: column
        };
    }

    let visitorKeys: SourceCode.VisitorKeys = {
        'Program': ['root'],
        'XmlAttribute': [],
        'XmlElement': ['children', 'attributes'],
        'XmlText': [],
        'XmlComment': []
    };

    const tokens: ESLintXmlParserToken[] = [];
    let root: XmlElement = null;

    const currentNodes: any = {
        currentElement: null,
        currentAttribute: null
    };

    currentNodes.currentElement = null;
    currentNodes.currentAttribute = null;

    let parseHandler: Partial<Handler> = {
        /**
         * @description updates the currentElement but does not update tokens.
         * Tokens are updated when it is closed.
         * @param name
         */
        onopentagname:  (tagName: string) :void => {
            const raw = slicedCodePlus1({code,...htmlParser});
        let element: XmlElement = {
            comments: [],
            type: 'XmlElement',
            tagName,
            parent: currentNodes.currentElement,
            value: extractInner({raw}),
            raw,
            range: rangePlus1(htmlParser),
            loc: {
                start: getLineAndColumn(htmlParser.startIndex),
                end: null
            },
            children: [],
            attributes: []
        };

        if (!root && currentNodes.currentElement === null) root = element;

        currentNodes.currentElement?.children.push(element);
        currentNodes.currentElement = element;
    },

        onattribute: (attribName: string, attribValue: string, quote): void => {
            const raw = slicedCodePlus1({code,...htmlParser});
            const [a,b] = rangePlus1(htmlParser);
            let attribute: XmlAttribute = {
                type: 'XmlAttribute',
                range: [a, b],
                parent: currentNodes.currentElement,
                attribName,
                attribValue,
                raw,
                value: extractInner({raw}),
                loc: {
                    start: getLineAndColumn(a),
                    end: getLineAndColumn(b)
                }
            };
            Object.assign(currentNodes, {currentAttribute: attribute});

            currentNodes.currentElement.attributes.push(attribute);

            tokens.push(attribute);
        },

        onopentag: (tagName: string): void => {
            if(currentNodes.currentElement.tagName !== tagName ) throw new Error('open tag does not match currentElement');
            currentNodes.currentElement.range[0] = htmlParser.startIndex;
            currentNodes.currentElement.raw = slicedCodePlus1({code,...htmlParser});
            currentNodes.currentElement.value = extractInner({raw : currentNodes.currentElement.raw})
            currentNodes.currentElement.loc.start = getLineAndColumn(htmlParser.startIndex)
            tokens.push(currentNodes.currentElement);
        },

        onclosetag: (tagName: string): void => {
            if(currentNodes.currentElement.tagName !== tagName ) throw new Error('open tag does not match currentElement');
            const [,endIndex] = rangePlus1(htmlParser);
            const startIndex = currentNodes.currentElement.range[0];
            currentNodes.currentElement.range[1] = endIndex;
            currentNodes.currentElement.loc.end = getLineAndColumn(endIndex);
            currentNodes.currentElement.raw = slicedCodePlus1({code,startIndex, endIndex : htmlParser.endIndex });
            currentNodes.currentElement.value = extractInner({ raw : currentNodes.currentElement.raw });

            currentNodes.currentElement = currentNodes.currentElement.parent;
        },

        ontext: (text: string) => {
            const raw :string =  slicedCodePlus1({code,...htmlParser});
            const [a,b] = rangePlus1(htmlParser);

            let textContent : XmlText = {
                type: 'XmlText',
                parent: currentNodes.currentElement,
                text,
                value : text,
                raw,
                range: [a,b],
                loc: {
                    start: getLineAndColumn(a),
                    end: getLineAndColumn(b)
                }
            };
            currentNodes.currentElement?.children.push(textContent);

            tokens.push(textContent);
        },

        oncomment: (comment: string) => {
            const raw :string =  slicedCodePlus1({code,...htmlParser});
            const [a,b] = rangePlus1(htmlParser);

            let newComment: XmlComment = {
                type: 'XmlComment',
                parent: currentNodes.currentElement,
                comment,
                value : extractInner({raw}),
                raw,
                range: [a,b],
                loc: {
                    start: getLineAndColumn(a),
                    end: getLineAndColumn(b)
                }
            }
            currentNodes.currentElement?.children.push(newComment);
            tokens.push(newComment);
        },

    }

    const defaultOptions : ParserOptions = {
        xmlMode : false,
        decodeEntities : true,
        lowerCaseTags: false,
        lowerCaseAttributeNames: false,
        recognizeSelfClosing: true
    };

    const options = Object.entries(parserOptions).reduce(( acc, [key])=>{
        // do not allow new option keys
        if( typeof defaultOptions[key] === 'undefined') return acc;
        return {
            ...acc,
            [key]: parserOptions[key]
        };
    },defaultOptions);

    let htmlParser: Parser = new Parser(parseHandler, options)

    htmlParser.parseComplete(code);

    let syntaxTree: XmlSyntaxTree = {
        type: 'Program',
        comments: [],
        tokens: tokens,
        raw: code.slice(root.range[0],root.range[1]),
        root: root,
        loc: root.loc,
        range: root.range,
        value: code.slice(root.range[0], root.range[1] - root.range[0])
    };

    // Can't augment the type declarations to include constructors, so we're
    // stuck with ignoring these two instantiations

    // @ts-ignore
    let scopeManager: ScopeManager = new ScopeManager({});
    // @ts-ignore
    let globalScope: Scope = new Scope(scopeManager, 'module', null, syntaxTree, false);

    let result: ESLintXmlParseResult = {
        ast: syntaxTree,
        visitorKeys: visitorKeys,
        scopeManager: scopeManager,
        services: {}
    };

    return result;
};

export function parse(code: string, options: any): XmlSyntaxTree | AST.Program {
    return parseForESLint(code, options).ast;
}
