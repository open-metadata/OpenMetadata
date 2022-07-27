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

import { LoadingState } from 'Models';
import { FilterPatternEnum } from '../../enums/filterPattern.enum';
import { FormSubmitType } from '../../enums/form.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateIngestionPipeline } from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { FilterPattern, IngestionPipeline, PipelineType } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { DataObj } from '../../interface/service.interface';

export interface AddIngestionProps {
  activeIngestionStep: number;
  isAirflowSetup: boolean;
  pipelineType: PipelineType;
  heading: string;
  ingestionAction?: string;
  status: FormSubmitType;
  data?: IngestionPipeline;
  serviceCategory: ServiceCategory;
  serviceData: DataObj;
  showSuccessScreen?: boolean;
  showDeployButton?: boolean;
  setActiveIngestionStep: (step: number) => void;
  handleCancelClick: () => void;
  onAddIngestionSave?: (ingestion: CreateIngestionPipeline) => Promise<void>;
  onIngestionDeploy?: () => Promise<void>;
  onAirflowStatusCheck: () => Promise<void>;
  onUpdateIngestion?: (
    data: IngestionPipeline,
    oldData: IngestionPipeline,
    id: string,
    displayName: string,
    triggerIngestion?: boolean
  ) => Promise<void>;
  onSuccessSave?: () => void;
  isIngestionDeployed?: boolean;
  isIngestionCreated?: boolean;
  ingestionProgress?: number;
  handleViewServiceClick?: () => void;
}

export interface ConfigureIngestionProps {
  ingestionName: string;
  description?: string;
  databaseServiceName: string;
  serviceCategory: ServiceCategory;
  databaseFilterPattern: FilterPattern;
  dashboardFilterPattern: FilterPattern;
  schemaFilterPattern: FilterPattern;
  tableFilterPattern: FilterPattern;
  topicFilterPattern: FilterPattern;
  chartFilterPattern: FilterPattern;
  pipelineFilterPattern: FilterPattern;
  fqnFilterPattern: FilterPattern;
  includeLineage: boolean;
  includeView: boolean;
  includeTags: boolean;
  markDeletedTables?: boolean;
  enableDebugLog: boolean;
  profileSample?: number;
  ingestSampleData: boolean;
  pipelineType: PipelineType;
  showDatabaseFilter: boolean;
  showDashboardFilter: boolean;
  showSchemaFilter: boolean;
  showTableFilter: boolean;
  showTopicFilter: boolean;
  showChartFilter: boolean;
  showPipelineFilter: boolean;
  showFqnFilter: boolean;
  queryLogDuration: number;
  stageFileLocation: string;
  resultLimit: number;
  handleIngestionName: (value: string) => void;
  handleDatasetServiceName: (value: string) => void;
  handleDescription?: (value: string) => void;
  handleIncludeLineage: () => void;
  handleIncludeView: () => void;
  handleIncludeTags: () => void;
  handleMarkDeletedTables?: () => void;
  handleEnableDebugLog: () => void;
  handleIngestSampleData: () => void;
  getIncludeValue: (value: string[], type: FilterPatternEnum) => void;
  getExcludeValue: (value: string[], type: FilterPatternEnum) => void;
  handleShowFilter: (value: boolean, type: FilterPatternEnum) => void;
  handleProfileSample: (value: number) => void;
  handleQueryLogDuration: (value: number) => void;
  handleStageFileLocation: (value: string) => void;
  handleResultLimit: (value: number) => void;
  onCancel: () => void;
  onNext: () => void;
}

export type ScheduleIntervalProps = {
  status: LoadingState;
  repeatFrequency: string;
  handleRepeatFrequencyChange: (value: string) => void;
  submitButtonLabel: string;
  onBack: () => void;
  onDeploy: () => void;
};
