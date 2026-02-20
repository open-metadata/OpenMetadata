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

import { EntityType } from '../generated/tests/testDefinition';
import i18n from '../utils/i18next/LocalUtil';
import { TEST_CASE_PLATFORM_OPTION } from './profiler.constant';

export const TEST_DEFINITION_FILTERS = [
  {
    label: 'label.entity-type',
    key: 'entityType',
    options: [
      { key: EntityType.Table, label: i18n.t('label.table') },
      { key: EntityType.Column, label: i18n.t('label.column') },
    ],
  },
  {
    label: 'label.test-platform-plural',
    key: 'testPlatforms',
    options: TEST_CASE_PLATFORM_OPTION.map((item) => ({
      key: item.value,
      label: item.label,
    })),
  },
];

export const TEST_DEFINITION_DEFAULT_QUICK_FILTERS = [
  'entityType',
  'testPlatforms',
];
