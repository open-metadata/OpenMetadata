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

/**
 * The suffix appended to a property name to produce the form key used
 * inside `extensionFormValues`.
 *
 * Kept as a named constant so that the encoder (`getExtensionFormKey`) and
 * the decoder (`getExtensionPropertyNameFromFormKey`) share a single source
 * of truth and changing the separator can never create a mismatch.
 */
const FORM_KEY_SUFFIX = '__ext';

/**
 * Given the `name` of a custom property, returns the key used for that
 * property inside the `extensionFormValues` form-group.
 *
 * Example:
 *   "myProp" → "myProp__ext"
 */
export const getExtensionFormKey = (propertyName: string): string =>
  `${propertyName}${FORM_KEY_SUFFIX}`;

/**
 * Reverses `getExtensionFormKey`: given a form key (as produced by
 * `getExtensionFormKey`), returns the original property name.
 *
 * Example:
 *   "myProp__ext" → "myProp"
 */
export const getExtensionPropertyNameFromFormKey = (formKey: string): string =>
  formKey.endsWith(FORM_KEY_SUFFIX)
    ? formKey.slice(0, -FORM_KEY_SUFFIX.length)
    : formKey;

/**
 * Given the `name` of a custom property, returns the path stored inside
 * the full form value object.
 *
 * The extension fields live at the top-level key `'extensionFormValues'`
 * rather than nested under `'extension'` because:
 *  - `extension` is reserved for the serialized API payload.
 *  - The raw form values often need per-type serialization before they
 *    can be submitted (e.g. converting a Luxon DateTime to a Unix
 *    timestamp). Separating the raw values lets the serializer run once
 *    on submit without re-reading the form.
 */
export const getExtensionPropertyName = (propertyName: string): string =>
  `extensionFormValues.${getExtensionFormKey(propertyName)}`;

export type ExtensionFieldKind =
  | 'text'
  | 'email'
  | 'duration'
  | 'number'
  | 'timestamp'
  | 'date'
  | 'dateTime'
  | 'time'
  | 'enum'
  | 'enumMultiSelect'
  | 'hyperlink'
  | 'markdown'
  | 'sqlQuery'
  | 'reference'
  | 'referenceList'
  | 'timeInterval'
  | 'table'
  | 'unknown';

/**
 * Maps a custom-property type name (as returned by the API's
 * `propertyType.name` field) to a simplified `ExtensionFieldKind` string
 * that the form-field renderer can switch on.
 */
export const getExtensionFieldKind = (
  typeName: string | undefined
): ExtensionFieldKind => {
  switch (typeName) {
    case 'string':
      return 'text';
    case 'email':
      return 'email';
    case 'duration':
      return 'duration';
    case 'integer':
    case 'number':
      return 'number';
    case 'timestamp':
      return 'timestamp';
    case 'date-cp':
      return 'date';
    case 'dateTime-cp':
      return 'dateTime';
    case 'time-cp':
      return 'time';
    case 'enum': {
      return 'enum';
    }
    case 'enumMultiSelect':
      return 'enumMultiSelect';
    case 'map':
    case 'hyperlink':
      return 'hyperlink';
    case 'markdown':
      return 'markdown';
    case 'sqlQuery':
      return 'sqlQuery';
    case 'entityReference':
      return 'reference';
    case 'entityReferenceList':
      return 'referenceList';
    case 'timeInterval':
      return 'timeInterval';
    case 'table':
      return 'table';
    default:
      return 'unknown';
  }
};
