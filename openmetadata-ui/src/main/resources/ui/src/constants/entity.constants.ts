/*
 *  Copyright 2022 Collate.
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

import { startCase } from 'lodash';
import i18n from '../utils/i18next/LocalUtil';
import { EntityField } from './Feeds.constants';

export const ENTITY_DELETE_STATE = {
  loading: 'initial',
  state: false,
  softDelete: true,
};

export const ENTITY_CARD_CLASS = 'h-full m-y-md';

export const STEPS_FOR_IMPORT_ENTITY = [
  {
    name: startCase(i18n.t('label.upload-csv-uppercase-file')),
    step: 1,
  },
  {
    name: startCase(i18n.t('label.preview-data')),
    step: 2,
  },
];

export const ENTITY_TASKS_TOOLTIP = {
  [EntityField.DESCRIPTION]: {
    request: i18n.t('message.request-description'),
    update: i18n.t('message.request-update-description'),
  },
  [EntityField.TAGS]: {
    request: i18n.t('label.request-tag-plural'),
    update: i18n.t('label.update-request-tag-plural'),
  },
};
