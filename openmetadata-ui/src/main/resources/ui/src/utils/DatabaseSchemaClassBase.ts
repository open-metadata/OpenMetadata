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
import { EntityTags } from 'Models';
import { PagingHandlerParams } from '../components/common/NextPrevious/NextPrevious.interface';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { Table } from '../generated/entity/data/table';
import { ThreadType } from '../generated/entity/feed/thread';
import { UsePagingInterface } from '../hooks/paging/usePaging';
import { FeedCounts } from '../interface/feed.interface';
import { getDataBaseSchemaPageBaseTabs } from './DatabaseSchemaDetailsUtils';

export interface DatabaseSchemaPageTabProps {
  feedCount: FeedCounts;
  tableData: Table[];
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
  editGlossaryTermsPermission: boolean;
  decodedDatabaseSchemaFQN: string;
  tags: any[];
  viewAllPermission: boolean;
  storedProcedureCount: number;
  databaseSchemaPermission: OperationPermission;
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
  pagingInfo: UsePagingInterface;
}

class DatabaseSchemaClassBase {
  public getDatabaseSchemaPageTabs(
    databaseSchemaTabData: DatabaseSchemaPageTabProps
  ): TabProps[] {
    return getDataBaseSchemaPageBaseTabs(databaseSchemaTabData);
  }

  public getDatabaseSchemaPageTabsIds(): EntityTabs[] {
    return [
      EntityTabs.SCHEMA,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.CUSTOM_PROPERTIES,
    ];
  }

  public getDatabaseSchemaPageDefaultLayout = (tab: EntityTabs) => {
    switch (tab) {
      case EntityTabs.SCHEMA:
        return [
          {
            h: 2,
            i: DetailPageWidgetKeys.DESCRIPTION,
            w: 6,
            x: 0,
            y: 0,
            static: false,
          },
          {
            h: 8,
            i: DetailPageWidgetKeys.TABLE_SCHEMA,
            w: 6,
            x: 0,
            y: 0,
            static: false,
          },
          {
            h: 1,
            i: DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES,
            w: 2,
            x: 6,
            y: 0,
            static: false,
          },
          {
            h: 1,
            i: DetailPageWidgetKeys.DATA_PRODUCTS,
            w: 2,
            x: 6,
            y: 1,
            static: false,
          },
          {
            h: 1,
            i: DetailPageWidgetKeys.TAGS,
            w: 2,
            x: 6,
            y: 2,
            static: false,
          },
          {
            h: 1,
            i: DetailPageWidgetKeys.GLOSSARY_TERMS,
            w: 2,
            x: 6,
            y: 3,
            static: false,
          },
          {
            h: 3,
            i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
            w: 2,
            x: 6,
            y: 4,
            static: false,
          },
        ];

      default:
        return [];
    }
  };
}

const databaseSchemaClassBase = new DatabaseSchemaClassBase();

export default databaseSchemaClassBase;
export { DatabaseSchemaClassBase };
