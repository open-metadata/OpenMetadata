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

import { ServicesUpdateRequest } from 'Models';
import { FormSubmitType } from '../../../../enums/form.enum';
import { ServiceCategory } from '../../../../enums/service.enum';
import { CreateIngestionPipeline } from '../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import {
  IngestionPipeline,
  PipelineType,
} from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';

export interface AddIngestionProps {
  activeIngestionStep: number;
  pipelineType: PipelineType;
  heading: string;
  ingestionAction?: string;
  status: FormSubmitType;
  data?: IngestionPipeline;
  serviceCategory: ServiceCategory;
  serviceData: ServicesUpdateRequest;
  showSuccessScreen?: boolean;
  showDeployButton?: boolean;
  setActiveIngestionStep: (step: number) => void;
  handleCancelClick: () => void;
  onAddIngestionSave?: (ingestion: CreateIngestionPipeline) => Promise<void>;
  onIngestionDeploy?: () => Promise<void>;
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
  onFocus: (fieldName: string) => void;
}
