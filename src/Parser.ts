/**
 * @description Would like to support as many as these EsLintRule.RuleContext methods as possible. To do that the
 * nodes need to have a clear definition of a nodes's range, their text contents and other AST.Token properties
 * - insertTextAfter(nodeOrToken, text) - inserts text after the given node or token
 * - insertTextAfterRange(range, text) - inserts text after the given range
 * - insertTextBefore(nodeOrToken, text) - inserts text before the given node or token
 * - insertTextBeforeRange(range, text) - inserts text before the given range
 * - remove(nodeOrToken) - removes the given node or token
 * - removeRange(range) - removes text in the given range
 * - replaceText(nodeOrToken, text) - replaces the text in the given node or token
 * - replaceTextRange(range, text) - replaces the text in the given range.
 *
 * ## insertTextAfter
 * - equivalent of creating a sibling element.
 * - if what you want is to append then you want to insert before the first child.
 * - if what you want is to prepend then you want to insert after the last child.
 * - if the tag is closed then you will have to.
 *
 * ## remove
 * - equivalent of removing the element.
 * - if what you want is rather to remove the contents then remove all the children.
 *
 * ## replaceText.
 */

import {BaseNode, Position, SourceLocation}                                                           from 'estree';
import {ESLintXmlParserToken, SdfParserOptions, XmlAttribute, XmlDynamicElement, XmlElement, XmlRoot} from "../types";
import {SourceCode}                                                                                   from "eslint";
import {Handler}                          from "htmlparser2/lib/Parser";
import {Parser, ParserOptions, Tokenizer} from "htmlparser2";
import {Callbacks}                        from "htmlparser2/lib/Tokenizer";

export default class SdfParser {

  public lineBreakIndices: number[];

  public tabIndices: number[];

  public code: string;

  private #currentIndex: number;

  public tokens: ESLintXmlParserToken[];

  visitorKeys: SourceCode.VisitorKeys;

  root: XmlRoot;

  public currentElement: XmlElement;
  public currentAttribute: XmlAttribute;

  private #innerParser: Parser;

  public readonly requestedOptions : SdfParserOptions;

  private #parserOptions : SdfParserOptions

  constructor({code, parserOptions}: { code: string; parserOptions: SdfParserOptions }) {
    this.code = code;
    this.#makeIndices();
    this.tokens = [];
    this.root = null;
    this.currentElement = null;
    this.currentAttribute = null;
    this.requestedOptions = { ...parserOptions };
    this.#parserOptions = null;

    this.visitorKeys = {
      'Program'     : ['root'],
      'XmlAttribute': [],
      'XmlElement'  : ['children', 'attributes'],
      'XmlText'     : [],
      'XmlComment'  : []
    };
  }

  parse() {
    this.#innerParser = new Parser(this.getParseHandler(), this.#parserOptions);
    return this.#innerParser.parseComplete(this.code);
  }

  #makeIndices() {
    this.lineBreakIndices = [-1];
    this.#currentIndex = this.code.indexOf('\n');

    while (this.#currentIndex != -1) {
      this.lineBreakIndices.push(this.#currentIndex);
      this.#currentIndex = this.code.indexOf('\n', this.#currentIndex + 1);
    }

    this.tabIndices = [];
    this.#currentIndex = this.code.indexOf('\t');

    while (this.#currentIndex !== -1) {
      this.tabIndices.push(this.#currentIndex);
      this.#currentIndex = this.code.indexOf('\t', this.#currentIndex + 1);
    }
  }

  /**
   * @description
   * @param {Pick<Parser, 'startIndex'|'endIndex'>} indices
   * @param {number} indices.startIndex
   * @param {number} indices.endIndex
   * @returns {[number,number]}
   * @example
   */
  rangePlus1({startIndex, endIndex}: Pick<Parser, 'startIndex' | 'endIndex'>): [number, number] {
    return [startIndex, endIndex + 1];
  }

  /**
   * @description Slices the code string properly.
   * @param {object} options Options object.
   * @param {string} options.code
   * @param {number} options.startIndex
   * @param {number} options.endIndex
   * @returns {string}
   * @example
   */
  slicedCodePlus1({ startIndex, endIndex}: { code: string; startIndex: number; endIndex: number }): string {
    return this.code.slice(
      ...this.rangePlus1({
        startIndex,
        endIndex
      })
    );
  }

  getLineAndColumn(index: number): Position {
    const lineBreakIndices = this.lineBreakIndices;
    const tabIndices = this.tabIndices;
    let lineNumber = 0;

    for (; lineNumber < lineBreakIndices.length; lineNumber++) {
      if (index < lineBreakIndices[lineNumber]) {
        break;
      }
    }

    let column: number = index - lineBreakIndices[lineNumber - 1] - 1;
    let tabNumber = -1;

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
      column
    };
  }

