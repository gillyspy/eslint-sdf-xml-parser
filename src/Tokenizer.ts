/**
 * @description EsLint desires to have tokens that do not overlap and this is a separate, but connected, concept with
 * the nodes.
 *
 * `htmlparser2` internal parser has callbacks after parsing, but they lack detail. however, since it allows
 * overriding the embedded tokenizer us to give eslint the token information that it needs.
 *
 * Some of them are redundant, but it is cleaner to do all the token passing here.
 */

import { Tokenizer } from 'htmlparser2';
import { Callbacks } from 'htmlparser2/lib/Tokenizer';
import { ParserOptions, ESLintXmlParserToken } from '../types';

/**
 *
 */
