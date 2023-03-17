/*
 *  Copyright 2022 Collate.
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
import { FeedFilter } from '../../enums/mydata.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import {
  Column,
  Table,
  TableData,
  TableJoins,
  TableType,
  UsageDetails,
} from '../../generated/entity/data/table';
import { Thread, ThreadType } from '../../generated/entity/feed/thread';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  EntityFieldThreadCount,
  ThreadUpdatedFunc,
} from '../../interface/feed.interface';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface DatasetDetailsProps {
  version?: string;
  entityId?: string;
  joins: TableJoins;
  tableType: TableType;
  usageSummary: UsageDetails;
  tableDetails: Table;
  entityName: string;
  datasetFQN: string;
  dataModel?: Table['dataModel'];
  activeTab: number;
  owner: EntityReference;
  description: string;
  tableProfile: Table['profile'];
  columns: Column[];
  tier: TagLabel;
  sampleData: TableData;
  followers: Array<EntityReference>;
  tableTags: Array<EntityTags>;
  slashedTableName: TitleBreadcrumbProps['titleLinks'];
  entityThread: Thread[];
  deleted?: boolean;
  isTableProfileLoading?: boolean;
  isSampleDataLoading?: boolean;
  isentityThreadLoading: boolean;
  feedCount: number;
  entityFieldThreadCount: EntityFieldThreadCount[];
  entityFieldTaskCount: EntityFieldThreadCount[];
  paging: Paging;
  createThread: (data: CreateThread) => void;
  setActiveTabHandler: (value: number) => void;
  followTableHandler: () => void;
  unfollowTableHandler: () => void;
  settingsUpdateHandler: (updatedTable: Table) => Promise<void>;
  columnsUpdateHandler: (updatedTable: Table) => Promise<void>;
  descriptionUpdateHandler: (updatedTable: Table) => Promise<void>;
  tagUpdateHandler: (updatedTable: Table) => void;
  versionHandler: () => void;
  postFeedHandler: (value: string, id: string) => void;
  deletePostHandler: (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => void;
  fetchFeedHandler: (
    after?: string,
    feedType?: FeedFilter,
    threadType?: ThreadType
  ) => void;
  handleExtensionUpdate: (updatedTable: Table) => Promise<void>;
  updateThreadHandler: ThreadUpdatedFunc;
}
