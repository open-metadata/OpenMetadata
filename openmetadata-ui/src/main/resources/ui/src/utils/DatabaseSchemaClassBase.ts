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
import { TabsProps } from 'antd';
import { EntityTags, PagingResponse } from 'Models';
import { PagingHandlerParams } from '../components/common/NextPrevious/NextPrevious.interface';
import { EntityTabs } from '../enums/entity.enum';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { Table } from '../generated/entity/data/table';
import { ThreadType } from '../generated/entity/feed/thread';
import { FeedCounts } from '../interface/feed.interface';
import { getDataBaseSchemaPageBaseTabs } from './DatabaseSchemaDetailsUtils';

export interface DatabaseSchemaPageTabProps {
  feedCount: FeedCounts;
  tableData: PagingResponse<Table[]>;
  activeTab: EntityTabs;
  currentTablesPage: number;
  databaseSchema: DatabaseSchema;
  description: string;
  editDescriptionPermission: boolean;
  isEdit: boolean;
  showDeletedTables: boolean;
  tableDataLoading: boolean;
  editCustomAttributePermission: boolean;
  editTagsPermission: boolean;
  decodedDatabaseSchemaFQN: string;
  tags: any[];
  viewAllPermission: boolean;
  storedProcedureCount: number;
  handleExtensionUpdate: (schema: DatabaseSchema) => Promise<void>;
  handleTagSelection: (selectedTags: EntityTags[]) => Promise<void>;
  onThreadLinkSelect: (link: string, threadType?: ThreadType) => void;
  tablePaginationHandler: ({
    cursorType,
    currentPage,
  }: PagingHandlerParams) => void;
  onEditCancel: () => void;
  onDescriptionEdit: () => void;
  onDescriptionUpdate: (updatedHTML: string) => Promise<void>;
  handleShowDeletedTables: (value: boolean) => void;
  getEntityFeedCount: () => void;
  fetchDatabaseSchemaDetails: () => Promise<void>;
  handleFeedCount: (data: FeedCounts) => void;
}

class DatabaseSchemaClassBase {
  public getDatabaseSchemaPageTabs(
    databaseSchemaTabData: DatabaseSchemaPageTabProps
  ): TabsProps['items'] {
    return getDataBaseSchemaPageBaseTabs(databaseSchemaTabData);
  }
}

const databaseSchemaClassBase = new DatabaseSchemaClassBase();

export default databaseSchemaClassBase;
export { DatabaseSchemaClassBase };
