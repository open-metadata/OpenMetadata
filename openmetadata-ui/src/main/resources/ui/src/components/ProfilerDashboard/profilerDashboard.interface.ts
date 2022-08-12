/*
 *  Copyright 2022 Collate
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

import { Table, TableProfile } from '../../generated/entity/data/table';

export interface ProfilerDashboardProps {
  onTableChange: (table: Table) => void;
  table: Table;
  profilerData: TableProfile[];
}

export enum ProfilerDashboardTab {
  SUMMERY = 'Summery',
  PROFILER = 'Profiler',
  DATA_QUALITY = 'Data Quality',
}

export enum TimeRangeOptions {
  latest = 'Latest',
  last7days = 'Last 7 days',
  last14days = 'Last 14 days',
  last30days = 'Last 30 days',
}
