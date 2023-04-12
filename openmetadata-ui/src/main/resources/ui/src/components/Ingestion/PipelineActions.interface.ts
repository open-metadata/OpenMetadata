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

import { ServiceCategory } from '../../enums/service.enum';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { IngestionServicePermission } from '../PermissionProvider/PermissionProvider.interface';
import { SelectedRowDetails } from './ingestion.interface';

export interface PipelineActionsProps {
  record: IngestionPipeline;
  servicePermission?: IngestionServicePermission;
  isRequiredDetailsAvailable: boolean;
  serviceCategory: ServiceCategory;
  serviceName: string;
  deleteSelection: SelectedRowDetails;
  deployIngestion: (id: string) => Promise<void>;
  triggerIngestion: (id: string, displayName: string) => Promise<void>;
  handleDeleteSelection: (row: SelectedRowDetails) => void;
  handleEnableDisableIngestion: (id: string) => void;
  handleIsConfirmationModalOpen: (value: boolean) => void;
  onIngestionWorkflowsUpdate: () => void;
}
