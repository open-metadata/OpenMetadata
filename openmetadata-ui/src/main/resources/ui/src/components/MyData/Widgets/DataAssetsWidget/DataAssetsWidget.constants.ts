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
import { t } from '../../../../utils/i18next/LocalUtil';

export const DATA_ASSETS_SORT_BY_KEYS = {
  A_TO_Z: 'a-to-z',
  Z_TO_A: 'z-to-a',
  HIGH_TO_LOW: 'high-to-low',
  LOW_TO_HIGH: 'low-to-high',
};

export const DATA_ASSETS_SORT_BY_OPTIONS = [
  {
    key: DATA_ASSETS_SORT_BY_KEYS.A_TO_Z,
    label: t('label.a-to-z'),
  },
  {
    key: DATA_ASSETS_SORT_BY_KEYS.Z_TO_A,
    label: t('label.z-to-a'),
  },
  {
    key: DATA_ASSETS_SORT_BY_KEYS.HIGH_TO_LOW,
    label: t('label.high-to-low'),
  },
  {
    key: DATA_ASSETS_SORT_BY_KEYS.LOW_TO_HIGH,
    label: t('label.low-to-high'),
  },
];
