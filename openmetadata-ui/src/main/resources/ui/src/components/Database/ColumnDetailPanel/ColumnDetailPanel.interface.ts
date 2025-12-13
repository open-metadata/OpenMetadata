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
import { Column, TableConstraint } from '../../../generated/entity/data/table';

export interface ColumnDetailPanelProps {
  column: Column | null;
  tableFqn: string;
  isOpen: boolean;
  onClose: () => void;
  onColumnUpdate?: (updatedColumn: Column) => void;
  hasEditPermission?: {
    tags?: boolean;
    glossaryTerms?: boolean;
    description?: boolean;
    viewAllPermission?: boolean;
    customProperties?: boolean;
  };
  allColumns?: Column[];
  currentColumnIndex?: number;
  onNavigate?: (column: Column, index: number) => void;
  tableConstraints?: TableConstraint[];
}

export interface TestCaseStatusCounts {
  success: number;
  failed: number;
  aborted: number;
  total: number;
}
