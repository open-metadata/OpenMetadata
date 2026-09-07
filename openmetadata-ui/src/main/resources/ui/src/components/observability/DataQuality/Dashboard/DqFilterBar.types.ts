/*
 *  Copyright 2026 Collate.
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
import { UseDataQualityDashboardFiltersReturn } from '../../../DataQuality/DataQualityDashboard/useDataQualityDashboardFilters';

/**
 * The app-mode filter bar is purely presentational — it renders the shared
 * descriptors produced by `useDataQualityDashboardFilters` (the same source the
 * classic dashboard uses) so both modes stay in lockstep. The owning dashboard
 * holds the single hook instance and passes its output down.
 */
export type DqFilterBarProps = Pick<
  UseDataQualityDashboardFiltersReturn,
  | 'filters'
  | 'dateRange'
  | 'onDateRangeChange'
  | 'showFilterBar'
  | 'hasVisibleFilters'
  | 'hasActiveFilters'
  | 'clearAll'
>;
