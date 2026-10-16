/*
 *  Copyright 2024 Collate.
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

import { Rule } from 'antd/lib/form';

import i18n from '../utils/i18next/LocalUtil';
import { ENTITY_NAME_REGEX } from './regex.constants';

const ENTITY_NAME_MAX_LENGTH = 128;

const sizeMessage = (labelKey: string) =>
  String(
    i18n.t('message.entity-size-in-between', {
      entity: i18n.t(labelKey),
      min: 1,
      max: ENTITY_NAME_MAX_LENGTH,
    })
  );

const NAME_REQUIRED_MESSAGE = String(
  i18n.t('label.field-required', { field: i18n.t('label.name') })
);
const NAME_SIZE_MESSAGE = sizeMessage('label.name');
const NAME_PATTERN_MESSAGE = String(i18n.t('message.entity-name-validation'));
const DISPLAY_NAME_SIZE_MESSAGE = sizeMessage('label.display-name');

// TODO(open-metadata/openmetadata-collate#6893): drop the antd `Rule[]` shapes
// once the last antd forms (alerts, custom metrics) move to react-hook-form.
export const NAME_FIELD_RULES: Rule[] = [
  { required: true, message: NAME_REQUIRED_MESSAGE },
  { min: 1, max: ENTITY_NAME_MAX_LENGTH, message: NAME_SIZE_MESSAGE },
  { pattern: ENTITY_NAME_REGEX, message: NAME_PATTERN_MESSAGE },
];

export const DISPLAY_NAME_FIELD_RULES: Rule[] = [
  { min: 1, max: ENTITY_NAME_MAX_LENGTH, message: DISPLAY_NAME_SIZE_MESSAGE },
];

/** react-hook-form counterpart of NAME_FIELD_RULES. */
export const NAME_FIELD_REGISTER_RULES = {
  required: NAME_REQUIRED_MESSAGE,
  maxLength: { value: ENTITY_NAME_MAX_LENGTH, message: NAME_SIZE_MESSAGE },
  pattern: { value: ENTITY_NAME_REGEX, message: NAME_PATTERN_MESSAGE },
};

/** react-hook-form counterpart of DISPLAY_NAME_FIELD_RULES. */
export const DISPLAY_NAME_FIELD_REGISTER_RULES = {
  maxLength: {
    value: ENTITY_NAME_MAX_LENGTH,
    message: DISPLAY_NAME_SIZE_MESSAGE,
  },
};

/**
 * Spread onto a creatable `Autocomplete` that has no suggestion list
 * (`hideDropdown`). An open react-aria combobox aria-hides the rest of the
 * page, so a field with nothing to list must not open: it never opens on focus
 * or typing, and react-stately closes an empty list that a click or arrow key
 * opened. Without this, a fast type → Enter → move-on could leave it open.
 */
export const TAG_INPUT_COMBOBOX_PROPS = {
  allowsEmptyCollection: false,
  menuTrigger: 'manual',
} as const;
