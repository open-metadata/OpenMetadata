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
  DEFAULT_NODE_COLOR,
  DEFAULT_NODE_SIZE,
  ENTITY_COLORS,
  ENTITY_SIZES,
  LABEL_COLOR,
  LEGEND_TYPES,
} from './KnowledgeGraph3D.constants';
import {
  colorFor,
  hexRgba,
  initials,
  resolveGraphColor,
  sizeFor,
} from './nodeCanvas';

describe('colorFor', () => {
  afterEach(() => {
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
  });

  it('resolves a categorical token before painting it to canvas', () => {
    document.documentElement.style.setProperty('--color-brand-500', '#123456');

    expect(colorFor('table')).toBe('#123456');
  });

  it('returns the default fallback for an unknown type', () => {
    const result = colorFor('not-a-real-type');

    expect(DEFAULT_NODE_COLOR).toContain('#9AA3B2');
    expect(result).toBe('#9AA3B2');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('re-resolves semantic colors after the active theme changes', () => {
    document.documentElement.style.setProperty(
      '--color-text-primary',
      '#181d27'
    );

    expect(resolveGraphColor(LABEL_COLOR)).toBe('#181d27');

    document.documentElement.classList.add('dark-mode');
    document.documentElement.style.setProperty(
      '--color-text-primary',
      '#fafafa'
    );

    expect(resolveGraphColor(LABEL_COLOR)).toBe('#fafafa');
  });
});

describe('sizeFor', () => {
  it('returns the mapped size for a known type', () => {
    expect(sizeFor('domain')).toBe(ENTITY_SIZES.domain);
  });

  it('returns a positive default fallback for an unknown type', () => {
    const result = sizeFor('not-a-real-type');

    expect(result).toBe(DEFAULT_NODE_SIZE);
    expect(result).toBeGreaterThan(0);
  });
});

describe('hexRgba', () => {
  it('converts a hex color and alpha into an rgba string', () => {
    expect(hexRgba('#3B96F6', 0.5)).toBe('rgba(59,150,246,0.5)');
  });

  it('handles full opacity', () => {
    expect(hexRgba('#000000', 1)).toBe('rgba(0,0,0,1)');
  });

  it('handles the space-separated RGB format used by palette tokens', () => {
    expect(hexRgba('rgb(102 198 28)', 0.5)).toBe('rgba(102,198,28,0.5)');
  });

  it('expands short hex colors before applying opacity', () => {
    expect(hexRgba('#fff', 0.25)).toBe('rgba(255,255,255,0.25)');
  });

  it('uses the token fallback when the resolved format is not canvas-safe', () => {
    document.documentElement.style.setProperty(
      '--color-brand-500',
      'oklch(62% 0.2 250)'
    );

    expect(hexRgba(ENTITY_COLORS.table, 0.5)).toBe('rgba(46,144,250,0.5)');
  });
});

describe('initials', () => {
  it('uses the first letters of two words, uppercased', () => {
    expect(initials('John Doe')).toBe('JD');
  });

  it('uses the first two letters of a single word', () => {
    expect(initials('Marketing')).toBe('MA');
  });
});

describe('node type coverage', () => {
  it('has a non-empty color for every legend node type', () => {
    LEGEND_TYPES.forEach((type) => {
      const color = colorFor(type);

      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
      expect(ENTITY_COLORS[type]).toBeDefined();
    });
  });

  it('has a positive size for every legend node type', () => {
    LEGEND_TYPES.forEach((type) => {
      const size = sizeFor(type);

      expect(size).toBeGreaterThan(0);
      expect(ENTITY_SIZES[type]).toBeDefined();
    });
  });
});
