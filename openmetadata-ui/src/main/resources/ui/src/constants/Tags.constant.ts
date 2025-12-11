/*
 *  Copyright 2023 Collate.
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
import { NAME_LENGTH_REGEX, TAG_NAME_REGEX } from './regex.constants';

export const DEFAULT_FORM_VALUE = {
  name: '',
  displayName: '',
  description: '',
};

export const MUI_NAME_FIELD_RULES: Rule[] = [
  {
    required: true,
    message: i18n.t('label.field-required', {
      field: i18n.t('label.name'),
    }),
  },
  {
    pattern: NAME_LENGTH_REGEX,
    message: i18n.t('message.entity-size-in-between', {
      entity: i18n.t('label.name'),
      min: 2,
      max: 64,
    }),
  },
  {
    pattern: TAG_NAME_REGEX,
    message: i18n.t('message.entity-name-validation'),
  },
];
