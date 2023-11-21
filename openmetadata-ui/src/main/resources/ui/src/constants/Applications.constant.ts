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
import { t } from 'i18next';
import { StepperStepType } from 'Models';
import { SearchIndex } from '../enums/search.enum';

export const STEPS_FOR_APP_INSTALL: Array<StepperStepType> = [
  {
    name: t('label.detail-plural'),
    step: 1,
  },
  { name: t('label.configure'), step: 2 },
  { name: t('label.schedule'), step: 3 },
];

export const APPLICATION_UI_SCHEMA = {
  databases: {
    'ui:widget': 'autoComplete',
    'ui:options': {
      autoCompleteType: SearchIndex.DATABASE,
    },
  },
  owner: {
    'ui:widget': 'autoComplete',
    'ui:options': {
      autoCompleteType: SearchIndex.USER,
    },
  },
};
