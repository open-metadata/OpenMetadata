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
import { CustomProperty } from '../../../../generated/type/customProperty';
import { DEFAULT_CUSTOM_PROPERTIES_WIDGET_SETTINGS } from './CustomPropertiesWidget.constants';
import { CustomPropertiesWidgetSettings } from './CustomPropertiesWidget.interface';
import {
  applyPropertyLayout,
  countCardSizes,
  getCustomPropertiesWidgetSettings,
  getLayoutDropIndex,
  getSelectedPropertyNames,
  getWidgetDefaultWidth,
  getWidgetStyle,
  mergeShownPropertyLayout,
  moveLayoutItem,
  parsePropertyLayout,
  reorderSubset,
  toPropertyLayout,
  withWidgetStyle,
} from './CustomPropertiesWidget.utils';

const createProperty = (name: string): CustomProperty => ({
  name,
  description: '',
  propertyType: { id: 'string-id', name: 'string', type: 'type' },
});

describe('getCustomPropertiesWidgetSettings', () => {
  it('reads the widget grid size as the default card size', () => {
    expect(getCustomPropertiesWidgetSettings({ size: 'large' }).size).toBe(
      'large'
    );
  });

  it('falls back to small for a missing or unknown size', () => {
    expect(getCustomPropertiesWidgetSettings(undefined).size).toBe('small');
    expect(getCustomPropertiesWidgetSettings({ size: 'medium' }).size).toBe(
      'small'
    );
  });
});

describe('parsePropertyLayout', () => {
  it('keeps valid sizes and drops unknown ones without dropping the item', () => {
    expect(
      parsePropertyLayout([
        { name: 'a', width: 'half', size: 'large' },
        { name: 'b', width: 'full', size: 'huge' },
        { name: 'c', width: 'full' },
        { name: 'd', width: 'wide' },
      ])
    ).toEqual([
      { name: 'a', width: 'half', size: 'large' },
      { name: 'b', width: 'full' },
      { name: 'c', width: 'full' },
    ]);
  });
});

describe('applyPropertyLayout', () => {
  it('attaches stored sizes and leaves unlisted properties without one', () => {
    const laidOut = applyPropertyLayout(
      [createProperty('a'), createProperty('b')],
      [{ name: 'b', width: 'half', size: 'large' }],
      getWidgetDefaultWidth
    );

    expect(
      laidOut.map(({ property, width, size }) => [property.name, width, size])
    ).toEqual([
      ['b', 'half', 'large'],
      ['a', 'full', undefined],
    ]);
  });

  it('round-trips through toPropertyLayout without adding a size', () => {
    const layout = [
      { name: 'a', width: 'full' as const },
      { name: 'b', width: 'half' as const, size: 'small' as const },
    ];

    expect(
      toPropertyLayout(
        applyPropertyLayout(
          [createProperty('a'), createProperty('b')],
          layout,
          getWidgetDefaultWidth
        )
      )
    ).toEqual(layout);
  });
});

describe('getLayoutDropIndex', () => {
  it('moves an item forward past the target when dropped after it', () => {
    expect(getLayoutDropIndex(0, { index: 2, side: 'after' })).toBe(2);
  });

  it('moves an item forward in front of the target when dropped before it', () => {
    expect(getLayoutDropIndex(0, { index: 2, side: 'before' })).toBe(1);
  });

  it('moves an item backward in front of the target', () => {
    expect(getLayoutDropIndex(3, { index: 1, side: 'before' })).toBe(1);
  });

  it('moves an item backward behind the target', () => {
    expect(getLayoutDropIndex(3, { index: 1, side: 'after' })).toBe(2);
  });

  it('reports no move when the item lands where it already is', () => {
    expect(getLayoutDropIndex(2, { index: 2, side: 'before' })).toBeUndefined();
    expect(getLayoutDropIndex(2, { index: 2, side: 'after' })).toBeUndefined();
    expect(getLayoutDropIndex(2, { index: 1, side: 'after' })).toBeUndefined();
    expect(getLayoutDropIndex(2, { index: 3, side: 'before' })).toBeUndefined();
  });
});

