/*
 *  Copyright 2021 Collate
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

import { FilterPatternEnum } from '../../enums/filterPattern.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateIngestionPipeline } from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { DataObj } from '../../interface/service.interface';

export interface AddIngestionProps {
  serviceCategory: ServiceCategory;
  serviceData: DataObj;
  handleAddIngestion: (value: boolean) => void;
  onAddIngestionSave: (ingestion: CreateIngestionPipeline) => Promise<void>;
  handleViewServiceClick: () => void;
}

export type PatternType = {
  include: Array<string>;
  exclude: Array<string>;
};

export interface ConfigureIngestionProps {
  ingestionName: string;
  serviceCategory: ServiceCategory;
  dashboardFilterPattern: PatternType;
  schemaFilterPattern: PatternType;
  tableFilterPattern: PatternType;
  topicFilterPattern: PatternType;
  chartFilterPattern: PatternType;
  includeView: boolean;
  enableDataProfiler: boolean;
  ingestSampleData: boolean;
  showDashboardFilter: boolean;
  showSchemaFilter: boolean;
  showTableFilter: boolean;
  showTopicFilter: boolean;
  showChartFilter: boolean;
  handleIncludeView: () => void;
  handleEnableDataProfiler: () => void;
  handleIngestSampleData: () => void;
  getIncludeValue: (value: string[], type: FilterPatternEnum) => void;
  getExcludeValue: (value: string[], type: FilterPatternEnum) => void;
  handleShowFilter: (value: boolean, type: FilterPatternEnum) => void;
  onCancel: () => void;
  onNext: () => void;
}

export type ScheduleIntervalProps = {
  repeatFrequency: string;
  handleRepeatFrequencyChange: (value: string) => void;
  startDate: string;
  handleStartDateChange: (value: string) => void;
  endDate: string;
  handleEndDateChange: (value: string) => void;
  onBack: () => void;
  onDeloy: () => void;
};
