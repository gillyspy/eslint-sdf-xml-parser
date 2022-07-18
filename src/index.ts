import {AST, SourceCode}     from 'eslint';
import {ScopeManager, Scope} from 'eslint-scope';
import {Parser}              from 'htmlparser2';
import {Handler}             from "htmlparser2/lib/Parser";
import {
  ESLintXmlParserToken,
  XmlElement,
  XmlAttribute,
  XmlText,
  XmlRoot,
  XmlComment,
  ESLintXmlParseResult,
  XmlSyntaxTree,
  ParserOptions
}                            from '../types';

// const startsWithHtmlTag: RegExp = /^\s*</;


/**
 * @description By default an element can have XmlText children. But sometimes it should be restricted in its
 * ability to contain text.
 *
 * # Can-have-text if:
 * - has a closing tag but no XmlElement children.
 * - not on the "cannot-have-text" list.
 * - exempted by special awareness
 *
 * # Cannot-have-text if:
 * - Has XmlElement children
 *
 * if an element has a parent then it can tell the parent that it is no longer allowed to have text
 * @todo create the list
 * @throws {TypeError} on invalid element type.
 */


const parentCanHaveTextChildren = (childElement: (XmlElement|XmlRoot)): boolean => {
  // irrelevant for the root
  const {type : childType, parent, tagName } = childElement;

  if( parent === null ) return;

  const acceptableType = "XmlElement";

  if (childType !== acceptableType) throw new TypeError(`you can only call this with type '${acceptableType}'`);

  // for efficiency of checking children;
  if( parent.canHoldText === false ) return false;

  // if it has text children already then throw an error
  if( Boolean(parent.children.filter(({type})=> type === 'XmlElement' ).length))
    throw new TypeError(`${tagName} already has XmlText as children`);

  return false;
};

/**
 * @description
 * @param {Pick<Parser, 'startIndex'|'endIndex'>} indices
 * @param {number} indices.startIndex
 * @param {number} indices.endIndex
 * @returns {[number,number]}
 */
const rangePlus1 = ({
                      startIndex,
                      endIndex
                    }: Pick<Parser, 'startIndex' | 'endIndex'>): [number, number] => [startIndex, endIndex + 1];

/**
 * @description slices the code string properly
 * @param {object} options Options object
 * @param {string} options.code
 * @param {number} options.startIndex
 * @param {number} options.endIndex
 * @returns {string}
 */
const slicedCodePlus1 = ({
                           code,
                           startIndex,
                           endIndex
                         }: { code: string, startIndex: number, endIndex: number }): string => code.slice(...rangePlus1({
  startIndex,
  endIndex
}));


const contentsOfTagRgx = /^(?:<(?<tagname>[^ >]+))(?:[^\/>]*\/[>]$|[^\/>]*[>](?<content>.*?)(?:<\/\k<tagname>)>$)/

/**
 * @description Extracts the content
 * @param {string} raw
 * @returns {string|null}
 */
const extractInner = ({raw}): string | null => raw.match(contentsOfTagRgx)?.groups?.content || null;

