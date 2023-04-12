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

import { FeedFilter } from '../../enums/mydata.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Table, TableData } from '../../generated/entity/data/table';
import { Thread, ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import {
  EntityFieldThreadCount,
  ThreadUpdatedFunc,
} from '../../interface/feed.interface';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface DatasetDetailsProps {
  entityId?: string;
  tableDetails: Table;
  datasetFQN: string;
  dataModel?: Table['dataModel'];
  activeTab: number;
  tableProfile: Table['profile'];
  sampleData: TableData;
  slashedTableName: TitleBreadcrumbProps['titleLinks'];
  entityThread: Thread[];
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
