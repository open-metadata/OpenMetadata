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
  buildComboStyle,
  buildDataModeAssetNodeStyle,
  buildDataModeTermNodeStyle,
  buildDefaultRectNodeStyle,
  getEdgeRelationLabelStyle,
} from './graphStyles';

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
  it('resolves semantic surface colors for rectangular canvas nodes', () => {
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

  it('resolves semantic chrome colors for data-mode term nodes', () => {
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

  it('resolves semantic card colors for data-mode asset nodes', () => {
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

  it('resolves semantic colors for generic edge labels', () => {
    const style = getEdgeRelationLabelStyle(
      'RELATED TO',
      undefined,
      undefined,
      resolveSemanticColor
    );

    expect(style).toMatchObject({
      labelBackgroundFill: 'rgb(24, 27, 33)',
      labelBackgroundShadowColor: 'rgb(34, 38, 47)',
      labelBackgroundStroke: 'rgb(12, 14, 18)',
      labelFill: 'rgb(148, 153, 162)',
    });
  });

  it('resolves semantic colors for glossary combos', () => {
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
