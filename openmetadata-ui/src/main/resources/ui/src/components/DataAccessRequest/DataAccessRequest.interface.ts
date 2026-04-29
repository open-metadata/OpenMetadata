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

import { EntityType } from '../../enums/entity.enum';
import {
  DataAccessPermission,
  DataAccessType,
  Task,
} from '../../rest/tasksAPI';

export interface DataAccessRequestFormValues {
  accessType: DataAccessType;
  columns: string[];
  duration: string;
  reason: string;
  requestedAccess: DataAccessPermission;
  ticketId?: string;
}

export interface DataAccessRequestDrawerProps {
  open: boolean;
  entityFqn: string;
  entityType: EntityType;
  entityDisplayName: string;
  availableColumns?: string[];
  reviewers?: string[];
  onClose: () => void;
  onCreated?: (task: Task) => void;
}

export interface DataAccessRequestWidgetProps {
  entityFqn: string;
  entityType: EntityType;
  entityDisplayName: string;
  availableColumns?: string[];
  reviewers?: string[];
  canRequestAccess?: boolean;
}

export interface DataAccessRequestDetailDrawerProps {
  taskId?: string;
  open: boolean;
  onClose: () => void;
  onResolved?: (task: Task) => void;
}

export type DataAccessTab = 'my-requests' | 'my-approvals';
