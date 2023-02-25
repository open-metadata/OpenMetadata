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
  CleanupPolicy,
  Topic,
  TopicSampleData,
} from '../../generated/entity/data/topic';
import { Thread, ThreadType } from '../../generated/entity/feed/thread';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { SchemaType } from '../../generated/type/schema';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  EntityFieldThreadCount,
  ThreadUpdatedFunc,
} from '../../interface/feed.interface';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import {
  Edge,
  EdgeData,
  LeafNodes,
  LineagePos,
  LoadingNodeState,
} from '../EntityLineage/EntityLineage.interface';

export interface TopicDetailsProps {
  topicFQN: string;
  version?: string;
  partitions: number;
  cleanupPolicies: Array<string>;
  maximumMessageSize: number;
  replicationFactor: number;
  retentionSize: number;
  topicDetails: Topic;
  entityName: string;
  activeTab: number;
  owner: EntityReference;
  description: string;
  tier: TagLabel;
  followers: Array<EntityReference>;
  topicTags: Array<EntityTags>;
  slashedTopicName: TitleBreadcrumbProps['titleLinks'];
  deleted?: boolean;
  entityThread: Thread[];
  isentityThreadLoading: boolean;
  feedCount: number;
  entityFieldThreadCount: EntityFieldThreadCount[];
  entityFieldTaskCount: EntityFieldThreadCount[];
  paging: Paging;
  isSampleDataLoading?: boolean;
  sampleData?: TopicSampleData;
  fetchFeedHandler: (
    after?: string,
    feedFilter?: FeedFilter,
    threadFilter?: ThreadType
  ) => void;
  createThread: (data: CreateThread) => void;
  setActiveTabHandler: (value: number) => void;
  followTopicHandler: () => void;
  unfollowTopicHandler: () => void;
  settingsUpdateHandler: (updatedTopic: Topic) => Promise<void>;
  descriptionUpdateHandler: (updatedTopic: Topic) => Promise<void>;
  tagUpdateHandler: (updatedTopic: Topic) => void;
  versionHandler: () => void;
  postFeedHandler: (value: string, id: string) => void;
  deletePostHandler: (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => void;
  updateThreadHandler: ThreadUpdatedFunc;
  lineageTabData: {
    loadNodeHandler: (node: EntityReference, pos: LineagePos) => void;
    addLineageHandler: (edge: Edge) => Promise<void>;
    removeLineageHandler: (data: EdgeData) => void;
    entityLineageHandler: (lineage: EntityLineage) => void;
    isLineageLoading?: boolean;
    entityLineage: EntityLineage;
    lineageLeafNodes: LeafNodes;
    isNodeLoading: LoadingNodeState;
  };
  onExtensionUpdate: (updatedTopic: Topic) => Promise<void>;
}

export interface TopicConfigObjectInterface {
  Partitions: number;
  'Replication Factor'?: number;
  'Retention Size'?: number;
  'CleanUp Policies'?: CleanupPolicy[];
  'Max Message Size'?: number;
  'Schema Type'?: SchemaType;
}
