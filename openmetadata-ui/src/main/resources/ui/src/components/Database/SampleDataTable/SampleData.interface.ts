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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/tests/testCase';
import { ColumnsType } from '../../common/Table/Table.interface';

export type SampleDataType =
  | string
  | number
  | null
  | Record<string, unknown>
  | unknown[];

type RecordProps = Record<string, SampleDataType>;

/**
 * `name` is the column name as the source system reports it. It is kept apart
 * from `key`/`dataIndex` because those address the row record, which cannot be
 * keyed by a raw column name (see SampleDataTable.component).
 */
export type SampleDataColumn = ColumnsType<RecordProps>[number] & {
  name: string;
};

export interface SampleData {
  columns?: SampleDataColumn[];
  rows?: RecordProps[];
}

export interface SampleDataProps {
  isTableDeleted?: boolean;
  tableId: string;
  owners: EntityReference[];
  permissions: OperationPermission;
  entityType?: EntityType.TABLE | EntityType.CONTAINER;
}
