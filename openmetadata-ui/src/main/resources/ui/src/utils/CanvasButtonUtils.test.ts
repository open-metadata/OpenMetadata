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

import {
  CanvasButton,
  drawCanvasButton,
  ECanvasButtonType,
  resolveCanvasButtonColors,
} from './CanvasButtonUtils';

const createMockContext = () => {
  const fillStyles: string[] = [];
  const strokeStyles: string[] = [];
  const context = {
    arc: jest.fn(),
    beginPath: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    fillText: jest.fn(),
    lineTo: jest.fn(),
    moveTo: jest.fn(),
    quadraticCurveTo: jest.fn(),
    restore: jest.fn(),
    save: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    get fillStyle() {
      return fillStyles.at(-1) ?? '';
    },
    set fillStyle(value: string | CanvasGradient | CanvasPattern) {
      fillStyles.push(String(value));
    },
    get strokeStyle() {
      return strokeStyles.at(-1) ?? '';
    },
    set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
      strokeStyles.push(String(value));
    },
  } as unknown as CanvasRenderingContext2D;

  return { context, fillStyles, strokeStyles };
};

describe('CanvasButtonUtils', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('draws a button with the caller-resolved canvas palette', () => {
    const { context, fillStyles, strokeStyles } = createMockContext();
    const button: CanvasButton = {
      edgeId: 'edge-1',
      height: 36,
      type: ECanvasButtonType.Function,
      width: 36,
      x: 100,
      y: 50,
    };
    const colors = {
      DEFAULT: {
        background: 'rgb(1, 2, 3)',
        border: 'rgb(4, 5, 6)',
        icon: 'rgb(7, 8, 9)',
      },
      FAILED: {
        background: 'rgb(10, 11, 12)',
        border: 'rgb(13, 14, 15)',
        icon: 'rgb(16, 17, 18)',
      },
      HOVER: {
        background: 'rgb(19, 20, 21)',
        border: 'rgb(22, 23, 24)',
        icon: 'rgb(25, 26, 27)',
      },
      PENDING: {
        background: 'rgb(28, 29, 30)',
        border: 'rgb(31, 32, 33)',
        icon: 'rgb(34, 35, 36)',
      },
      SUCCESS: {
        background: 'rgb(37, 38, 39)',
        border: 'rgb(40, 41, 42)',
        icon: 'rgb(43, 44, 45)',
      },
    };

    drawCanvasButton(context, button, colors);

    expect(fillStyles).toEqual([
      colors.DEFAULT.background,
      colors.DEFAULT.icon,
    ]);
    expect(strokeStyles).toEqual([colors.DEFAULT.border]);
  });

  it('resolves semantic tokens to concrete colors for the canvas', () => {
    const root = document.documentElement;
    const tokenValues = {
      '--om-color-bg-error': 'rgb(1, 1, 1)',
      '--om-color-bg-primary': 'rgb(2, 2, 2)',
      '--om-color-bg-success': 'rgb(3, 3, 3)',
      '--om-color-bg-warning': 'rgb(4, 4, 4)',
      '--om-color-border-brand': 'rgb(5, 5, 5)',
      '--om-color-border-error': 'rgb(6, 6, 6)',
      '--om-color-border-secondary': 'rgb(7, 7, 7)',
      '--om-color-fg-brand': 'rgb(8, 8, 8)',
      '--om-color-fg-error': 'rgb(9, 9, 9)',
      '--om-color-fg-success': 'rgb(10, 10, 10)',
      '--om-color-fg-warning': 'rgb(11, 11, 11)',
      '--om-color-text-primary': 'rgb(12, 12, 12)',
    };
    Object.entries(tokenValues).forEach(([token, value]) =>
      root.style.setProperty(token, value)
    );

    expect(resolveCanvasButtonColors()).toEqual({
      DEFAULT: {
        background: 'rgb(2, 2, 2)',
        border: 'rgb(7, 7, 7)',
        icon: 'rgb(12, 12, 12)',
      },
      FAILED: {
        background: 'rgb(1, 1, 1)',
        border: 'rgb(6, 6, 6)',
        icon: 'rgb(9, 9, 9)',
      },
      HOVER: {
        background: 'rgb(2, 2, 2)',
        border: 'rgb(5, 5, 5)',
        icon: 'rgb(8, 8, 8)',
      },
      PENDING: {
        background: 'rgb(4, 4, 4)',
        border: 'rgb(11, 11, 11)',
        icon: 'rgb(11, 11, 11)',
      },
      SUCCESS: {
        background: 'rgb(3, 3, 3)',
        border: 'rgb(10, 10, 10)',
        icon: 'rgb(10, 10, 10)',
      },
    });
  });
});
