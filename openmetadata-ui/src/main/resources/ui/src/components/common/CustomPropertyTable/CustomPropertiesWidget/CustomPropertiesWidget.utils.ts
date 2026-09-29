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
import { TFunction } from 'i18next';
import { isArray, isPlainObject, keyBy } from 'lodash';
import { CustomProperty } from '../../../../generated/type/customProperty';
import { getPropertyTypeMeta } from '../CustomPropertyCard/CustomPropertyCard.utils';
import {
  CUSTOM_PROPERTIES_DISPLAY_MODES,
  CUSTOM_PROPERTIES_WIDGET_DEFAULT_LIMIT,
  CUSTOM_PROPERTIES_WIDGET_STYLE_LABEL,
  DEFAULT_CUSTOM_PROPERTIES_WIDGET_SETTINGS,
} from './CustomPropertiesWidget.constants';
import {
  CustomPropertiesWidgetSettings,
  CustomPropertiesWidgetStyle,
  CustomPropertyCardSize,
  CustomPropertyLayoutItem,
  CustomPropertyLayoutWidth,
  LaidOutCustomProperty,
  LayoutDropTarget,
} from './CustomPropertiesWidget.types';

const LAYOUT_WIDTHS: CustomPropertyLayoutWidth[] = ['half', 'full'];
const CARD_SIZES: CustomPropertyCardSize[] = ['small', 'large'];

const isOneOf = <T extends string>(
  value: unknown,
  options: readonly T[]
): value is T => options.includes(value as T);

const isLayoutItem = (item: unknown): item is CustomPropertyLayoutItem =>
  isPlainObject(item) &&
  typeof (item as CustomPropertyLayoutItem).name === 'string' &&
  isOneOf((item as CustomPropertyLayoutItem).width, LAYOUT_WIDTHS);

/** Reads a stored property layout, dropping malformed entries and sizes. */
export const parsePropertyLayout = (
  propertyLayout: unknown
): CustomPropertyLayoutItem[] =>
  isArray(propertyLayout)
    ? propertyLayout
        .filter(isLayoutItem)
        .map(({ name, width, size }) =>
          isOneOf(size, CARD_SIZES) ? { name, width, size } : { name, width }
        )
    : [];

/**
 * Orders properties by a persona layout and attaches their width and size.
 * Properties missing from the layout (added after it was saved) keep their
 * relative order at the end, with the fallback width and no size.
 */
export const applyPropertyLayout = (
  properties: CustomProperty[],
  propertyLayout: CustomPropertyLayoutItem[],
  getDefaultWidth: (property: CustomProperty) => CustomPropertyLayoutWidth
): LaidOutCustomProperty[] => {
  const position = new Map(
    propertyLayout.map((item, index) => [item.name, index])
  );
  const itemByName = new Map(propertyLayout.map((item) => [item.name, item]));
  const rank = (property: CustomProperty) =>
    position.get(property.name) ?? Number.MAX_SAFE_INTEGER;

  return [...properties]
    .sort((a, b) => rank(a) - rank(b))
    .map((property) => {
      const item = itemByName.get(property.name);

      return {
        property,
        width: item?.width ?? getDefaultWidth(property),
        ...(item?.size && { size: item.size }),
      };
    });
};

export const toPropertyLayout = (
  items: LaidOutCustomProperty[]
): CustomPropertyLayoutItem[] =>
  items.map(({ property, width, size }) => ({
    name: property.name,
    width,
    ...(size && { size }),
  }));

/**
 * Reads the widget settings from a persona layout item's free-form config.
 * Layouts saved before the widget was configurable carry no such keys and
 * resolve to the defaults (first five properties, header shown, small).
 */
export const getCustomPropertiesWidgetSettings = (
  config?: Record<string, unknown>
): CustomPropertiesWidgetSettings => {
  const defaults = DEFAULT_CUSTOM_PROPERTIES_WIDGET_SETTINGS;
  const { displayMode, propertyNames, showHeader, size, propertyLayout } =
    config ?? {};

  return {
    displayMode: isOneOf(displayMode, CUSTOM_PROPERTIES_DISPLAY_MODES)
      ? displayMode
      : defaults.displayMode,
    propertyNames: isArray(propertyNames)
      ? propertyNames.filter((name): name is string => typeof name === 'string')
      : defaults.propertyNames,
    showHeader:
      typeof showHeader === 'boolean' ? showHeader : defaults.showHeader,
    size: isOneOf(size, CARD_SIZES) ? size : defaults.size,
    propertyLayout: parsePropertyLayout(propertyLayout),
  };
};

