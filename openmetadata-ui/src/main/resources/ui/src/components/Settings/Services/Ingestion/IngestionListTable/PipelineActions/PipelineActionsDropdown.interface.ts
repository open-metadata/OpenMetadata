/*
 *  Copyright 2024 Collate.
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

import { ButtonProps } from 'antd';
import { IngestionServicePermission } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { IngestionPipeline } from '../../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { SelectedRowDetails } from '../../ingestion.interface';

export interface PipelineActionsDropdownProps {
  ingestion: IngestionPipeline;
  serviceName?: string;
  serviceCategory?: string;
  triggerIngestion?: (id: string, displayName: string) => Promise<void>;
  deployIngestion?: (id: string, displayName: string) => Promise<void>;
  handleEditClick: ((fqn: string) => void) | undefined;
  ingestionPipelinePermissions?: IngestionServicePermission;
  handleDeleteSelection?: (row: SelectedRowDetails) => void;
  handleIsConfirmationModalOpen: (value: boolean) => void;
  onIngestionWorkflowsUpdate?: () => void;
  moreActionButtonProps?: ButtonProps;
}
