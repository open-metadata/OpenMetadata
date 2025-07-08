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
