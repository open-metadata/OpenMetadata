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

import {
  EntityFieldThreadCount,
  EntityTags,
  LeafNodes,
  LineagePos,
  LoadingNodeState,
} from 'Models';
import { FeedFilter } from '../../enums/mydata.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { CreateColumnTest } from '../../generated/api/tests/createColumnTest';
import { CreateTableTest } from '../../generated/api/tests/createTableTest';
import {
  ColumnTestType,
  Table,
  TableData,
  TableJoins,
  TableType,
  TypeUsedToReturnUsageDetailsOfAnEntity,
} from '../../generated/entity/data/table';
import { Thread, ThreadType } from '../../generated/entity/feed/thread';
import { TableTest, TableTestType } from '../../generated/tests/tableTest';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  DatasetTestModeType,
  ModifiedTableColumn,
} from '../../interface/dataQuality.interface';
import { ThreadUpdatedFunc } from '../../interface/feed.interface';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import { Edge, EdgeData } from '../EntityLineage/EntityLineage.interface';

export interface DatasetDetailsProps {
  isNodeLoading: LoadingNodeState;
  lineageLeafNodes: LeafNodes;
  version?: string;
  entityId?: string;
  joins: TableJoins;
  tableType: TableType;
  usageSummary: TypeUsedToReturnUsageDetailsOfAnEntity;
  tableDetails: Table;
  entityName: string;
  datasetFQN: string;
  dataModel?: Table['dataModel'];
  activeTab: number;
  owner: EntityReference;
  description: string;
  tableProfile: Table['tableProfile'];
  tableQueries: Table['tableQueries'];
  columns: ModifiedTableColumn[];
  tier: TagLabel;
  sampleData: TableData;
  entityLineage: EntityLineage;
  followers: Array<EntityReference>;
  tableTags: Array<EntityTags>;
  slashedTableName: TitleBreadcrumbProps['titleLinks'];
  entityThread: Thread[];
  deleted?: boolean;
  isLineageLoading?: boolean;
  isSampleDataLoading?: boolean;
  isQueriesLoading?: boolean;
  isentityThreadLoading: boolean;
  feedCount: number;
  entityFieldThreadCount: EntityFieldThreadCount[];
  entityFieldTaskCount: EntityFieldThreadCount[];
  testMode: DatasetTestModeType;
  tableTestCase: TableTest[];
  showTestForm: boolean;
  selectedColumn: string;
  paging: Paging;
  qualityTestFormHandler: (
    tabValue: number,
    testMode?: DatasetTestModeType,
    columnName?: string
  ) => void;
  handleShowTestForm: (value: boolean) => void;
  handleTestModeChange: (mode: DatasetTestModeType) => void;
  createThread: (data: CreateThread) => void;
  setActiveTabHandler: (value: number) => void;
  followTableHandler: () => void;
  unfollowTableHandler: () => void;
  settingsUpdateHandler: (updatedTable: Table) => Promise<void>;
  columnsUpdateHandler: (updatedTable: Table) => void;
  descriptionUpdateHandler: (updatedTable: Table) => void;
  tagUpdateHandler: (updatedTable: Table) => void;
  versionHandler: () => void;
  handleSelectedColumn: (value: string | undefined) => void;
  loadNodeHandler: (node: EntityReference, pos: LineagePos) => void;
  addLineageHandler: (edge: Edge) => Promise<void>;
  removeLineageHandler: (data: EdgeData) => void;
  entityLineageHandler: (lineage: EntityLineage) => void;
  postFeedHandler: (value: string, id: string) => void;
  handleAddTableTestCase: (data: CreateTableTest) => void;
  handleAddColumnTestCase: (data: CreateColumnTest) => void;
  handleRemoveTableTest: (testType: TableTestType) => void;
  handleRemoveColumnTest: (
    columnName: string,
    testType: ColumnTestType
  ) => void;
  deletePostHandler: (threadId: string, postId: string) => void;
  fetchFeedHandler: (
    after?: string,
    feedType?: FeedFilter,
    threadType?: ThreadType
  ) => void;
  handleExtentionUpdate: (updatedTable: Table) => void;
  updateThreadHandler: ThreadUpdatedFunc;
}
