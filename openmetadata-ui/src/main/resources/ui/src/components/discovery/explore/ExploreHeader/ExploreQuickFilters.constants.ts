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

import { TEST_STATUS_COLORS } from '../../../../constants/Color.constants';
import { EntityFields } from '../../../../enums/AdvancedSearch.enum';
import type { QuickFilter } from './ExploreQuickFilters.interface';
import { buildQuickFilterQuery } from './ExploreQuickFilters.utils';

export const QUICK_FILTERS: QuickFilter[] = [
  {
    labelKey: 'label.table-plural',
    dotClassName: 'tw:bg-brand-600',
    testId: 'tables',
    quickFilter: buildQuickFilterQuery(
      EntityFields.ENTITY_TYPE_KEYWORD,
      'table'
    ),
  },
  {
    labelKey: 'label.dashboard-plural',
    dotClassName: 'tw:bg-utility-purple-500',
    testId: 'dashboards',
    quickFilter: buildQuickFilterQuery(
      EntityFields.ENTITY_TYPE_KEYWORD,
      'dashboard'
    ),
  },
  {
    labelKey: 'label.tier-1',
    dotClassName: 'tw:bg-warning-600',
    testId: 'tier-1',
    quickFilter: buildQuickFilterQuery(EntityFields.TIER, 'tier.tier1'),
  },
  {
    labelKey: 'label.my-asset-plural',
    dotClassName: '',
    dotStyle: { backgroundColor: TEST_STATUS_COLORS.SUCCESS },
    testId: 'my-assets',
    quickFilterFn: (ownerName) =>
      buildQuickFilterQuery(EntityFields.OWNERS, ownerName),
  },
  {
    labelKey: 'label.recently-updated',
    dotClassName: 'tw:bg-utility-blue-light-500',
    testId: 'recently-updated',
    sort: 'updatedAt',
  },
];