describe('moveLayoutItem', () => {
  it('returns a reordered copy and leaves the input untouched', () => {
    const items = ['a', 'b', 'c', 'd'];

    expect(moveLayoutItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveLayoutItem(items, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });
});

const settingsWith = (
  overrides: Partial<CustomPropertiesWidgetSettings>
): CustomPropertiesWidgetSettings => ({
  ...DEFAULT_CUSTOM_PROPERTIES_WIDGET_SETTINGS,
  ...overrides,
});

const names = (...list: string[]) => list.map(createProperty);

describe('widget style', () => {
  it('reads a large widget as full width and a small one as preview', () => {
    expect(getWidgetStyle(settingsWith({ size: 'large' }))).toBe('fullWidth');
    expect(getWidgetStyle(settingsWith({ size: 'small' }))).toBe('preview');
  });

  it('keeps the chosen widths for full width', () => {
    const layout = [{ name: 'a', width: 'half' as const }];

    expect(
      withWidgetStyle(settingsWith({ propertyLayout: layout }), 'fullWidth')
    ).toEqual(settingsWith({ size: 'large', propertyLayout: layout }));
  });

  it('preserves the chosen widths when switching to preview', () => {
    const layout = [{ name: 'a', width: 'half' as const }];

    expect(
      withWidgetStyle(
        settingsWith({ size: 'large', propertyLayout: layout }),
        'preview'
      )
    ).toEqual(settingsWith({ size: 'small', propertyLayout: layout }));
  });

  it('restores the chosen widths after a preview round trip', () => {
    const layout = [
      { name: 'a', width: 'half' as const },
      { name: 'b', width: 'full' as const },
    ];

    const roundTrip = withWidgetStyle(
      withWidgetStyle(
        settingsWith({ size: 'large', propertyLayout: layout }),
        'preview'
      ),
      'fullWidth'
    );

    expect(roundTrip).toEqual(
      settingsWith({ size: 'large', propertyLayout: layout })
    );
  });
});

describe('getSelectedPropertyNames', () => {
  const properties = names('a', 'b', 'c', 'd', 'e', 'f');

  it('returns the picked properties in stored order', () => {
    expect(
      getSelectedPropertyNames(
        properties,
        settingsWith({ displayMode: 'selected', propertyNames: ['c', 'a'] })
      )
    ).toEqual(['c', 'a']);
  });

  it('keeps an emptied selection empty', () => {
    expect(
      getSelectedPropertyNames(
        properties,
        settingsWith({ displayMode: 'selected', propertyNames: [] })
      )
    ).toEqual([]);
  });

  it('keeps the selection made before switching to all', () => {
    expect(
      getSelectedPropertyNames(
        properties,
        settingsWith({ displayMode: 'all', propertyNames: ['b'] })
      )
    ).toEqual(['b']);
  });

  it('starts a widget that never picked any from the first five', () => {
    const firstFive = ['a', 'b', 'c', 'd', 'e'];

    expect(getSelectedPropertyNames(properties, settingsWith({}))).toEqual(
      firstFive
    );
    expect(
      getSelectedPropertyNames(properties, settingsWith({ displayMode: 'all' }))
    ).toEqual(firstFive);
  });
});

describe('reorderSubset', () => {
  it('reorders the subset in its own slots and leaves the rest in place', () => {
    expect(
      reorderSubset(
        ['a', 'x', 'b', 'y', 'c'],
        (item) => ['a', 'b', 'c'].includes(item),
        ['c', 'a', 'b']
      )
    ).toEqual(['c', 'x', 'a', 'y', 'b']);
  });
});

describe('mergeShownPropertyLayout', () => {
  it('puts the shown properties first and keeps the others after them', () => {
    expect(
      mergeShownPropertyLayout(
        [
          { property: createProperty('b'), width: 'half', size: 'large' },
          { property: createProperty('a'), width: 'full' },
        ],
        [
          { name: 'a', width: 'full' },
          { name: 'hidden', width: 'half' },
          { name: 'b', width: 'full' },
        ]
      )
    ).toEqual([
      { name: 'b', width: 'half' },
      { name: 'a', width: 'full' },
      { name: 'hidden', width: 'half' },
    ]);
  });
});

describe('countCardSizes', () => {
  it('counts half-width cards as small and full-width ones as large', () => {
    expect(
      countCardSizes([
        { property: createProperty('a'), width: 'half' },
        { property: createProperty('b'), width: 'full' },
        { property: createProperty('c'), width: 'half' },
      ])
    ).toEqual({ small: 2, large: 1 });
  });
});
