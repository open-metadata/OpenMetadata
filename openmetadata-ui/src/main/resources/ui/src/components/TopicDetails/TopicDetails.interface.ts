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
  TableDetail,
} from 'Models';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Topic } from '../../generated/entity/data/topic';
import { User } from '../../generated/entity/teams/user';
import { TagLabel } from '../../generated/type/tagLabel';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface TopicDetailsProps {
  version?: string;
  schemaText: string;
  schemaType: string;
  partitions: number;
  cleanupPolicies: Array<string>;
  maximumMessageSize: number;
  replicationFactor: number;
  retentionSize: number;
  users: Array<User>;
  topicDetails: Topic;
  entityName: string;
  activeTab: number;
  owner: TableDetail['owner'];
  description: string;
  tier: TagLabel;
  followers: Array<User>;
  topicTags: Array<EntityTags>;
  slashedTopicName: TitleBreadcrumbProps['titleLinks'];
  deleted?: boolean;
  entityThread: EntityThread[];
  isentityThreadLoading: boolean;
  feedCount: number;
  entityFieldThreadCount: EntityFieldThreadCount[];
  createThread: (data: CreateThread) => void;
  setActiveTabHandler: (value: number) => void;
  followTopicHandler: () => void;
  unfollowTopicHandler: () => void;
  settingsUpdateHandler: (updatedTopic: Topic) => Promise<void>;
  descriptionUpdateHandler: (updatedTopic: Topic) => void;
  tagUpdateHandler: (updatedTopic: Topic) => void;
  versionHandler: () => void;
  postFeedHandler: (value: string, id: string) => void;
}
