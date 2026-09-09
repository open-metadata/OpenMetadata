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
  HYPERLINK_TYPE_CUSTOM_PROPERTY,
  TABLE_TYPE_CUSTOM_PROPERTY,
} from '../../../constants/CustomProperty.constants';

export type ExtensionFieldKind =
  | 'date'
  | 'dateTime'
  | 'duration'
  | 'email'
  | 'enum'
  | 'hyperlink'
  | 'markdown'
  | 'number'
  | 'reference'
  | 'sqlQuery'
  | 'table'
  | 'text'
  | 'time'
  | 'timeInterval'
  | 'timestamp';

export const getExtensionPropertyName = (fieldPath: string) =>
  fieldPath.startsWith('extension.')
    ? fieldPath.substring('extension.'.length)
    : fieldPath;

export const getExtensionFormKey = (propertyName: string) =>
  `cp_${Array.from(propertyName)
    .map((character) => character.codePointAt(0)?.toString(16))
    .join('_')}`;

const MAX_UNICODE_CODE_POINT = 0x10ffff;

export const getExtensionPropertyNameFromFormKey = (formKey: string) => {
  if (!formKey.startsWith('cp_')) {
    return formKey;
  }
  const codePoints = formKey
    .substring('cp_'.length)
    .split('_')
    .map((value) => Number.parseInt(value, 16));

  return codePoints.every(
    (codePoint) =>
      Number.isFinite(codePoint) &&
      codePoint >= 0 &&
      codePoint <= MAX_UNICODE_CODE_POINT
  )
    ? String.fromCodePoint(...codePoints)
    : formKey;
};

export const getExtensionFieldKind = (
  propertyTypeName?: string
): ExtensionFieldKind => {
  switch (propertyTypeName) {
    case 'date-cp':
      return 'date';
    case 'dateTime-cp':
      return 'dateTime';
    case 'duration':
      return 'duration';
    case 'email':
      return 'email';
    case 'enum':
      return 'enum';
    case 'entityReference':
    case 'entityReferenceList':
      return 'reference';
    case HYPERLINK_TYPE_CUSTOM_PROPERTY:
      return 'hyperlink';
    case 'integer':
    case 'number':
      return 'number';
    case 'markdown':
      return 'markdown';
    case 'sqlQuery':
      return 'sqlQuery';
    case TABLE_TYPE_CUSTOM_PROPERTY:
      return 'table';
    case 'time-cp':
      return 'time';
    case 'timeInterval':
      return 'timeInterval';
    case 'timestamp':
      return 'timestamp';
    case 'string':
    default:
      return 'text';
  }
};
