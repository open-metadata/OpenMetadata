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
import { EntityType } from '../../../enums/entity.enum';
import { Field as APIEndpointField } from '../../../generated/entity/data/apiEndpoint';
import { MlFeature } from '../../../generated/entity/data/mlmodel';
import { Task } from '../../../generated/entity/data/pipeline';
import { SearchIndexField } from '../../../generated/entity/data/searchIndex';
import { Column, TableConstraint } from '../../../generated/entity/data/table';
import { Field as TopicField } from '../../../generated/entity/data/topic';
import { ColumnFieldUpdate } from '../../../utils/ColumnUpdateUtils.interface';

// Re-export ColumnFieldUpdate from interface for backward compatibility
export type { ColumnFieldUpdate } from '../../../utils/ColumnUpdateUtils.interface';

// Union type for all column-like entities that can be displayed in the detail panel
export type ColumnOrTask =
  | Column
  | Task
  | APIEndpointField
  | TopicField
  | SearchIndexField
  | MlFeature;

export interface ColumnDetailPanelProps<T extends ColumnOrTask = Column> {
  column: T | null;
  tableFqn?: string;
  isOpen: boolean;
  onClose: () => void;
  onColumnFieldUpdate?: (
    fqn: string,
    update: ColumnFieldUpdate,
    skipGlobalError?: boolean
  ) => Promise<T | undefined>;
  deleted?: boolean;
  allColumns?: T[];
  onNavigate?: (column: T, index?: number) => void;
  tableConstraints?: TableConstraint[];
  entityType: EntityType;
  onColumnsUpdate?: (columns: Column[]) => void;
}

export interface TestCaseStatusCounts {
  success: number;
  failed: number;
  aborted: number;
  total: number;
}
