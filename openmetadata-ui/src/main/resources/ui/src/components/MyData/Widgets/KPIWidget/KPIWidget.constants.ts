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

export const KPI_WIDGET_Y_AXIS_TICKS = [0, 9, 18, 27, 36];

export const KPI_SORT_BY_KEYS = {
  MONTHLY: 'monthly',
  WEEKLY: 'weekly',
};

export const KPI_SORT_BY_OPTIONS = [
  {
    key: KPI_SORT_BY_KEYS.MONTHLY,
    label: t('label.monthly'),
  },
  {
    key: KPI_SORT_BY_KEYS.WEEKLY,
    label: t('label.weekly'),
  },
];
