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
  EntityThread,
  LeafNodes,
  LineagePos,
  LoadingNodeState,
} from 'Models';
import { ColumnTestType } from '../../enums/columnTest.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { CreateTableTest } from '../../generated/api/tests/createTableTest';
import {
  EntityReference,
  Table,
  TableData,
  TableJoins,
  TypeUsedToReturnUsageDetailsOfAnEntity,
} from '../../generated/entity/data/table';
import { User } from '../../generated/entity/teams/user';
import { TableTest, TableTestType } from '../../generated/tests/tableTest';
import { EntityLineage } from '../../generated/type/entityLineage';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  ColumnTest,
  DatasetTestModeType,
  ModifiedTableColumn,
} from '../../interface/dataQuality.interface';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import { Edge, EdgeData } from '../EntityLineage/EntityLineage.interface';

export interface DatasetOwner extends EntityReference {
  displayName?: string;
}

export interface DatasetDetailsProps {
  isNodeLoading: LoadingNodeState;
  lineageLeafNodes: LeafNodes;
  version?: string;
  joins: TableJoins;
  usageSummary: TypeUsedToReturnUsageDetailsOfAnEntity;
  users: Array<User>;
  tableDetails: Table;
  entityName: string;
  datasetFQN: string;
  dataModel?: Table['dataModel'];
  activeTab: number;
  owner: DatasetOwner;
  description: string;
  tableProfile: Table['tableProfile'];
  tableQueries: Table['tableQueries'];
  columns: ModifiedTableColumn[];
  tier: TagLabel;
  sampleData: TableData;
  entityLineage: EntityLineage;
  followers: Array<User>;
  tableTags: Array<EntityTags>;
  slashedTableName: TitleBreadcrumbProps['titleLinks'];
  entityThread: EntityThread[];
  deleted?: boolean;
  isLineageLoading?: boolean;
  isSampleDataLoading?: boolean;
  isQueriesLoading?: boolean;
  isentityThreadLoading: boolean;
  feedCount: number;
  entityFieldThreadCount: EntityFieldThreadCount[];
  testMode: DatasetTestModeType;
  tableTestCase: TableTest[];
  showTestForm: boolean;
  qualityTestFormHandler: (
    tabValue: number,
    testMode?: DatasetTestModeType
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
  versionHandler: () => void;
  loadNodeHandler: (node: EntityReference, pos: LineagePos) => void;
  addLineageHandler: (edge: Edge) => Promise<void>;
  removeLineageHandler: (data: EdgeData) => void;
  entityLineageHandler: (lineage: EntityLineage) => void;
  postFeedHandler: (value: string, id: string) => void;
  handleAddTableTestCase: (data: CreateTableTest) => void;
  handleAddColumnTestCase: (data: ColumnTest) => void;
  handleRemoveTableTest: (testType: TableTestType) => void;
  handleRemoveColumnTest: (
    columnName: string,
    testType: ColumnTestType
  ) => void;
}
