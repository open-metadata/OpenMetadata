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

export const NAME_FIELD_RULES: Rule[] = [
  {
    required: true,
    message: i18n.t('label.field-required', {
      field: i18n.t('label.name'),
    }),
  },
  {
    min: 1,
    max: 128,
    message: i18n.t('message.entity-size-in-between', {
      entity: i18n.t('label.name'),
      min: 1,
      max: 128,
    }),
  },
  {
    pattern: ENTITY_NAME_REGEX,
    message: i18n.t('message.entity-name-validation'),
  },
];

export const DISPLAY_NAME_FIELD_RULES: Rule[] = [
  {
    min: 1,
    max: 128,
    message: i18n.t('message.entity-size-in-between', {
      entity: i18n.t('label.display-name'),
      min: 1,
      max: 128,
    }),
  },
];

const NAME_SIZE_MESSAGE = String(
  i18n.t('message.entity-size-in-between', {
    entity: i18n.t('label.name'),
    min: 1,
    max: 128,
  })
);

/** react-hook-form counterpart of NAME_FIELD_RULES. */
export const NAME_FIELD_REGISTER_RULES = {
  required: String(
    i18n.t('label.field-required', { field: i18n.t('label.name') })
  ),
  maxLength: { value: 128, message: NAME_SIZE_MESSAGE },
  pattern: {
    value: ENTITY_NAME_REGEX,
    message: String(i18n.t('message.entity-name-validation')),
  },
};

/** react-hook-form counterpart of DISPLAY_NAME_FIELD_RULES. */
export const DISPLAY_NAME_FIELD_REGISTER_RULES = {
  maxLength: {
    value: 128,
    message: String(
      i18n.t('message.entity-size-in-between', {
        entity: i18n.t('label.display-name'),
        min: 1,
        max: 128,
      })
    ),
  },
};