export const parseForESLint = (code: string, parserOptions: Partial<ParserOptions>): ESLintXmlParseResult => {

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
      line  : lineNumber,
      column: column
    };
  }

  let visitorKeys: SourceCode.VisitorKeys = {
    'Program'     : ['root'],
    'XmlAttribute': [],
    'XmlElement'  : ['children', 'attributes'],
    'XmlText'     : [],
    'XmlComment'  : []
  };

  const tokens: ESLintXmlParserToken[] = [];
  let root: XmlElement = null;

  const currentNodes: any = {
    currentElement  : null,
    currentAttribute: null
  };

  currentNodes.currentElement = null;
  currentNodes.currentAttribute = null;

  let parseHandler: Partial<Handler> = {
    /**
     * @description updates the currentElement but does not update tokens.
     * Tokens are updated when it is closed.
     * @param {string} tagName
     */
    onopentagname: (tagName: string): void => {
      const raw = slicedCodePlus1({code, ...htmlParser});

      // initially create as root and then evaluate
      const newElement: (XmlRoot|XmlElement) = {
        comments   : [],
        type       : 'XmlElement',
        tagName,
        canHoldText: true,
        parent     : null,
        value      : extractInner({raw}),
        raw,
        range      : rangePlus1(htmlParser),
        loc        : {
          start: getLineAndColumn(htmlParser.startIndex),
          end  : null
        },
        children   : [],
        attributes : []
      };

      // if we need a parent this must be it
      if (!root && currentNodes.currentElement === null) root = newElement as XmlRoot;

      // if we have a root then the current element is parent
      if (root) newElement.parent = currentNodes.currentElement;

      // see if this element can hold text;
      newElement.canHoldText = parentCanHaveTextChildren(newElement);

      currentNodes.currentElement?.children.push(newElement);

      // update current element
      currentNodes.currentElement = newElement;
    },

    onattribute: (attribName: string, attribValue: string, quote): void => {
      const raw = slicedCodePlus1({code, ...htmlParser});
      const [a, b] = rangePlus1(htmlParser);
      let attribute: XmlAttribute = {
        type  : 'XmlAttribute',
        range : [a, b],
        parent: currentNodes.currentElement,
        attribName,
        attribValue,
        raw,
        value : extractInner({raw}),
        loc   : {
          start: getLineAndColumn(a),
          end  : getLineAndColumn(b)
        }
      };
      Object.assign(currentNodes, {currentAttribute: attribute});

      currentNodes.currentElement.attributes.push(attribute);

      tokens.push(attribute);
    },

    onopentag: (tagName: string): void => {
      if (currentNodes.currentElement.tagName !== tagName) throw new Error('open tag does not match currentElement');
      currentNodes.currentElement.range[0] = htmlParser.startIndex;
      currentNodes.currentElement.raw = slicedCodePlus1({code, ...htmlParser});
      currentNodes.currentElement.value = extractInner({raw: currentNodes.currentElement.raw})
      currentNodes.currentElement.loc.start = getLineAndColumn(htmlParser.startIndex)
      tokens.push(currentNodes.currentElement);
    },

    onclosetag: (tagName: string): void => {
      if (currentNodes.currentElement.tagName !== tagName) throw new Error('open tag does not match currentElement');
      const [, endIndex] = rangePlus1(htmlParser);
      const startIndex = currentNodes.currentElement.range[0];
      currentNodes.currentElement.range[1] = endIndex;
      currentNodes.currentElement.loc.end = getLineAndColumn(endIndex);
      currentNodes.currentElement.raw = slicedCodePlus1({code, startIndex, endIndex: htmlParser.endIndex});
      currentNodes.currentElement.value = extractInner({raw: currentNodes.currentElement.raw});

      currentNodes.currentElement = currentNodes.currentElement.parent;
    },

    ontext: (text: string) => {
      const raw: string = slicedCodePlus1({code, ...htmlParser});
      const [a, b] = rangePlus1(htmlParser);

      let textContent: XmlText = {
        type  : 'XmlText',
        parent: currentNodes.currentElement,
        text,
        value : text,
        raw,
        range : [a, b],
        loc   : {
          start: getLineAndColumn(a),
          end  : getLineAndColumn(b)
        }
      };
      currentNodes.currentElement?.children.push(textContent);

      tokens.push(textContent);
    },

    oncomment: (comment: string) => {
      const raw: string = slicedCodePlus1({code, ...htmlParser});
      const [a, b] = rangePlus1(htmlParser);

      let newComment: XmlComment = {
        type  : 'XmlComment',
        parent: currentNodes.currentElement,
        comment,
        value : extractInner({raw}),
        raw,
        range : [a, b],
        loc   : {
          start: getLineAndColumn(a),
          end  : getLineAndColumn(b)
        }
      }
      currentNodes.currentElement?.children.push(newComment);
      tokens.push(newComment);
    },

  }

  const defaultOptions: ParserOptions = {
    xmlMode                : false,
    decodeEntities         : true,
    lowerCaseTags          : false,
    lowerCaseAttributeNames: false,
    recognizeSelfClosing   : true
  };

  const options = Object.entries(parserOptions).reduce((acc, [key]) => {
    // do not allow new option keys
    if (typeof defaultOptions[key] === 'undefined') return acc;
    return {
      ...acc,
      [key]: parserOptions[key]
    };
  }, defaultOptions);

  let htmlParser: Parser = new Parser(parseHandler, options)

  htmlParser.parseComplete(code);

  let syntaxTree: XmlSyntaxTree = {
    type    : 'Program',
    comments: [],
    tokens  : tokens,
    raw     : code.slice(root.range[0], root.range[1]),
    root    : root,
    loc     : root.loc,
    range   : root.range,
    value   : code.slice(root.range[0], root.range[1] - root.range[0])
  };

  // Can't augment the type declarations to include constructors, so we're
  // stuck with ignoring these two instantiations

  // @ts-ignore
  let scopeManager: ScopeManager = new ScopeManager({});
  // @ts-ignore
  let globalScope: Scope = new Scope(scopeManager, 'module', null, syntaxTree, false);

  let result: ESLintXmlParseResult = {
    ast         : syntaxTree,
    visitorKeys : visitorKeys,
    scopeManager: scopeManager,
    services    : {}
  };

  return result;
};

/**
 * @function
 * @param {string} code
 * @param {object} options
 */
export function parse(code: string, options?: object ): XmlSyntaxTree | AST.Program {
  return parseForESLint(code, options).ast;
}
