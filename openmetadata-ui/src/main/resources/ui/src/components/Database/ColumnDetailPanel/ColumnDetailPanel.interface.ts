/*
 *  Copyright 2025 Collate.
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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { Task } from '../../../generated/entity/data/pipeline';
import { Column, TableConstraint } from '../../../generated/entity/data/table';
import { TagLabel } from '../../../generated/type/tagLabel';

export type ColumnOrTask = Column | Task;

export interface ColumnEditPermission {
  tags?: boolean;
  glossaryTerms?: boolean;
  description?: boolean;
  viewAllPermission?: boolean;
  customProperties?: boolean;
}

export interface ColumnViewPermission {
  customProperties?: boolean;
}

export interface ColumnFieldUpdate {
  description?: string;
  tags?: TagLabel[];
}

export interface ColumnDetailPanelProps<T extends ColumnOrTask = Column> {
  column: T | null;
  tableFqn?: string;
  isOpen: boolean;
  onClose: () => void;
  onColumnUpdate?: (updatedColumn: T) => void;
  updateColumnDescription?: (fqn: string, description: string) => Promise<T>;
  updateColumnTags?: (fqn: string, tags: TagLabel[]) => Promise<T>;
  onColumnFieldUpdate?: (
    fqn: string,
    update: ColumnFieldUpdate
  ) => Promise<T | undefined>;
  hasEditPermission?: ColumnEditPermission;
  hasViewPermission?: ColumnViewPermission;
  permissions?: OperationPermission;
  deleted?: boolean;
  allColumns?: T[];
  onNavigate?: (column: T, index?: number) => void;
  tableConstraints?: TableConstraint[];
  entityType?: EntityType;
}

export interface TestCaseStatusCounts {
  success: number;
  failed: number;
  aborted: number;
  total: number;
}
