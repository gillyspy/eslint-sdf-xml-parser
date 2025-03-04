import { SourceCode } from 'eslint';
import { Handler } from 'htmlparser2/lib/Parser';
// eslint-disable-next-line prettier/prettier
import {
  Parser, ParserOptions, Tokenizer
}                     from 'htmlparser2';
import { Callbacks } from 'htmlparser2/lib/Tokenizer';
// eslint-disable-next-line prettier/prettier
import {
  Attr, ESLintXmlParserToken, SdfParserOptions, SdfQuoteType, Tag, XmlPosition, XmlSourceLocation, XmlTokenType, XmlComment as Comment 
} from '../types';

export default class SdfParser {
  public lineBreakIndices: number[];

  public tabIndices: number[];

  public code: string;

  public tokens: ESLintXmlParserToken[];

  public comments: Comment[];

  #tokens: ESLintXmlParserToken[];

  visitorKeys: SourceCode.VisitorKeys;

  root: Tag;

  public currentElement: Tag;

  public currentAttribute: Attr;

  #innerParser: Parser;

  public readonly requestedOptions: SdfParserOptions;

  private tagStack: Tag[];

  private commentStack: Comment[];

  private attrStack: Attr[];

  #tab: string;

  #parserOptions: SdfParserOptions;

  constructor({ code, parserOptions = {} }: { code: string; parserOptions?: SdfParserOptions }) {
    this.code = code;

    Object.assign(this, SdfParser.makeIndices(code));
    this.tokens = [];
    this.#tokens = [];
    this.comments = [];

    this.root = null;
    this.currentElement = null;
    this.currentAttribute = null;
    this.requestedOptions = { ...parserOptions };

    this.tagStack = [];
    this.attrStack = [];
    this.commentStack = [];

    this.tab = typeof this.requestedOptions.tab;

    this.visitorKeys = {
      'Program': ['root'],
      'Attr': ['attrName', 'attrValue'],
      'AttrName': [],
      'AttrVal': [],
      'Tag': ['children', 'attr', 'comments'],
      'Text': [],
      'Line': [],
      'Block': [],
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
    }, Object.fromEntries(Object.entries(SdfParser.defaultOptions).filter(([key]) => key !== 'tab')));
  }

  /**
   * @description Sets the tab to a clear internal value based on various external input values.
   * @param {string|number|undefined } tab Various expressions of tab.
   * @returns {void}
   */
  set tab(tab: string | number | undefined) {
    switch (tab) {
      case '4':
      case 4:
      case 'four':
      case '    ':
        this.#tab = '    ';
        break;
      case 'tab':
      case '\t':
        this.#tab = '\t';
        break;
      case '2':
      case 2:
      case 'two':
      case '  ':
        this.#tab = '  ';
        break;
      default:
        this.#tab = String(SdfParser.defaultOptions.tab);
        break;
    }
  }

  /**
   * @returns {string} Representing the nature of the tab.
   */
  get tab() {
    switch (this.#tab) {
      case '    ':
        return '4';
      case '\t':
        return 'tab';
      case '  ':
      default:
        return '2';
    }
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
   * @param {boolean} [zeroBased=true]
   * @returns {XmlPosition}
   */
  getLineAndColumn(index: number, zeroBased = true): XmlPosition {
    const zeroOffset: number = zeroBased ? -1 : 0;
    const tab: number = Number(this.tab) || 2;
    const { lineBreakIndices, tabIndices } = this;
    let lineNumber = 0;

    for (; lineNumber < lineBreakIndices.length; lineNumber++) {
      if (index < lineBreakIndices[lineNumber]) {
        break;
      }
    }

    let column: number = index - lineBreakIndices[lineNumber - 1] + zeroOffset;
    let tabNumber = -1;

    while (++tabNumber < tabIndices.length) {
      if (tabIndices[tabNumber] <= lineBreakIndices[lineNumber - 1]) {
        // keep going;
      } else if (tabIndices[tabNumber] < index) {
        column += tab;
      } else {
        break;
      }
    }

    return {
      line: lineNumber,
      column: Math.max(0, column)
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
        try {
          // console.log('onopentagname handler edition');

          // create a new tag.
          const parent: Tag = this.root === null ? null : [...tagStack].pop();

          currentSdfParser
            .getMatchFromCollection({
              /** @returns {boolean} */
              test: ({ type, value }) => type === 'XmlTagName' && value === tagName,
              collection: currentSdfParser.#tokens,
              removeIt: true
            })
            .forEach((nameToken) => {
              const [start] = nameToken.range;
              // add this one as a temporary tag
              const tag = {
                attr: [],
                children: [],
                comments: [],
                canHoldText: null,
                innerHTML: null,
                isClosed: null,
                range: [start - 1, null],
                type: 'Tag',
                tagName,
                parent: null,
                // parent,
                value: null
              } as Tag;

              if (currentSdfParser.root === null) {
                currentSdfParser.root = tag;

                tag.leadingComments = [];
                tag.trailingComments = [];

                // add any leading comments are comments that are already logged buuut had nothing to attach to
                currentSdfParser
                  .getMatchFromCollection({
                    /** @returns {boolean} */
                    test: () => true,
                    removeIt: true,
                    collection: currentSdfParser.commentStack
                  })
                  .forEach((comment) => {
                    currentSdfParser.root.leadingComments.push(comment);
                  });
              }

              tagStack.push(tag);

              // associate parent to children if relevant
              parent?.children?.push(tag);
            });
        } catch (e) {
          throw new Error(`Error handling onopentagname: ${tagName}`);
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
        try {
          // console.log('onattribute');
          const quoteLength = quote?.length || 0;

          // obtain temp tag without removing it from temporary status
          const tag = tagStack[tagStack.length - 1] || null;

          // absorb temp tokens that have the same name
          const attrName = currentSdfParser
            .getMatchFromCollection({
              /** @returns {boolean} */
              test: ({ type, value: v }) => type === 'XmlAttrName' && v === name,
              collection: currentSdfParser.#tokens,
              removeIt: true
            })
            .reduce(
              (acc, { range: [start, end], ...rest }) => ({
                ...rest,
                range: [start, end],
                loc: currentSdfParser.getLoc({ start, end }),
                type: 'AttrName',
                parent: null
              }),
              null
            );

          const attrValue = currentSdfParser
            .getMatchFromCollection({
              /** @returns {boolean} */
              test: ({ type, value: v }) => type === 'XmlAttrValue' && v === value,
              collection: currentSdfParser.#tokens,
              removeIt: true
            })
            .reduce(
              (acc, { range: [start, end], ...rest }) => ({
                ...rest,
                range: [start, end],
                loc: currentSdfParser.getLoc({ start, end }),
                type: 'AttrVal',
                quote,
                parent: null
              }),
              null
            );

          [
            {
              comments: [],
              attrName,
              attrValue,
              type: 'Attr',
              parent: tag,
              name,
              range: [attrName.range[0], attrValue.range[1] + quoteLength]
            } as Attr
          ].forEach((newAttribute) => {
            // 📌 put a pin in it
            attrStack.push(newAttribute);
            SdfParser.addAttributesAs$Props(newAttribute, { [name]: value });

            const [start, end] = newAttribute.range;
            newAttribute.loc = currentSdfParser.getLoc({ start, end });

            newAttribute.attrName.parent = newAttribute;

            newAttribute.attrValue.parent = newAttribute;

            // attach to the tag
            tag?.attr.push(newAttribute);

            // update tag.attr[] arbitrary properties to include this attribute will happen in `onopentag`
          });
        } catch (e) {
          throw new Error(`Error handling onattribute: name:${name} value:${value} quote:${quote}, ${e.stack}`);
        }
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
        try {
          // console.log('opentag');
          // get latest element from stack without removing it
          const newElement = tagStack[tagStack.length - 1];

          // add attribs as properties -- it makes using selectors easier
          SdfParser.addAttributesAs$Props(newElement, attributes);
        } catch (e) {
          throw new Error(`Error handling onopentag: tagName:${tagName}`);
        }
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
        try {
          // console.log('onclosetag handler edition');
          const currentEl = tagStack.pop();

          // remove the related temp #token
          currentSdfParser.getMatchFromCollection({
            /** @returns {boolean} */
            test: ({ type, value }: Partial<ESLintXmlParserToken>) => type === 'XmlTagName' && tagName === value,
            collection: currentSdfParser.#tokens,
            removeIt: true
          });

          const endTagLength: number = currentEl.isClosed ? 2 : 1;

          if (currentEl.tagName !== tagName) throw new Error('open tag does not match currentElement');
          const end: number = currentSdfParser.parser.endIndex + endTagLength;
          currentEl.range[1] = end;
          currentEl.loc = currentSdfParser.getLoc({ start: currentEl.range[0], end });
          currentEl.value = currentSdfParser.code.slice(...currentEl.range);
          currentEl.innerHTML = SdfParser.extractInner({ raw: currentEl.value });

          if (currentEl.isClosed !== true && typeof currentEl.innerHTML !== 'string') throw new TypeError('Something wrong with Parsing');
        } catch (e) {
          throw new Error(`Error handling onclosetag: tagName:${tagName}`);
        }
      },

      /**
       *
       * @param text
       * @example //
       * @returns {void}
       */
      ontext: (text: string): void => {
        try {
          // console.log('ontext', { text });

          const [{ start, end }] = currentSdfParser.getPreviousTokenOfType({ type: 'XmlText' });

          let parent = null;

          if (!currentSdfParser.tagStack.length) return;

          [parent] = currentSdfParser.getMatchFromCollection({
            /** @returns {boolean} */
            test: ({ children }) => Array.isArray(children),
            collection: currentSdfParser.tagStack,
            removeIt: false
          }) as Tag[];

          if (!parent) return;

          parent.children.push({
            type: 'Text',
            value: text,
            range: [start, end],
            loc: currentSdfParser.getLoc({ start, end }),
            parent
          });
        } catch (e) {
          throw new Error(`Error handling ontext: tagName:${text}`);
        }
      },

      /**
       *
       * @param {string} comment
       * @example //
       * @returns {void}
       */
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      oncomment: (comment: string): void => {
        try {
          // assume no parent available
          let parent = null;

          // look for a parent
          if (currentSdfParser.tagStack.length) {
            [parent] = currentSdfParser.getMatchFromCollection({
              /** @returns {boolean} */
              test: ({ comments }) => Array.isArray(comments),
              collection: currentSdfParser.tagStack,
              removeIt: false
            }) as Tag[];
          }

          // look for a comment on the stack to associate to the parent
          currentSdfParser
            .getMatchFromCollection({
              /** @returns {boolean} */
              test: () => parent?.type === 'Tag',
              removeIt: true,
              collection: currentSdfParser.commentStack
            })
            .forEach((orphan: Comment) => {
              parent.comments.push(orphan);
            });
        } catch (e) {
          throw new Error(`Error handling oncomment: ${comment}`);
        }
      }
    };

    return handlerCallbacks;
  }

  /**
   * @description Examines the most recent token and the new token. If there are any spaces it will figure out the
   * nature of them and create tokens for those spaces
   * @param {ESLintXmlParserToken} token Token to be added.
   * @returns {number} the length of the tokens collection
   */
  addToken(token: ESLintXmlParserToken): number {
    const tokenStorage = this.tokens;
    const lastToken = tokenStorage[tokenStorage.length - 1];
    const { tab } = SdfParser.defaultOptions;
    const rgxSource = ['(?:', [/(?<XmlLineBreak>\r?\n)/, RegExp(`(?<XmlIndent>${tab})`), /(?<XmlSpace> )/].map(({ source }) => source).join('|'), ')'].join('');
    const rgxPatternExec = RegExp(rgxSource, 'g');
    const rgxPatternMatch = RegExp(rgxSource, '');

    const endOfLast = lastToken?.range ? lastToken.range[1] : 0;
    const [startOfCurrent] = token.range;

    const tokensToAdd: ESLintXmlParserToken[] = [];
    let newStart: number = endOfLast;

    if (endOfLast < startOfCurrent) {
      const gapString = this.code.slice(endOfLast, startOfCurrent);

      if (/^\s+$/.test(gapString)) {
        // create a whitespace type of token and insert it
        for (let found: string[] | null = rgxPatternExec.exec(gapString); found !== null; found = rgxPatternExec.exec(gapString)) {
          const { lastIndex }: { lastIndex: number } = rgxPatternExec;
          const [start, end] = [newStart, newStart + lastIndex];

          newStart = Object.entries(found[0].match(RegExp(rgxPatternMatch)).groups).reduce((acc, [key, value]: [XmlTokenType, string]) => {
            if (typeof value === 'undefined') return acc;

            const range: [number, number] = [start, end];
            const loc = this.getLoc({ start, end });

            switch (key) {
              case 'XmlLineBreak':
              case 'XmlIndent':
              case 'XmlTagName':
                tokensToAdd.push({
                  type: key,
                  value,
                  range,
                  loc
                });
                break;
              default:
                break;
            }
            return acc + lastIndex;
          }, newStart);
        }
      }
    }

    // all the whitespace tokens plus the original
    return tokenStorage.push(...tokensToAdd, token);
  }

  /**
   * @param {XmlTokenType} type
   * @returns {[start : number,end : number]}
   */
  getPreviousTokenOfType = ({ type: requestedType }: { type: XmlTokenType }): { start: number; end: number }[] => {
    try {
      return this.getMatchFromCollection({
        /** @returns {boolean} */
        test: ({ type }) => type === requestedType,
        collection: this.tokens,
        removeIt: false
      }).map(({ range: [a, b] }) => ({ start: a, end: b }));
    } catch (e) {
      throw new Error(`error in getting previous token of type:${requestedType}`);
      // console.log({ e });
    }
    return [];
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
          currentSdfParser.addToken(xmlAttrName);
          currentSdfParser.#tokens.push(xmlAttrName);
        });
        // console.log('onattribname');
        return parserPrototypes.onattribname(start, end);
      },
      /**
       * @returns {void}
       */
      onattribdata(start: number, end: number): void {
        try {
          const loc = currentSdfParser.getLoc({ start, end });
          const [matchingAttrRange] = currentSdfParser
            .getMatchFromCollection({
              /** @returns {boolean} */
              test: ({ type }: { type: XmlTokenType }): boolean => type === 'XmlAttrName',
              removeIt: false,
              collection: currentSdfParser.#tokens
            })
            .map(({ range: [s, e] }) => ({ start: s, end: e }));

          // process "=" token
          // eslint-disable-next-line @typescript-eslint/no-shadow
          [{ start: matchingAttrRange.end, end: matchingAttrRange.end + 1 }].forEach(({ start, end }) => {
            currentSdfParser.addToken({
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
              currentSdfParser.addToken({
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
            currentSdfParser.addToken(xmlAttrValue);
          });
        } catch (e) {
          throw new Error(`error in tokenizer onattribdata:  start:${start}, end:${end}`);
        }
        // console.log('onattribdata');
        return parserPrototypes.onattribdata(start, end);
      },
      /**
       * @returns {void}
       */
      onattribend(quote, end: number): void {
        try {
          // console.log('onattribend');
          if ([SdfParser.QuoteType.Unquoted, SdfParser.QuoteType.NoValue].includes(quote)) return;

          // if there is a gap of 1 then it's a quote -- capture the quote token

          // eslint-disable-next-line @typescript-eslint/no-shadow
          [{ start: end, end: end + 1 }].forEach(({ start, end }) => {
            currentSdfParser.addToken({
              type: 'XmlAttrQuote',
              value: currentSdfParser.code.slice(start, end),
              range: [start, end],
              loc: currentSdfParser.getLoc({ start, end })
            });
          });
        } catch (e) {
          throw new Error(`error in tokenizer onattribend:  end:${end}`);
        }
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
        try {
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
            currentSdfParser.addToken(token);

            if (token.type === 'XmlTagName') currentSdfParser.#tokens.push(token);
          });
        } catch (e) {
          throw new Error(`error in tokenizer onclosetag:  start:${start}, end:${end}`);
        }
        // console.log('onclosetag');
        return parserPrototypes.onclosetag(start, end);
      },
      /**
       * @description a block comment is one that spans more than one line. Otherwise, no difference.
       * @returns {void}
       */
      oncomment(start: number, endCombo: number, endOffset: number): void {
        try {
          const end = endCombo - endOffset;

          // comment begin
          // eslint-disable-next-line @typescript-eslint/no-shadow
          [{ start: start - 4, end: start }].forEach(({ start, end }) => {
            currentSdfParser.tokens.push({
              type: 'XmlCommentBegin',
              value: '<!--',
              range: [start, end],
              loc: currentSdfParser.getLoc({ start, end })
            });
          });

          // eslint-disable-next-line @typescript-eslint/no-shadow
          [{ start: end, end: end + endOffset + 1 }].forEach(({ start, end }) => {
            currentSdfParser.tokens.push({
              type: 'XmlCommentEnd',
              value: '>'.padStart(endOffset + 1, '-'),
              range: [start, end],
              loc: currentSdfParser.getLoc({ start, end })
            });
          });

          [
            {
              type: 'Line',
              value: currentSdfParser.code.slice(start, end),
              range: [start, end],
              loc: currentSdfParser.getLoc({ start, end })
            } as Comment
          ].forEach((newComment) => {
            if (newComment.loc.start.line !== newComment.loc.end.line) newComment.type = 'Block';
            currentSdfParser.comments.push(newComment);
            currentSdfParser.commentStack.push(newComment);

            // any need to add it to temporary?
            // currentSdfParser.#tokens.push(newText);
          });
        } catch (e) {
          throw new Error(`error in tokenizer oncomment:  start:${start}, end:${endCombo}`);
        }

        // console.log('oncomment');
        return parserPrototypes.oncomment(start, endCombo, endOffset);
      },
      /**
       * @returns {void}
       */
      ondeclaration(start: number, end: number): void {
        // console.log('ondeclaration');
        return parserPrototypes.ondeclaration(start, end);
      },
      /**
       * @description
       *
       * Any cleanup tasks such as adding trailing comments (which have no parent);.
       * @returns {void}
       */
      onend(): void {
        try {
          // add any trailing comments to the root node
          currentSdfParser
            .getMatchFromCollection({
              /** @returns {boolean} */
              test: () => true,
              removeIt: true,
              collection: currentSdfParser.commentStack
            })
            .forEach((comment) => {
              this.root?.trailingComments.push(comment);
            });

          if (currentSdfParser.#tokens.length) throw new Error(`You still have ${currentSdfParser.#tokens.length} tokens to deal with`);
        } catch (e) {
          throw new Error(`error in tokenizer onend`);
        }
        return parserPrototypes.onend();
      },
      /**
       * @returns {void}
       */
      onopentagend(end: number): void {
        try {
          currentSdfParser.addToken({
            type: 'XmlTagEndSoft',
            value: '>',
            range: [end, end + 1],
            loc: currentSdfParser.getLoc({ start: end, end: end + 1 })
          } as ESLintXmlParserToken);
        } catch (e) {
          throw new Error(`error in tokenizer onopentagend: end:${end}`);
        }

        // console.log('onopentagend');
        return parserPrototypes.onopentagend(end);
      },
      /**
       * @returns {void}
       */
      onopentagname(start: number, end: number): void {
        try {
          // add a < to the tokens
          currentSdfParser.addToken({
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
            currentSdfParser.addToken(tagToken);
            currentSdfParser.#tokens.push(tagToken);
          });
        } catch (e) {
          throw new Error(`error in tokenizer onattribdata:  start:${start}, end:${end}`);
        }

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
        try {
          [currentSdfParser.tagStack[currentSdfParser.tagStack.length - 1]].filter(Boolean).forEach((tag) => {
            tag.isClosed = true;
          });
          // add a close token
          currentSdfParser.addToken({
            type: 'XmlTagEndHard',
            value: '/>',
            range: [end - 1, end + 1],
            loc: currentSdfParser.getLoc({ start: end - 1, end: end + 1 })
          } as ESLintXmlParserToken);
        } catch (e) {
          throw new Error(`error in tokenizer onselfclosingtag:   end:${end}`);
        }
        // console.log('onselfclosingtag');
        return parserPrototypes.onselfclosingtag(end);
      },
      /**
       * @returns {void}
       */
      ontext(start: number, end: number): void {
        try {
          [
            {
              type: 'XmlText',
              value: currentSdfParser.code.slice(start, end),
              range: [start, end],
              loc: currentSdfParser.getLoc({ start, end })
            } as ESLintXmlParserToken
          ].forEach((newText) => {
            currentSdfParser.addToken(newText);

            // any need to add it to temporary?
            // currentSdfParser.#tokens.push(newText);

            // console.log('ontext', currentSdfParser.code);
            return parserPrototypes.ontext(start, end);
          });
        } catch (e) {
          throw new Error(`error in tokenizer ontext:  start:${start}, end:${end}`);
        }
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
    tag: Tag | Attr,
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
  static extractInner = ({ raw }): string | null => raw.match(SdfParser.contentsOfTagRgx)?.groups?.content;

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
   * @param {boolean} removeIt Whether to also remove the match from the collection.
   * @param {number} [startPoint] index to begin scanning (in reverse). Defaults to end of the Array.
   * @returns {Array<any>} Array of length 0 or 1 (depending upon changes).
   */
  // eslint-disable-next-line class-methods-use-this
  getMatchFromCollection({
    test,
    collection,
    removeIt,
    startPoint
  }: {
    test: { (arg: any): boolean };
    collection: any[];
    removeIt?: boolean;
    startPoint?: number;
  }): any[] {
    if (!Array.isArray(collection)) throw new TypeError('collection is not an array');

    let idx = Math.max(typeof startPoint === 'number' ? startPoint : collection.length - 1, collection.length - 1);

    for (; idx >= 0; idx--) {
      if (test(collection[idx]) === true) {
        try {
          if (removeIt === true) return collection.splice(idx, 1);
        } catch (e) {
          throw new TypeError('cannot splice this Array');
        }

        if (idx === 0 || idx === collection.length) return collection.slice(idx);

        return collection.slice(idx, idx + 1);
        break;
      }
    }
    return [];
  }

  static defaultOptions: Partial<SdfParserOptions> = {
    xmlMode: false,
    decodeEntities: false, // should already be decoded by SDF natively
    lowerCaseTags: false,
    lowerCaseAttributeNames: false,
    recognizeSelfClosing: true,
    tab: '  ',
    commentNodes: false
    // Tokenizer              : makeTokenizer(tokens)
  };

  static contentsOfTagRgx = /^(?:<(?<tagname>[^ >]+))(?:[^/>]*[/][>]$|[^/>]*[>](?<content>[\s\S]*?)(?:<[/]\k<tagname>)>$)/;
}
