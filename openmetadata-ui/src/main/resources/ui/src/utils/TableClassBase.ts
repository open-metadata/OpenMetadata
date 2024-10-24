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
import { isEmpty } from 'lodash';
import { ReactNode } from 'react';
import { UpdatedColumnFieldData } from '../components/Database/SchemaTable/SchemaTable.interface';
import { EntityName } from '../components/Modals/EntityNameModal/EntityNameModal.interface';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs } from '../enums/entity.enum';
import { Column, Table } from '../generated/entity/data/table';
import { TestSummary } from '../generated/tests/testCase';
import { FeedCounts } from '../interface/feed.interface';
import {
  getTableConstraintsComponent,
  getTableDetailPageBaseTabs,
} from './TableUtils';

export interface TableDetailPageTabProps {
  queryCount: number;
  isTourOpen: boolean;
  activeTab: EntityTabs;
  totalFeedCount: number;
  schemaTab: JSX.Element;
  isViewTableType: boolean;
  viewAllPermission: boolean;
  viewQueriesPermission: boolean;
  editLineagePermission: boolean;
  viewProfilerPermission: boolean;
  viewSampleDataPermission: boolean;
  tablePermissions: OperationPermission;
  editCustomAttributePermission: boolean;
  deleted?: boolean;
  tableDetails?: Table;
  testCaseSummary?: TestSummary;
  getEntityFeedCount: () => void;
  fetchTableDetails: () => Promise<void>;
  onExtensionUpdate: (updatedData: Table) => Promise<void>;
  handleFeedCount: (data: FeedCounts) => void;
}

class TableClassBase {
  public getTableDetailPageTabs(
    tableDetailsPageProps: TableDetailPageTabProps
  ) {
    return getTableDetailPageBaseTabs(tableDetailsPageProps);
  }

  public getAdditionalFormFieldForSchemaTableColumn(): ReactNode | null {
    return null;
  }

  public getUpdatedSchemaTableColumnData({
    tableCols,
    columnData,
    updatedFormData,
    updateColumnFields,
  }: {
    columnData: Column;
    tableCols: Column[];
    updatedFormData: EntityName;
    updateColumnFields: (data: UpdatedColumnFieldData) => void;
  }) {
    updateColumnFields({
      fqn: columnData.fullyQualifiedName ?? '',
      value: isEmpty(updatedFormData.displayName)
        ? undefined
        : updatedFormData.displayName,
      field: 'displayName',
      columns: tableCols,
    });
  }

  public getAfterSlotComponents(tableDetails?: Table): JSX.Element {
    return getTableConstraintsComponent(tableDetails?.tableConstraints);
  }
}

const tableClassBase = new TableClassBase();

export default tableClassBase;
export { TableClassBase };
