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

import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import { FeedFilter } from 'enums/mydata.enum';
import { CreateThread, ThreadType } from 'generated/api/feed/createThread';
import { DashboardDataModel } from 'generated/entity/data/dashboardDataModel';
import { Column } from 'generated/entity/data/table';
import { Thread } from 'generated/entity/feed/thread';
import { Paging } from 'generated/type/paging';
import {
  EntityFieldThreadCount,
  ThreadUpdatedFunc,
} from 'interface/feed.interface';
import { EntityTags } from 'Models';

export interface DataModelDetailsProps {
  isEntityThreadLoading: boolean;

  paging: Paging;
  entityFieldThreadCount: EntityFieldThreadCount[];
  entityFieldTaskCount: EntityFieldThreadCount[];
  entityThread: Thread[];
  feedCount: number;
  dataModelData?: DashboardDataModel;
  dashboardDataModelFQN: string;
  postFeedHandler: (value: string, id: string) => void;
  dataModelPermissions: OperationPermission;
  createThread: (data: CreateThread) => void;
  deletePostHandler: (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => void;
  updateThreadHandler: ThreadUpdatedFunc;
  handleFollowDataModel: () => void;
  handleRemoveTier: () => void;
  fetchFeedHandler: (
    after?: string,
    feedType?: FeedFilter,
    threadType?: ThreadType
  ) => void;
  handleUpdateTags: (selectedTags?: Array<EntityTags>) => void;
  handleUpdateOwner: (updatedOwner?: DashboardDataModel['owner']) => void;
  handleUpdateTier: (updatedTier?: string) => void;
  activeTab: string;
  handleTabChange: (tabValue: string) => void;
  handleUpdateDescription: (value: string) => Promise<void>;
  handleUpdateDataModel: (updatedDataModel: Column[]) => Promise<void>;
  handleFeedFilterChange: (
    feedType: FeedFilter,
    threadType?: ThreadType
  ) => void;
}
