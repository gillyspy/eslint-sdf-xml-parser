import { Position } from 'estree';
import { SdfParserOptions } from './index';

export default class SdfParser {
  #currentIndex: number;

  public lineBreakIndices: number[];

  public tabIndices: number[];

  public code: string;

  constructor({ code, parserOptions }: { code: string; parserOptions: SdfParserOptions });

  /**
   * @description The line and column for the given index.
   * @param {number }index
   */
  getLineAndColumn(index: number): Position;

  /**
   *
   * @private
   */
  #makeIndices(): void;
}
