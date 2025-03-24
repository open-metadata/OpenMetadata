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

import { DateRangeObject } from 'Models';
import { ReactNode } from 'react';
import {
  SearchDropdownOption,
  SearchDropdownProps,
} from '../../components/SearchDropdown/SearchDropdown.interface';
import { SystemChartType } from '../../enums/DataInsight.enum';
import { Kpi } from '../../generated/dataInsight/kpi/kpi';
import { Tag } from '../../generated/entity/classification/tag';
import { ChartFilter } from '../../interface/data-insight.interface';
import { DataInsightCustomChartResult } from '../../rest/DataInsightAPI';

export type TeamStateType = {
  defaultOptions: SearchDropdownOption[];
  selectedOptions: SearchDropdownOption[];
  options: SearchDropdownOption[];
};
export type TierStateType = Omit<TeamStateType, 'defaultOptions'>;

export interface DataInsightProviderProps {
  children: ReactNode;
}

export interface DataInsightContextType {
  teamFilter: Omit<SearchDropdownProps, 'label' | 'searchKey'>;
  tierFilter: Omit<SearchDropdownProps, 'label' | 'searchKey'>;
  selectedDaysFilter: number;
  chartFilter: ChartFilter;
  entitiesSummary: Record<SystemChartType, DataInsightCustomChartResult>;
  updateEntitySummary: (
    data: Record<SystemChartType, DataInsightCustomChartResult>
  ) => void;
  onChartFilterChange: (value: DateRangeObject, days?: number) => void;
  kpi: {
    isLoading: boolean;
    data: Kpi[];
  };
  tierTag: {
    tags: Tag[];
    isLoading: boolean;
  };
}
