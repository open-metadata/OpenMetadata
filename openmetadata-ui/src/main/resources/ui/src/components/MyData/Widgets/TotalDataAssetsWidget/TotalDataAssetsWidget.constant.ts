/*
 *  Copyright 2025 Collate.
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
import { t } from '../../../../utils/i18next/LocalUtil';

export const DATA_ASSETS_SORT_BY_KEYS = {
  LAST_7_DAYS: 'last_7_days',
  LAST_14_DAYS: 'last_14_days',
  LAST_30_DAYS: 'last_30_days',
};

export const DATA_ASSETS_SORT_BY_OPTIONS = [
  {
    key: DATA_ASSETS_SORT_BY_KEYS.LAST_7_DAYS,
    label: t('label.last-7-days'),
  },
  {
    key: DATA_ASSETS_SORT_BY_KEYS.LAST_14_DAYS,
    label: t('label.last-14-days'),
  },
  {
    key: DATA_ASSETS_SORT_BY_KEYS.LAST_30_DAYS,
    label: t('label.last-30-days'),
  },
];
