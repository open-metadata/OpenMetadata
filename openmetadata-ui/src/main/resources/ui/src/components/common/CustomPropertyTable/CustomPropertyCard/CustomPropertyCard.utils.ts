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
import { isArray, isEmpty, isNil, isPlainObject } from 'lodash';
import {
  HYPERLINK_TYPE_CUSTOM_PROPERTY,
  TABLE_TYPE_CUSTOM_PROPERTY,
} from '../../../../constants/CustomProperty.constants';
import { CustomProperty } from '../../../../generated/type/customProperty';
import {
  CUSTOM_PROPERTY_TYPE_META,
  DEFAULT_PROPERTY_TYPE_META,
} from './CustomPropertyCard.constants';
import {
  CustomPropertySortMode,
  CustomPropertyTypeMeta,
} from './CustomPropertyCard.types';

const getRows = (value: unknown): unknown[] | undefined => {
  if (isPlainObject(value)) {
    const rows = (value as { rows?: unknown }).rows;

    return isArray(rows) ? rows : undefined;
  }

  return undefined;
};

export const getPropertyTypeMeta = (
  propertyTypeName?: string
): CustomPropertyTypeMeta =>
  CUSTOM_PROPERTY_TYPE_META[propertyTypeName ?? ''] ??
  DEFAULT_PROPERTY_TYPE_META;

export const isPropertyValueEmpty = (
  propertyTypeName: string | undefined,
  value: unknown
): boolean => {
  if (isNil(value) || value === '') {
    return true;
  }
  if (propertyTypeName === TABLE_TYPE_CUSTOM_PROPERTY) {
    return isEmpty(getRows(value));
  }
  if (propertyTypeName === HYPERLINK_TYPE_CUSTOM_PROPERTY) {
    return !(value as { url?: string }).url;
  }

  return typeof value === 'object' && isEmpty(value);
};

/** Item count shown next to the title of list-shaped properties. */
export const getPropertyItemCount = (
  propertyTypeName: string | undefined,
  value: unknown
): number | undefined => {
  let items: unknown[] | undefined;
  if (propertyTypeName === TABLE_TYPE_CUSTOM_PROPERTY) {
    items = getRows(value);
  } else if (propertyTypeName === 'entityReferenceList' && isArray(value)) {
    items = value;
  }

  return items?.length ? items.length : undefined;
};

const getPropertyLabel = (property: CustomProperty) =>
  property.displayName || property.name;

const compareByLabel = (a: CustomProperty, b: CustomProperty) =>
  getPropertyLabel(a).localeCompare(getPropertyLabel(b));

export const filterAndSortProperties = (
  properties: CustomProperty[],
  extension: Record<string, unknown> | undefined,
  searchText: string,
  sortMode: CustomPropertySortMode
): CustomProperty[] => {
  const query = searchText.trim().toLowerCase();
  const filtered = query
    ? properties.filter((property) =>
        [property.name, property.displayName, property.description].some(
          (text) => text?.toLowerCase().includes(query)
        )
      )
    : [...properties];

  const hasValue = (property: CustomProperty) =>
    !isPropertyValueEmpty(
      property.propertyType.name,
      extension?.[property.name]
    );

  const comparators: Record<
    CustomPropertySortMode,
    (a: CustomProperty, b: CustomProperty) => number
  > = {
    name: compareByLabel,
    type: (a, b) =>
      (a.propertyType.name ?? '').localeCompare(b.propertyType.name ?? '') ||
      compareByLabel(a, b),
    value: (a, b) =>
      Number(hasValue(b)) - Number(hasValue(a)) || compareByLabel(a, b),
  };

  // Full-width cards (tables, SQL, markdown, time intervals) follow the
  // half-width ones so the two-column grid stays packed, as in the design.
  const byWidth = (property: CustomProperty) =>
    Number(Boolean(getPropertyTypeMeta(property.propertyType.name).isWide));

  return filtered.sort(
    (a, b) => byWidth(a) - byWidth(b) || comparators[sortMode](a, b)
  );
};
