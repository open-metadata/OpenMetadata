/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

const FONT = '12px Arial';
const CHAR_PX = 10;

type TextMeasureModule = typeof import('./textMeasure');

const buildContext = (): CanvasRenderingContext2D => {
  const measureText = jest.fn((value: string) => ({
    width: value.length * CHAR_PX,
  }));

  return { font: '', measureText } as unknown as CanvasRenderingContext2D;
};

const loadModule = (
  context: CanvasRenderingContext2D | null
): TextMeasureModule => {
  jest.spyOn(document, 'createElement').mockReturnValue({
    getContext: () => context,
  } as unknown as HTMLCanvasElement);

  return require('./textMeasure') as TextMeasureModule;
};

describe('textMeasure', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('measureTextWidth', () => {
    it('falls back to text.length * fallbackCharWidth when no canvas context', () => {
      const { measureTextWidth } = loadModule(null);

      expect(measureTextWidth('hello', FONT, 7)).toBe('hello'.length * 7);
    });

    it('uses the canvas measured width when a context is available', () => {
      const { measureTextWidth } = loadModule(buildContext());

      expect(measureTextWidth('abcd', FONT, 7)).toBe(4 * CHAR_PX);
    });
  });

  describe('truncateToFit', () => {
    it('returns the full text on the no-context path when it fits maxChars', () => {
      const { truncateToFit } = loadModule(null);

      expect(truncateToFit('abc', 100, FONT, CHAR_PX)).toBe('abc');
    });

    it('appends an ellipsis on the no-context path when text exceeds maxChars', () => {
      const { truncateToFit } = loadModule(null);

      expect(truncateToFit('abcdef', 30, FONT, CHAR_PX)).toBe('ab...');
    });

    it('returns a bare ellipsis on the no-context path when maxChars is <= 1', () => {
      const { truncateToFit } = loadModule(null);

      expect(truncateToFit('abcdef', 5, FONT, CHAR_PX)).toBe('...');
    });

    it('returns the text unchanged with a context when it fits maxPx', () => {
      const { truncateToFit } = loadModule(buildContext());

      expect(truncateToFit('Hi', 100, FONT, CHAR_PX)).toBe('Hi');
    });

    it('binary-searches so the truncated text plus ellipsis fits within maxPx', () => {
      const context = buildContext();
      const { truncateToFit } = loadModule(context);

      const result = truncateToFit('ABCDEFGHIJ', 65, FONT, CHAR_PX);

      expect(result).toBe('ABC...');
      expect(context.measureText(result).width).toBeLessThanOrEqual(65);
    });
  });
});
