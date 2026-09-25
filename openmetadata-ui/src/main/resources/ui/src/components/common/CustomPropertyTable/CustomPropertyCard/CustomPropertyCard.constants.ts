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
  AlignLeft,
  Calendar,
  Clock,
  Code01,
  Database01,
  Hash02,
  Hourglass01,
  Link01,
  List,
  Mail01,
  Table,
  Type01,
} from '@openmetadata/ui-core-components/icons';
import {
  HYPERLINK_TYPE_CUSTOM_PROPERTY,
  TABLE_TYPE_CUSTOM_PROPERTY,
} from '../../../../constants/CustomProperty.constants';
import {
  CustomPropertySortMode,
  CustomPropertyTypeColor,
  CustomPropertyTypeMeta,
} from './CustomPropertyCard.types';

export const DEFAULT_PROPERTY_TYPE_META: CustomPropertyTypeMeta = {
  icon: Type01,
  color: 'gray',
  labelKey: 'label.value',
  emptyActionKey: 'label.set-value',
};

export const CUSTOM_PROPERTY_TYPE_META: Record<string, CustomPropertyTypeMeta> =
  {
    string: {
      icon: Type01,
      color: 'gray-blue',
      labelKey: 'label.string',
      emptyActionKey: 'label.set-value',
    },
    integer: {
      icon: Hash02,
      color: 'blue-light',
      labelKey: 'label.integer',
      emptyActionKey: 'label.set-value',
    },
    number: {
      icon: Hash02,
      color: 'blue-light',
      labelKey: 'label.number',
      emptyActionKey: 'label.set-value',
    },
    email: {
      icon: Mail01,
      color: 'pink',
      labelKey: 'label.email',
      emptyActionKey: 'label.set-email',
    },
    'date-cp': {
      icon: Calendar,
      color: 'orange',
      labelKey: 'label.date',
      emptyActionKey: 'label.set-date',
    },
    'dateTime-cp': {
      icon: Calendar,
      color: 'orange',
      labelKey: 'label.date-and-time',
      emptyActionKey: 'label.set-date-and-time',
    },
    'time-cp': {
      icon: Clock,
      color: 'orange',
      labelKey: 'label.time',
      emptyActionKey: 'label.set-time',
    },
    timestamp: {
      icon: Clock,
      color: 'warning',
      labelKey: 'label.timestamp',
      emptyActionKey: 'label.set-timestamp',
    },
    duration: {
      icon: Hourglass01,
      color: 'warning',
      labelKey: 'label.duration',
      emptyActionKey: 'label.set-duration',
    },
    enum: {
      icon: List,
      color: 'purple',
      labelKey: 'label.enum',
      emptyActionKey: 'label.select-value',
    },
    [HYPERLINK_TYPE_CUSTOM_PROPERTY]: {
      icon: Link01,
      color: 'blue',
      labelKey: 'label.hyperlink',
      emptyActionKey: 'label.add-link',
    },
    entityReference: {
      icon: Database01,
      color: 'indigo',
      labelKey: 'label.entity-ref',
      emptyActionKey: 'label.select-asset',
    },
    entityReferenceList: {
      icon: Database01,
      color: 'indigo',
      labelKey: 'label.entity-ref-list',
      emptyActionKey: 'label.select-asset-plural',
    },
    timeInterval: {
      icon: Clock,
      color: 'brand',
      labelKey: 'label.time-interval',
      emptyActionKey: 'label.set-time-range',
      isWide: true,
    },
    [TABLE_TYPE_CUSTOM_PROPERTY]: {
      icon: Table,
      color: 'error',
      labelKey: 'label.table',
      emptyActionKey: 'label.add-row',
      isWide: true,
    },
    sqlQuery: {
      icon: Code01,
      color: 'success',
      labelKey: 'label.sql-uppercase',
      emptyActionKey: 'label.add-query',
      isWide: true,
    },
    markdown: {
      icon: AlignLeft,
      color: 'gray',
      labelKey: 'label.markdown',
      emptyActionKey: 'label.add-note-plural',
      isWide: true,
    },
  };

// Full class strings (not interpolated) so Tailwind can see them at build time.
export const TYPE_ICON_TILE_CLASS: Record<CustomPropertyTypeColor, string> = {
  gray: 'tw:bg-utility-gray-50 tw:border-utility-gray-200 tw:text-utility-gray-700',
  brand:
    'tw:bg-utility-brand-50 tw:border-utility-brand-200 tw:text-utility-brand-700',
  error:
    'tw:bg-utility-error-50 tw:border-utility-error-200 tw:text-utility-error-700',
  warning:
    'tw:bg-utility-warning-50 tw:border-utility-warning-200 tw:text-utility-warning-700',
  success:
    'tw:bg-utility-success-50 tw:border-utility-success-200 tw:text-utility-success-700',
  'gray-blue':
    'tw:bg-utility-gray-blue-50 tw:border-utility-gray-blue-200 tw:text-utility-gray-blue-700',
  'blue-light':
    'tw:bg-utility-blue-light-50 tw:border-utility-blue-light-200 tw:text-utility-blue-light-700',
  blue: 'tw:bg-utility-blue-50 tw:border-utility-blue-200 tw:text-utility-blue-700',
  indigo:
    'tw:bg-utility-indigo-50 tw:border-utility-indigo-200 tw:text-utility-indigo-700',
  purple:
    'tw:bg-utility-purple-50 tw:border-utility-purple-200 tw:text-utility-purple-700',
  pink: 'tw:bg-utility-pink-50 tw:border-utility-pink-200 tw:text-utility-pink-700',
  orange:
    'tw:bg-utility-orange-50 tw:border-utility-orange-200 tw:text-utility-orange-700',
};

// Chips shown before a "+N more" toggle; entity chips are wider than enum ones.
export const ENTITY_REFERENCE_VISIBLE_COUNT = 2;
export const ENUM_VISIBLE_COUNT = 4;

export const SORT_OPTIONS: { id: CustomPropertySortMode; labelKey: string }[] =
  [
    { id: 'name', labelKey: 'label.name' },
    { id: 'type', labelKey: 'label.type' },
    { id: 'value', labelKey: 'label.with-value-first' },
  ];
