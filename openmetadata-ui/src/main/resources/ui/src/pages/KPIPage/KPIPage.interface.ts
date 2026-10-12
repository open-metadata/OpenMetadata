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
import { DateTime } from 'luxon';
import { KpiTargetType } from '../../generated/api/dataInsight/kpi/createKpiRequest';
import { KPIChartType } from '../../utils/KPI/KPIUtils';

export interface KPIFormValues {
  chartType: KPIChartType;
  displayName?: string;
  description?: string;
  metricType: KpiTargetType;
  targetValue: number | null;
  startDate: DateTime | null;
  endDate: DateTime | null;
}
