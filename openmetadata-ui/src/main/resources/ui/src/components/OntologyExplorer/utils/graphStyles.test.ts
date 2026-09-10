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

jest.mock('@antv/g', () => ({
  Circle: class {},
  Group: class {},
  Image: class {},
  Line: class {},
  Rect: class {},
  Text: class {},
}));

jest.mock('@antv/g6', () => ({
  Circle: class {},
  ExtensionCategory: { COMBO: 'combo', EDGE: 'edge', NODE: 'node' },
  Line: class {},
  Polyline: class {},
  Quadratic: class {},
  Rect: class {},
  RectCombo: class {},
  idOf: (value: unknown) => value,
  register: jest.fn(),
}));

import { PaletteKey } from '../../../generated/entity/data/relationshipType';
import { createRelationshipTypeMock } from '../../../mocks/Ontology.mock';
import { RELATION_META } from '../OntologyExplorer.constants';
import {
  buildComboStyle,
  buildDataModeAssetNodeStyle,
  buildDataModeTermNodeStyle,
  buildDefaultRectNodeStyle,
  formatRelationLabel,
  getCanvasColor,
  getEdgeRelationLabelStyle,
  getEffectiveRelationColor,
  truncateHierarchyBadgeToFitWidth,
} from './graphStyles';
import { getRelationshipColor } from './relationshipTypeUtils';

const ELLIPSIS = '…';

const mockComputedStyle = (
  color: string,
  propertyValue = ''
): CSSStyleDeclaration =>
  ({
    backgroundColor: color,
    color,
    getPropertyValue: () => propertyValue,
  } as unknown as CSSStyleDeclaration);

const resolveSemanticColor = (color: string, fallback: string): string =>
  ({
    'var(--color-bg-primary)': 'rgb(12, 14, 18)',
    'var(--color-bg-secondary)': 'rgb(24, 27, 33)',
    'var(--color-border-primary)': 'rgb(55, 58, 65)',
    'var(--color-border-secondary)': 'rgb(34, 38, 47)',
    'var(--color-text-primary)': 'rgb(247, 247, 247)',
    'var(--color-text-tertiary)': 'rgb(148, 153, 162)',
    'var(--color-text-white)': 'rgb(255, 255, 255)',
  }[color] ?? fallback);

describe('theme-aware graph styles', () => {
  it('resolves semantic surface colors before returning a rectangular canvas node', () => {
    const style = buildDefaultRectNodeStyle(
      resolveSemanticColor,
      'Customer',
      [180, 40]
    );

    expect(style).toMatchObject({
      fill: 'rgb(12, 14, 18)',
      labelFill: 'rgb(247, 247, 247)',
      shadowColor: 'rgb(34, 38, 47)',
      stroke: 'rgb(34, 38, 47)',
    });
  });

  it('resolves semantic chrome colors before returning a data-mode term node', () => {
    const style = buildDataModeTermNodeStyle(
      resolveSemanticColor,
      'Customer',
      '#1570ef'
    );

    expect(style).toMatchObject({
      haloShadowColor: 'rgb(34, 38, 47)',
      haloStroke: 'rgb(34, 38, 47)',
      labelBackgroundShadowColor: 'rgb(34, 38, 47)',
      labelBackgroundStroke: 'rgb(12, 14, 18)',
      labelFill: 'rgb(255, 255, 255)',
      shadowColor: 'rgb(55, 58, 65)',
      stroke: 'rgb(12, 14, 18)',
    });
  });

  it('resolves semantic card colors before returning a data-mode asset node', () => {
    const getContextSpy = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);
    const style = buildDataModeAssetNodeStyle(
      resolveSemanticColor,
      'Customer table',
      '#1570ef'
    );
    getContextSpy.mockRestore();

    expect(style).toMatchObject({
      fill: 'rgb(12, 14, 18)',
      labelBackgroundFill: 'rgb(12, 14, 18)',
      labelBackgroundStroke: 'rgb(34, 38, 47)',
      labelFill: 'rgb(247, 247, 247)',
    });
  });

  it('resolves semantic colors before returning a generic edge label', () => {
    const style = getEdgeRelationLabelStyle(
      'RELATED TO',
      undefined,
      undefined,
      false,
      resolveSemanticColor
    );

    expect(style).toMatchObject({
      labelBackgroundFill: 'rgb(24, 27, 33)',
      labelBackgroundShadowColor: 'rgb(34, 38, 47)',
      labelBackgroundStroke: 'rgb(12, 14, 18)',
      labelFill: 'rgb(148, 153, 162)',
    });
  });

  it('resolves semantic colors before returning a glossary combo', () => {
    const getContextSpy = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);
    const style = buildComboStyle(
      'Marketing',
      'var(--color-border-primary)',
      0,
      resolveSemanticColor
    );
    getContextSpy.mockRestore();

    expect(style).toMatchObject({
      fill: 'rgb(12, 14, 18)',
      labelFill: 'rgb(55, 58, 65)',
      stroke: 'rgb(55, 58, 65)',
    });
  });
});