  getLoc(start: number, end: number): SourceLocation {
    return {
      start: this.getLineAndColumn(start),
      end  : this.getLineAndColumn(end)
    };
  }

  /**
   * @description add nodes and their fields to visitorKeys;
   * @param {string} keyName
   * @returns {void}
   */
  addVisitorKey({keyToAdd: key , fieldsToAdd} : {keyToAdd: string, fieldsToAdd: string[]} ): void {
    if( !this.visitorKeys[key] )
      this.visitorKeys[key] = fieldsToAdd;

    const existingFields: string[] = this.visitorKeys[key];

    this.visitorKeys[key] = Array.from(new Set([ ...existingFields, ...fieldsToAdd ]));
  }

  /**
   * @description Handlers are where the nodes are set. For tokens refer to `makeTokenizerCallbacks`
   * @see makeTokenizerCallbacks
   */
  getParseHandler(): Partial<Handler> {
    const openStack : XmlElement[] = [];

    return {
      /**
       * @description Updates the currentElement but does not update tokens.
       * Tokens are updated when it is closed.
       * @param {string} tagName
       * @example
       */
      onopentagname: (tagName: string): void => {
        // if we have a root then the most recent element is the parent for this element
        let parent : XmlElement = this.root === null ? null : openStack[0];
        let newElement : XmlElement;

        // initially create as root and then evaluate
        switch(true){
          // XmlRoot
          case  this.root === null :
          newElement = {
            comments   : [],
            type       : 'XmlRoot',
            tagName,
            isClosed : false,
            canHoldText: true,
            parent,
            children   : [],
            attributes : []
          } as XmlRoot
          break;
          case parent !== null:
            break;
          default:
            break;
        }

        parent?.children?.push( newElement );

        // see if this element can hold text;
        // newElement.canHoldText = parentCanHaveTextChildren(newElement);

        // update current element
        openStack.unshift( newElement );

        // make sure the node is represented by a visitor key.
        const newNode : XmlDynamicElement = {...newElement };
        newNode.type = tagName;

        this.addVisitorKey({ keyToAdd : tagName, fieldsToAdd : [] });
      },

      /**
       *
       * @param attribName
       * @param attribValue
       * @param quote
       * @example
       */
      onattribute: (attribName: string, attribValue: string, quote): void => {
        const raw = slicedCodePlus1({code, ...htmlParser});
        const [a, b] = rangePlus1(htmlParser);
        const attribute: XmlAttribute = {
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

      /**
       *
       * @param tagName
       * @example
       */
      onopentag: (tagName: string): void => {
        if (currentNodes.currentElement.tagName !== tagName) throw new Error('open tag does not match currentElement');
        currentNodes.currentElement.range[0] = htmlParser.startIndex;
        currentNodes.currentElement.raw = slicedCodePlus1({code, ...htmlParser});
        currentNodes.currentElement.value = extractInner({raw: currentNodes.currentElement.raw});
        currentNodes.currentElement.loc.start = getLineAndColumn(htmlParser.startIndex);
        tokens.push(currentNodes.currentElement);
      },

      /**
       *
       * @param tagName
       * @example
       */
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

      /**
       *
       * @param text
       * @example
       */
      ontext: (text: string) => {
        const raw: string = slicedCodePlus1({code, ...htmlParser});
        const [a, b] = rangePlus1(htmlParser);

        const textContent: XmlText = {
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

      /**
       *
       * @param comment
       * @example
       */
      oncomment: (comment: string) => {
        const raw: string = slicedCodePlus1({code, ...htmlParser});
        const [a, b] = rangePlus1(htmlParser);

        const newComment: XmlComment = {
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
        };
        currentNodes.currentElement?.children.push(newComment);
        tokens.push(newComment);
      }
    };
  }
/**
 * @description Makes Callbacks that the tokenizer will use. Callbacks can update the AST tokens by reference.
 * @param {Callbacks} parserPrototypes

 * @returns {Callbacks}
 */
 makeTokenizerCallbacks(parserPrototypes: Callbacks): Callbacks {
   const tokens = this.tokens;
  const cbs: Callbacks = {
    /**
     * @returns {void}
     */
    onattribdata(start: number, endIndex: number): void {
      tokens.push({
        type : 'XMLAttrExpression',
        value : '',
        range : [start, endIndex],
        loc: {
          start : this.getLineAndColumn(start),
          end : this.getLineAndColumn(endIndex)
        }
      })
      return parserPrototypes.onattribdata(start, endIndex);
    },
    /**
     * @returns {void}
     */
    onattribentity(codepoint: number): void {
      return parserPrototypes.onattribentity(codepoint);
    },
    /**
     * @returns {void}
     */
    onattribend(quote, endIndex: number): void {
      return parserPrototypes.onattribend(quote, endIndex);
    },
    /**
     * @returns {void}
     */
    onattribname(start: number, endIndex: number): void {
      return parserPrototypes.onattribname(start, endIndex);
    },
    /**
     * @returns {void}
     */
    oncdata(start: number, endIndex: number, endOffset: number): void {
      return parserPrototypes.oncdata(start, endIndex, endOffset);
    },
    /**
     * @returns {void}
     */
    onclosetag(start: number, endIndex: number): void {
      return parserPrototypes.onclosetag(start, endIndex);
    },
    /**
     * @returns {void}
     */
    oncomment(start: number, endIndex: number, endOffset: number): void {
      return parserPrototypes.oncomment(start, endIndex, endOffset);
    },
    /**
     * @returns {void}
     */
    ondeclaration(start: number, endIndex: number): void {
      return parserPrototypes.ondeclaration(start, endIndex);
    },
    /**
     * @returns {void}
     */
    onend(): void {
      return parserPrototypes.onend();
    },
    /**
     * @returns {void}
     */
    onopentagend(endIndex: number): void {
      return parserPrototypes.onopentagend(endIndex);
    },
    /**
     * @returns {void}
     */
    onopentagname(start: number, endIndex: number): void {
      return parserPrototypes.onopentagname(start, endIndex);
    },
    /**
     * @returns {void}
     */
    onprocessinginstruction(start: number, endIndex: number): void {
      return parserPrototypes.onprocessinginstruction(start, endIndex);
    },
    /**
     * @returns {void}
     */
    onselfclosingtag(endIndex: number): void {
      return parserPrototypes.onselfclosingtag(endIndex);
    },
    /**
     * @returns {void}
     */
    ontext(start: number, endIndex: number): void {
      return parserPrototypes.ontext(start, endIndex);
    },
    /**
     * @returns {void}
     */
    ontextentity(codepoint: number): void {
      return parserPrototypes.ontextentity(codepoint);
    }
  };
  return cbs;
};


   makeTokenizer (tokens: ESLintXmlParserToken[]): Function {
     return function ({xmlMode, decodeEntities}: Partial<SdfParserOptions>, parserPrototypes: Callbacks): Tokenizer {
       const cbs: Callbacks = this.makeTokenizerCallbacks(parserPrototypes, tokens);
       return new Tokenizer({xmlMode, decodeEntities}, cbs);
     };
   }

  defaultOptions: Partial<SdfParserOptions> = {
    xmlMode                : false,
    decodeEntities         : false, // should already be decoded by SDF natively
    lowerCaseTags          : false,
    lowerCaseAttributeNames: false,
    recognizeSelfClosing   : true
    // Tokenizer              : makeTokenizer(tokens)
  };

  // make sure passed in options comply
  const
  options: ParserOptions = Object.entries(parserOptions).reduce((acc, [key]) => {
    // do not allow new option keys
    if (typeof defaultOptions[key] === 'undefined') return acc;
    return {
      ...acc,
      [key]: parserOptions[key]
    };
  }, defaultOptions);


  htmlParser
.
