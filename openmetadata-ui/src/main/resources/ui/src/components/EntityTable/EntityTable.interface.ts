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

import { EntityFieldThreads } from 'Models';
import { ThreadType } from '../../generated/api/feed/createThread';
import { ColumnJoins, Table } from '../../generated/entity/data/table';
import { ModifiedTableColumn } from '../../interface/dataQuality.interface';

export interface EntityTableProps {
  owner: Table['owner'];
  tableColumns: ModifiedTableColumn[];
  joins: Array<ColumnJoins>;
  columnName: string;
  hasEditAccess: boolean;
  tableConstraints: Table['tableConstraints'];
  searchText?: string;
  isReadOnly?: boolean;
  entityFqn?: string;
  entityFieldThreads?: EntityFieldThreads[];
  entityFieldTasks?: EntityFieldThreads[];
  onUpdate?: (columns: ModifiedTableColumn[]) => void;
  onThreadLinkSelect?: (value: string, threadType?: ThreadType) => void;
  onEntityFieldSelect?: (value: string) => void;
}
