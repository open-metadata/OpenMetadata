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

import { Operation } from 'fast-json-patch';
import { FeedFilter } from '../../enums/mydata.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Thread, ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import {
  EntityFieldThreadCount,
  ThreadUpdatedFunc,
} from '../../interface/feed.interface';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface ChartType extends Chart {
  displayName: string;
}

export interface DashboardDetailsProps {
  dashboardFQN: string;
  charts: Array<ChartType>;
  dashboardUrl: string;
  dashboardDetails: Dashboard;
  activeTab: number;
  slashedDashboardName: TitleBreadcrumbProps['titleLinks'];
  entityThread: Thread[];
  isEntityThreadLoading: boolean;
  feedCount: number;
  entityFieldThreadCount: EntityFieldThreadCount[];
  entityFieldTaskCount: EntityFieldThreadCount[];
  paging: Paging;
  fetchFeedHandler: (
    after?: string,
    feedType?: FeedFilter,
    threadType?: ThreadType
  ) => void;
  createThread: (data: CreateThread) => void;
  setActiveTabHandler: (value: number) => void;
  followDashboardHandler: () => void;
  unfollowDashboardHandler: () => void;
  settingsUpdateHandler: (updatedDashboard: Dashboard) => Promise<void>;
  descriptionUpdateHandler: (updatedDashboard: Dashboard) => Promise<void>;
  chartDescriptionUpdateHandler: (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => Promise<void>;
  chartTagUpdateHandler: (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => void;
  tagUpdateHandler: (updatedDashboard: Dashboard) => void;
  versionHandler: () => void;
  postFeedHandler: (value: string, id: string) => void;
  deletePostHandler: (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => void;
  updateThreadHandler: ThreadUpdatedFunc;
  onExtensionUpdate: (updatedDashboard: Dashboard) => Promise<void>;
}
