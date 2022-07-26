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

import { SourceCode } from 'eslint';
import { Handler } from 'htmlparser2/lib/Parser';
// eslint-disable-next-line prettier/prettier
import {
  Parser, ParserOptions, Tokenizer
}                     from 'htmlparser2';
import { Callbacks } from 'htmlparser2/lib/Tokenizer';
// eslint-disable-next-line prettier/prettier
import {
  Attr, AttrName, AttrVal, ESLintXmlParserToken, SdfParserOptions, SdfQuoteType, Tag, XmlPosition, XmlSourceLocation, XmlTokenType
} from '../types';

export default class SdfParser {
  public lineBreakIndices: number[];

  public tabIndices: number[];

  public code: string;

  public tokens: ESLintXmlParserToken[];

  #tokens: ESLintXmlParserToken[];

  visitorKeys: SourceCode.VisitorKeys;

  root: Tag;

  public currentElement: Tag;

  public currentAttribute: Attr;

  #innerParser: Parser;

  public readonly requestedOptions: SdfParserOptions;

  private tagStack: Tag[];

  private attrStack: Attr[];

  #parserOptions: SdfParserOptions;

  constructor({ code, parserOptions = {} }: { code: string; parserOptions?: SdfParserOptions }) {
    this.code = code;

    Object.assign(this, SdfParser.makeIndices(code));
    this.tokens = [];
    this.#tokens = [];
    this.root = null;
    this.currentElement = null;
    this.currentAttribute = null;
    this.requestedOptions = { ...parserOptions };

    this.tagStack = [];
    this.attrStack = [];

    this.visitorKeys = {
      'Program': ['root'],
      'Attr': ['attrName', 'attrValue'],
      'AttrName': [],
      'AttrVal': [],
      'Tag': ['children', 'attr'],
      'Text': [],
      'Comment': []
    };

    // make sure passed in options comply
    this.#parserOptions = Object.entries(this.requestedOptions).reduce((acc, [key]) => {
      // do not allow new option keys
      if (typeof acc[key] === 'undefined') return acc;
      return {
        ...acc,
        [key]: parserOptions[key]
      };
    }, SdfParser.defaultOptions);
  }

  /**
   * @returns {Parser}
   */
  get parser(): Parser {
    return this.#innerParser;
  }

  parse(): void {
    const options: ParserOptions = {
      ...this.#parserOptions,
      Tokenizer: this.makeTokenizer() as typeof Tokenizer
    };

    this.#innerParser = new Parser(this.getParseHandler(), options);
    return this.#innerParser.parseComplete(this.code);
  }

  /**
   *
   * @param {string} code
   * @returns {lineBreakIndices : number[], tabIndices : number[]}
   */
  static makeIndices(code: string): { lineBreakIndices: number[]; tabIndices: number[] } {
    const lineBreakIndices = [-1];
    let currentIndex = code.indexOf('\n');

    while (currentIndex !== -1) {
      lineBreakIndices.push(currentIndex);
      currentIndex = code.indexOf('\n', currentIndex + 1);
    }

    const tabIndices = [];
    currentIndex = code.indexOf('\t');

    while (currentIndex !== -1) {
      tabIndices.push(currentIndex);
      currentIndex = code.indexOf('\t', currentIndex + 1);
    }
    return { lineBreakIndices, tabIndices };
  }

  /**
   * @description
   * @param {Pick<Parser, 'startIndex'|'end'>} indices
   * @param {number} indices.startIndex
   * @param {number} indices.end
   * @returns {[number,number]}
   * @example
   */
  static rangePlus1({ startIndex, endIndex }: Pick<Parser, 'startIndex' | 'endIndex'>): [number, number] {
    return [startIndex, endIndex + 1];
  }

  /**
   * @description Slices the code string properly.
   * @param {object} options Options object.
   * @param {string} options.code
   * @param {number} options.startIndex
   * @param options.endIndex
   * @param {number} options.end
   * @returns {string}
   * @example
   */
  static slicedCodePlus1({ code, startIndex, endIndex }: { code: string; startIndex: number; endIndex: number }): string {
    return code.slice(
      ...SdfParser.rangePlus1({
        startIndex,
        endIndex
      })
    );
  }

  /**
   * @description Establishes line and column values for the position based on cumulative line breaks and tabs
   * @param {number} index
   * @returns {XmlPosition}
   */
  getLineAndColumn(index: number): XmlPosition {
    const { lineBreakIndices, tabIndices } = this;
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
        // keep going;
      } else if (tabIndices[tabNumber] < index) {
        column += 4;
      } else {
        break;
      }
    }

    return {
      line: lineNumber,
      column: column + 1
    };
  }

  // note: for nodes you can use Eslint's Source.getLocFromIndex(index)
  getLoc({ start, end }: { start?: number; end?: number }): XmlSourceLocation {
    return {
      start: typeof start === 'number' ? this.getLineAndColumn(start) : null,
      end: typeof end === 'number' ? this.getLineAndColumn(end) : null
    };
  }

  /* /!**
   * @description Dynamically add nodes and their fields to visitorKeys;
   * @param {string} keyName
   * @returns {void}
   *!/
  addVisitorKey({ keyToAdd: key, fieldsToAdd }: { keyToAdd: string; fieldsToAdd: string[] }): void {
    if (!this.visitorKeys[key]) this.visitorKeys[key] = fieldsToAdd;

    const existingFields: string[] = this.visitorKeys[key];

    this.visitorKeys[key] = Array.from(new Set([...existingFields, ...fieldsToAdd]));
  }*/

  /**
   * @description Handlers are where the nodes are set. For tokens refer to `makeTokenizerCallbacks`.
   * @see makeTokenizerCallbacks
   * @returns {Partial<Handler>}
   */
  getParseHandler(): Partial<Handler> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const currentSdfParser: SdfParser = this;
    const { attrStack, tagStack } = currentSdfParser;

    const handlerCallbacks: Partial<Handler> = {
      /**
       * @description  1️⃣ This is the callback that happens first.
       *
       * - reconcile any outstanding tag tokens that match.
       * - begin the creation of a tag that will be reconciled later.
       * @param tagName
       * @example //
       * @returns {void}
       */
      onopentagname: (tagName: string): void => {
        // console.log('onopentagname handler edition');

        // create a new tag.
        const parent: Tag = this.root === null ? null : [...tagStack].pop();

        const tokenLength = currentSdfParser.#tokens.length;
        let idx = tokenLength - 1;

        // going backwards will be much faster
        for (; idx >= 0; idx--) {
          const {
            type,
            range: [nameStart],
            value
          } = currentSdfParser.#tokens[idx];

          if (['XmlTagName'].includes(type)) {
            if (value !== tagName) throw new Error(`Should have found tag ${tagName}`);

            const idxToSlice = idx;
            // we have a match: remove from the temp array #tokens
            currentSdfParser.#tokens.splice(idxToSlice, 1);

            // add this one as a temporary tag
            const tag = {
              attr: [],
              children: [],
              comments: [],
              canHoldText: null,
              innerHTML: null,
              isClosed: null,
              range: [nameStart - 1, null],
              type: 'Tag',
              tagName,
              parent: null,
              // parent,
              value: null
            } as Tag;

            if (this.root === null) this.root = tag;

            tagStack.push(tag);

            // associate parent to children if relevant
            parent?.children?.push(tag);

            break;
          }
        }
      },

      /**
       * @description All the attribute tokens that are transient can be reconciled here.
       * The Tag has not been called yet.
       * @param name
       * @param value
       * @param quote
       * @example //
       * @returns {void}
       */
      onattribute: (name: string, value: string, quote: '"' | "'" | '' | undefined): void => {
        // console.log('onattribute');
        const quoteLength = quote?.length || 0;

        // obtain temp tag without removing it from temporary status
        const tag = tagStack[tagStack.length - 1] || null;

        const indicesToSlice = [];
        // absorb temp tokens that have the same name
        const { attrName, attrValue } = [...currentSdfParser.#tokens]
          //
          .reduce(
            (acc, { type, range, value: v }, idxToSlice): { attrName: AttrName; attrValue: AttrVal } => {
              const [start, end] = range;
              if (type === 'XmlAttrName' && v === name) {
                // remove from the temp array #tokens
                indicesToSlice.unshift(idxToSlice);
                return { ...acc, attrName: { type: 'AttrName', value: v, range, parent: null, loc: currentSdfParser.getLoc({ start, end }) } };
              }

              if (type === 'XmlAttrValue' && v === value) {
                // remove from the temp array #tokens
                indicesToSlice.unshift(idxToSlice);
                return { ...acc, attrValue: { type: 'AttrVal', value: v, range, quote, parent: null, loc: currentSdfParser.getLoc({ start, end }) } };
              }

              return acc;
            },
            { attrName: null, attrValue: null }
          );

        // 🧹 clean up the #tokens
        indicesToSlice.sort((a, b) => b - a).forEach((idxToSlice) => currentSdfParser.#tokens.splice(idxToSlice, 1));

        [
          {
            comments: [],
            attrName,
            attrValue,
            // tag, // attach tag
            type: 'Attr',
            // parent: null,
            parent: tag,
            name: value,
            range: [attrName.range[0], attrValue.range[1] + quoteLength]
          } as Attr
        ].forEach((newAttribute) => {
          // 📌 put a pin in it
          attrStack.push(newAttribute);
          const [start, end] = newAttribute.range;
          newAttribute.loc = currentSdfParser.getLoc({ start, end });

          newAttribute.attrName.parent = newAttribute;

          newAttribute.attrValue.parent = newAttribute;

          // attach to the tag
          tag?.attr.push(newAttribute);

          // update tag.attr[] arbitrary properties to include this attribute will happen in `onopentag`
        });
      },

      /**
       * @description Updates the currentElement's arbitrary properties.
       * @todo How to determine comments?
       * @todo Represent elements as adhoc visitor keys?
       * @param {string} tagName
       * @param {Object<string,string>} attributes
       * @returns {void} Nothing.
       * @example <caption>A entityForm tag</caption>
       * {
       *   comments : [],
       *   type : 'Tag',
       *   parent : null,
       *   canHoldText : false,
       *   attr: [ attributeForScriptId],
       *   isClosed : null,
       *   children : []
       * }
       */
      onopentag: (
        tagName: string,
        attributes: {
          [s: string]: string;
        }
      ): void => {
        // console.log('opentag');
        // get latest element from stack without removing it
        const newElement = tagStack[tagStack.length - 1];

        // add attribs as properties -- it makes using selectors easier
        SdfParser.addAttributesAs$Props(newElement, attributes);
      },

      /**
       * @description Called on regular and self-closing tags.
       *
       * After calling `openStack` the following should be true:
       *
       * - currentEl.parent on "top".
       * @param {string} tagName
       * @example //
       * @returns {void}
       */
      onclosetag: (tagName: string): void => {
        // console.log('onclosetag handler edition');
        const currentEl = tagStack.pop();

        // remove the related temp #token
        SdfParser.removeMatchFromCollection(
          ({ type, value }: Partial<ESLintXmlParserToken>) => type === 'XmlTagName' && tagName === value,
          currentSdfParser.#tokens
        );

        const endTagLength: number = currentEl.isClosed ? 2 : 1;

        if (currentEl.tagName !== tagName) throw new Error('open tag does not match currentElement');
        const end: number = currentSdfParser.parser.endIndex + endTagLength;
        currentEl.range[1] = end;
        currentEl.loc = currentSdfParser.getLoc({ start: currentEl.range[0], end });
        currentEl.value = currentSdfParser.code.slice(...currentEl.range);
        currentEl.innerHTML = SdfParser.extractInner({ raw: currentEl.value });

        if (currentEl.isClosed !== true && typeof currentEl.innerHTML !== 'string') throw new TypeError('Something wrong with Parsing');
      },

      /**
       *
       * @param text
       * @example //
       * @returns {void}
       */
      ontext: (text: string): void => {
        // console.log('ontext', { text });
        /*  const raw: string = slicedCodePlus1({ code, ...htmlParser });
          const [a, b] = rangePlus1(htmlParser);

          const textContent: XmlText = {
            type: 'XmlText',
            parent: currentNodes.currentElement,
            text,
            value: text,
            raw,
            range: [a, b],
            loc: {
              start: getLineAndColumn(a),
              end: getLineAndColumn(b)
            }
          };
          currentNodes.currentElement?.children.push(textContent);

          tokens.push(textContent);*/
      },

      /**
       *
       * @param comment
       * @example //
       * @returns {void}
       */
      oncomment: (comment: string): void => {
        // console.log('oncomment', { comment });
        /*  const raw: string = slicedCodePlus1({ code, ...htmlParser });
          const [a, b] = rangePlus1(htmlParser);

          const newComment: XmlComment = {
            type: 'XmlComment',
            parent: currentNodes.currentElement,
            comment,
            value: extractInner({ raw }),
            raw,
            range: [a, b],
            loc: {
              start: getLineAndColumn(a),
              end: getLineAndColumn(b)
            }
          };
          currentNodes.currentElement?.children.push(newComment);
          tokens.push(newComment);
        }*/
      }
    };

    return handlerCallbacks;
  }

  /**
   * @param {XmlTokenType} type
   * @returns {[start : number,end : number]}
   */
  getPreviousTokenOfType = ({ type: requestedType }: { type: XmlTokenType }) => {
    const { tokens } = this;
    return (
      [tokens[tokens.length - 1]]
        //
        .filter(({ type }) => type === requestedType)
        .map(({ range: [a, b] }) => ({ start: a, end: b }))
    );
  };

  /**
   * @description Makes Callbacks that the tokenizer will use. Callbacks can update the AST tokens by reference.
   * @param {Callbacks} parserPrototypes
   * @returns {Callbacks}
   */
  makeTokenizerCallbacks(parserPrototypes: Callbacks): Callbacks {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const currentSdfParser = this;
    const cbs: Callbacks = {
      /**
       * @returns {void}
       */
      onattribentity(codepoint: number): void {
        // console.log('onattribentity');
        return parserPrototypes.onattribentity(codepoint);
      },
      /**
       * @returns {void}
       */
      onattribname(start: number, end: number): void {
        const loc = currentSdfParser.getLoc({ start, end });
        [
          {
            type: 'XmlAttrName',
            value: currentSdfParser.code.slice(start, end),
            range: [start, end],
            loc
          }
        ].forEach((xmlAttrName: ESLintXmlParserToken) => {
          currentSdfParser.tokens.push(xmlAttrName);
          currentSdfParser.#tokens.push(xmlAttrName);
        });
        // console.log('onattribname');
        return parserPrototypes.onattribname(start, end);
      },
      /**
       * @returns {void}
       */
      onattribdata(start: number, end: number): void {
        const loc = currentSdfParser.getLoc({ start, end });
        const [matchingAttrRange] = currentSdfParser.getPreviousTokenOfType({ type: 'XmlAttrName' });

        // process "=" token
        // eslint-disable-next-line @typescript-eslint/no-shadow
        [{ start: matchingAttrRange.end, end: matchingAttrRange.end + 1 }].forEach(({ start, end }) => {
          currentSdfParser.tokens.push({
            type: 'XmlAttrOperator',
            value: currentSdfParser.code.slice(start, end),
            range: [start, end],
            loc: currentSdfParser.getLoc({ start, end })
          });
        });

        // if there is a gap of 2 then expression includes a quote -- so capture the quote token
        if (matchingAttrRange.end && start >= matchingAttrRange.end + 2) {
          // eslint-disable-next-line @typescript-eslint/no-shadow
          [{ start: matchingAttrRange.end + 1, end: start }].forEach(({ start, end }) => {
            currentSdfParser.tokens.push({
              type: 'XmlAttrQuote',
              value: currentSdfParser.code.slice(start, end),
              range: [start, end],
              loc: currentSdfParser.getLoc({ start, end })
            });
          });
        }

        // finally push the value
        [
          {
            type: 'XmlAttrValue',
            value: currentSdfParser.code.slice(start, end),
            range: [start, end],
            loc
          }
        ].forEach((xmlAttrValue: ESLintXmlParserToken) => {
          currentSdfParser.#tokens.push(xmlAttrValue);
          currentSdfParser.tokens.push(xmlAttrValue);
        });

        // console.log('onattribdata');
        return parserPrototypes.onattribdata(start, end);
      },
      /**
       * @returns {void}
       */
      onattribend(quote, end: number): void {
        // console.log('onattribend');
        if ([SdfParser.QuoteType.Unquoted, SdfParser.QuoteType.NoValue].includes(quote)) return;

        // if there is a gap of 1 then it's a quote -- capture the quote token

        // eslint-disable-next-line @typescript-eslint/no-shadow
        [{ start: end, end: end + 1 }].forEach(({ start, end }) => {
          currentSdfParser.tokens.push({
            type: 'XmlAttrQuote',
            value: currentSdfParser.code.slice(start, end),
            range: [start, end],
            loc: currentSdfParser.getLoc({ start, end })
          });
        });

        parserPrototypes.onattribend(quote, end);
      },

      /**
       * @returns {void}
       */
      oncdata(start: number, end: number, endOffset: number): void {
        // console.log('oncdata');
        return parserPrototypes.oncdata(start, end, endOffset);
      },
      /**
       * @returns {void}
       */
      onclosetag(start: number, end: number): void {
        const [newStart, newEnd] = [start - 2, end + 1];

        [currentSdfParser.tagStack[currentSdfParser.tagStack.length - 1]].filter(Boolean).forEach((tag) => {
          tag.isClosed = false;
        });

        [
          {
            type: 'XmlTagBeginHard',
            value: '</',
            range: [newStart, start],
            loc: currentSdfParser.getLoc({ start: newStart, end: start })
          },
          {
            type: 'XmlTagName',
            value: currentSdfParser.code.slice(start, end),
            range: [start, end],
            loc: currentSdfParser.getLoc({ start, end })
          },
          {
            type: 'XmlTagEndSoft',
            value: '>',
            range: [end, newEnd],
            loc: currentSdfParser.getLoc({ start: end, end: newEnd })
          }
        ].forEach((token: ESLintXmlParserToken): void => {
          currentSdfParser.tokens.push(token);

          if (token.type === 'XmlTagName') currentSdfParser.#tokens.push(token);
        });

        // console.log('onclosetag');
        return parserPrototypes.onclosetag(start, end);
      },
      /**
       * @returns {void}
       */
      oncomment(start: number, end: number, endOffset: number): void {
        // console.log('oncomment');
        return parserPrototypes.oncomment(start, end, endOffset);
      },
      /**
       * @returns {void}
       */
      ondeclaration(start: number, end: number): void {
        // console.log('ondeclaration');
        return parserPrototypes.ondeclaration(start, end);
      },
      /**
       * @returns {void}
       */
      onend(): void {
        // console.log('onend');

        if (currentSdfParser.#tokens.length) throw new Error(`You still have ${currentSdfParser.#tokens.length} tokens to deal with`);

        return parserPrototypes.onend();
      },
      /**
       * @returns {void}
       */
      onopentagend(end: number): void {
        currentSdfParser.tokens.push({
          type: 'XmlTagEndSoft',
          value: '>',
          range: [end, end + 1],
          loc: currentSdfParser.getLoc({ start: end, end: end + 1 })
        } as ESLintXmlParserToken);
        // console.log('onopentagend');
        return parserPrototypes.onopentagend(end);
      },
      /**
       * @returns {void}
       */
      onopentagname(start: number, end: number): void {
        // add a < to the tokens
        currentSdfParser.tokens.push({
          type: 'XmlTagBeginSoft',
          value: '<',
          range: [start - 1, start],
          loc: currentSdfParser.getLoc({ start: start - 1, end: start })
        } as ESLintXmlParserToken);

        // push the tag
        [
          {
            type: 'XmlTagName',
            value: currentSdfParser.code.slice(start, end),
            range: [start, end],
            loc: currentSdfParser.getLoc({ start, end })
          } as ESLintXmlParserToken
        ].forEach((tagToken) => {
          currentSdfParser.tokens.push(tagToken);
          currentSdfParser.#tokens.push(tagToken);
        });

        // console.log('onopentagname');
        return parserPrototypes.onopentagname(start, end);
      },
      /**
       * @returns {void}
       */
      onprocessinginstruction(start: number, end: number): void {
        // console.log('onprocessinginstruction');
        return parserPrototypes.onprocessinginstruction(start, end);
      },
      /**
       * @description Called only when a tag is self-closing
       *
       * - makes sure that open tags are removed from any temporary storage.
       * @returns {void}
       */
      onselfclosingtag(end: number): void {
        [currentSdfParser.tagStack[currentSdfParser.tagStack.length - 1]].filter(Boolean).forEach((tag) => {
          tag.isClosed = true;
        });
        // add a close token
        currentSdfParser.tokens.push({
          type: 'XmlTagEndHard',
          value: '/>',
          range: [end - 1, end + 1],
          loc: currentSdfParser.getLoc({ start: end - 1, end: end + 1 })
        } as ESLintXmlParserToken);

        // console.log('onselfclosingtag');
        return parserPrototypes.onselfclosingtag(end);
      },
      /**
       * @returns {void}
       */
      ontext(start: number, end: number): void {
        // console.log('ontext', currentSdfParser.code);
        return parserPrototypes.ontext(start, end);
      },
      /**
       * @returns {void}
       */
      ontextentity(codepoint: number): void {
        // console.log('ontextentity');
        return parserPrototypes.ontextentity(codepoint);
      }
    };
    return cbs;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  makeTokenizer(): Function {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this;
    /**
     * @param {Partial<SdfParserOptions>} options
     * @param {Boolean} options.xmlMode
     * @param {Boolean} options.decodeEntities
     * @param {Callbacks} parserPrototypes
     * @returns {Tokenizer}
     */
    return function ({ xmlMode, decodeEntities }: Partial<SdfParserOptions>, parserPrototypes: Callbacks): Tokenizer {
      const cbs: Callbacks = that.makeTokenizerCallbacks(parserPrototypes);
      return new Tokenizer({ xmlMode, decodeEntities }, cbs);
    };
  }

  /**
   * @description Adds the key,value pairs of attributes to a tag as properties -- pre-fixing the name with a "$"
   * for the purposes of avoiding conflicts.
   * @param {string} tag
   * @param {Object<string,string>} attributes
   * @returns {void}
   * @examnle <caption>Adding attribute "scriptid" as keys on the tag "entityForm"</caption>
   *
   * const aTag = {
   *   type : 'Tag',
   *   tagName : 'entityForm',
   *   $scriptid : 'custform123'
   * };
   */
  static addAttributesAs$Props(
    tag: Tag,
    attributes: {
      [s: string]: string;
    }
  ): void {
    Object.entries(attributes).forEach(([key, value]: string[]) => {
      tag[`$${key}`] = value;
    });
  }

  /**
   * @enum {SdfQuoteType}
   */
  static QuoteType: SdfQuoteType = {
    NoValue: 0,
    Unquoted: 1,
    Single: 2,
    Double: 3
  };

  /**
   * @description Extracts the content.
   * @param {string} raw
   * @returns {string|null}
   * @example
   */
  static extractInner = ({ raw }): string | null => raw.match(SdfParser.contentsOfTagRgx)?.groups?.content || null;

  static defaultOptions: Partial<SdfParserOptions> = {
    xmlMode: false,
    decodeEntities: false, // should already be decoded by SDF natively
    lowerCaseTags: false,
    lowerCaseAttributeNames: false,
    recognizeSelfClosing: true
    // Tokenizer              : makeTokenizer(tokens)
  };

  /**
   * @description iterates in reverse over an Array, running a test against each item and removing the first entry that
   * passes the test (strict match).  It will stop after one removal.  If provided it wil begin scanning at the start
   * point.
   *
   * It returns a shallow copy array of the removed item;
   *
   * If you are using this array in your own iteration then pass in the updated Start point.
   * @see Array.prototype.splice
   * @param {any[]} collection Array to scan and modify.
   * @param {():boolean} test Function that provides a strict boolean test for the current item.
   * @param {number} [startPoint] index to begin scanning (in reverse). Defaults to end of the Array.
   * @returns {Array<any>} Array of length 0 or 1 (depending upon changes).
   */
  static removeMatchFromCollection = (test: { (any): boolean }, collection: any[], startPoint?: number): any[] => {
    let idx = typeof startPoint === 'number' ? startPoint : collection.length - 1;
    for (; idx >= 0; idx--) {
      if (test(collection[idx]) === true) {
        return collection.splice(idx, 1);
      }
    }
    return [];
  };

  static contentsOfTagRgx = /^(?:<(?<tagname>[^ >]+))(?:[^/>]*[/][>]$|[^/>]*[>](?<content>[\s\S]*?)(?:<[/]\k<tagname>)>$)/;
}