export const selectWidgetProperties = (
  properties: CustomProperty[],
  { displayMode, propertyNames }: CustomPropertiesWidgetSettings
): CustomProperty[] => {
  switch (displayMode) {
    case 'all':
      return properties;
    case 'selected': {
      // Selection order is the display order; names of since-deleted
      // properties are skipped.
      const byName = keyBy(properties, 'name');

      return propertyNames
        .map((name) => byName[name])
        .filter((property): property is CustomProperty => Boolean(property));
    }
    default:
      return properties.slice(0, CUSTOM_PROPERTIES_WIDGET_DEFAULT_LIMIT);
  }
};

export const isCustomPropertiesWidgetSettingsValid = ({
  displayMode,
  propertyNames,
}: CustomPropertiesWidgetSettings): boolean =>
  displayMode !== 'selected' || propertyNames.length > 0;

/** Widgets list one property per row unless the persona layout says otherwise. */
export const getWidgetDefaultWidth = (): CustomPropertyLayoutWidth => 'full';

/** The Custom Properties tab keeps its original two-column packing by default. */
export const getTabDefaultWidth = (
  property: CustomProperty
): CustomPropertyLayoutWidth =>
  getPropertyTypeMeta(property.propertyType.name).isWide ? 'full' : 'half';

/**
 * Index the dragged item ends up at when dropped on `target`, or `undefined`
 * when the drop leaves it where it is.
 */
export const getLayoutDropIndex = (
  fromIndex: number,
  target: LayoutDropTarget
): number | undefined => {
  const insertAt = target.side === 'before' ? target.index : target.index + 1;
  const toIndex = fromIndex < insertAt ? insertAt - 1 : insertAt;

  return toIndex === fromIndex ? undefined : toIndex;
};

export const moveLayoutItem = <T>(
  items: T[],
  fromIndex: number,
  toIndex: number
): T[] => {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  return next;
};

/** Stored widgets carry no style of their own: their card size decides it. */
export const getWidgetStyle = ({
  size,
}: CustomPropertiesWidgetSettings): CustomPropertiesWidgetStyle =>
  size === 'large' ? 'fullWidth' : 'preview';

/**
 * Full width shows a card per property; preview shows one-line rows. A preview
 * is one column wide, so its properties all take the full row.
 */
export const withWidgetStyle = (
  settings: CustomPropertiesWidgetSettings,
  style: CustomPropertiesWidgetStyle
): CustomPropertiesWidgetSettings =>
  style === 'fullWidth'
    ? { ...settings, size: 'large' }
    : {
        ...settings,
        size: 'small',
        propertyLayout: settings.propertyLayout.map((item) => ({
          ...item,
          width: 'full',
        })),
      };

/**
 * The widget's picked properties, in stored order. Widgets that never picked
 * any (new, first-five or show-all) start from the first few.
 */
export const getSelectedPropertyNames = (
  properties: CustomProperty[],
  settings: CustomPropertiesWidgetSettings
): string[] =>
  settings.displayMode === 'selected' || settings.propertyNames.length
    ? settings.propertyNames
    : selectWidgetProperties(properties, {
        ...settings,
        displayMode: 'default',
      }).map(({ name }) => name);

/**
 * Puts a reordered subset back into the full list: items outside the subset
 * keep their slots, the subset fills its own slots in its new order.
 */
export const reorderSubset = <T>(
  items: T[],
  isInSubset: (item: T) => boolean,
  reorderedSubset: T[]
): T[] => {
  let next = 0;

  return items.map((item) =>
    isInSubset(item) ? reorderedSubset[next++] : item
  );
};

/** The widget layout stores order and width; its style sets the card size. */
export const toWidgetPropertyLayout = (
  items: LaidOutCustomProperty[]
): CustomPropertyLayoutItem[] =>
  items.map(({ property, width }) => ({ name: property.name, width }));

/**
 * Layout after the shown properties were rearranged in place: they come first
 * in their new order, entries of properties not shown keep their place after.
 */
export const mergeShownPropertyLayout = (
  shown: LaidOutCustomProperty[],
  previous: CustomPropertyLayoutItem[]
): CustomPropertyLayoutItem[] => {
  const shownNames = new Set(shown.map(({ property }) => property.name));

  return [
    ...toWidgetPropertyLayout(shown),
    ...previous.filter(({ name }) => !shownNames.has(name)),
  ];
};

/** Small cards take half a row, large ones the full row. */
export const countCardSizes = (items: LaidOutCustomProperty[]) => {
  const large = items.filter(({ width }) => width === 'full').length;

  return { small: items.length - large, large };
};

/** Footer line of the Add Widget dialog, e.g. "6 properties · Full width". */
export const getWidgetSummary = (
  properties: CustomProperty[],
  settings: CustomPropertiesWidgetSettings,
  style: CustomPropertiesWidgetStyle,
  t: TFunction
): string =>
  t('message.custom-properties-widget-summary', {
    count: selectWidgetProperties(properties, settings).length,
    style: t(CUSTOM_PROPERTIES_WIDGET_STYLE_LABEL[style]),
  });