describe('getEffectiveRelationColor', () => {
  it('prefers RELATION_META over the configured palette for system relations', () => {
    const relationshipType = createRelationshipTypeMock({
      name: 'partOf',
      paletteKey: PaletteKey.Blue,
      systemDefined: true,
    });

    expect(getEffectiveRelationColor('partOf', relationshipType)).toBe(
      RELATION_META.partOf.color
    );
    expect(getEffectiveRelationColor('partOf', relationshipType)).not.toBe(
      getRelationshipColor(relationshipType)
    );
  });

  it('falls back to the configured palette when a system relation has no RELATION_META entry', () => {
    const relationshipType = createRelationshipTypeMock({
      name: 'unmappedRelation',
      paletteKey: PaletteKey.Blue,
      systemDefined: true,
    });

    expect(
      getEffectiveRelationColor('unmappedRelation', relationshipType)
    ).toBe(getRelationshipColor(relationshipType));
  });

  it('prefers the configured palette over the RELATION_META fallback for non-system relations', () => {
    const relationshipType = createRelationshipTypeMock({
      name: 'partOf',
      paletteKey: PaletteKey.Blue,
      systemDefined: false,
    });

    expect(getEffectiveRelationColor('partOf', relationshipType)).toBe(
      getRelationshipColor(relationshipType)
    );
  });

  it('returns undefined when neither a configured palette nor RELATION_META applies', () => {
    expect(
      getEffectiveRelationColor('totallyUnknownRelation', undefined)
    ).toBeUndefined();
  });
});

describe('formatRelationLabel', () => {
  it('converts camelCase relation types to spaced uppercase', () => {
    expect(formatRelationLabel('isPartOf')).toBe('IS PART OF');
  });

  it('uppercases single-token relation types', () => {
    expect(formatRelationLabel('relatedTo')).toBe('RELATED TO');
  });
});

describe('truncateHierarchyBadgeToFitWidth', () => {
  it('returns the trimmed text unchanged when it fits the budget', () => {
    expect(truncateHierarchyBadgeToFitWidth('  Short  ', 500, 10)).toBe(
      'Short'
    );
  });

  it('appends a single-character ellipsis when the text exceeds the budget', () => {
    const result = truncateHierarchyBadgeToFitWidth(
      'RelationshipLongName',
      40,
      10
    );

    expect(result).toBe(`Relat${ELLIPSIS}`);
    expect(result.endsWith(ELLIPSIS)).toBe(true);
  });

  it('keeps a floor of four characters even for a zero-width budget', () => {
    expect(truncateHierarchyBadgeToFitWidth('ABCDEFGH', 0, 100)).toBe(
      `ABC${ELLIPSIS}`
    );
  });

  it('returns an empty string for whitespace-only text', () => {
    expect(truncateHierarchyBadgeToFitWidth('   ', 40, 10)).toBe('');
  });
});

describe('getCanvasColor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the fallback hex when document is not available', () => {
    jest
      .spyOn(globalThis, 'document', 'get')
      .mockReturnValue(undefined as unknown as Document);

    expect(getCanvasColor('var(--color-missing)', '#abcdef')).toBe('#abcdef');
  });

  it('returns the input unchanged when it is not a var() token', () => {
    expect(getCanvasColor('#123456', '#000000')).toBe('#123456');
    expect(getCanvasColor('rgb(1, 2, 3)', '#000000')).toBe('rgb(1, 2, 3)');
  });

  it('resolves and caches a var() token from the computed cascade', () => {
    const spy = jest
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue(mockComputedStyle('rgb(1, 2, 3)'));

    const first = getCanvasColor('var(--color-cache-probe)', '#zzzzzz');

    expect(first).toBe('rgb(1, 2, 3)');

    spy.mockReturnValue(mockComputedStyle('rgb(9, 9, 9)'));
    const second = getCanvasColor('var(--color-cache-probe)', '#zzzzzz');

    expect(second).toBe('rgb(1, 2, 3)');
  });

  it('returns the fallback hex when the token resolves to a transparent or non-color value', () => {
    jest
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue(mockComputedStyle('rgba(0, 0, 0, 0)', '12px'));

    expect(getCanvasColor('var(--color-unresolvable)', '#fedcba')).toBe(
      '#fedcba'
    );
  });
});
