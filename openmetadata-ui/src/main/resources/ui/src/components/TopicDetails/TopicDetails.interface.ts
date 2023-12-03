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

import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { OperationPermission } from '../../components/PermissionProvider/PermissionProvider.interface';
import { QueryVote } from '../../components/TableQueries/TableQueries.interface';
import { CreateThread } from '../../generated/api/feed/createThread';
import { CleanupPolicy, Topic } from '../../generated/entity/data/topic';
import { SchemaType } from '../../generated/type/schema';

export interface TopicDetailsProps {
  updateTopicDetailsState?: (data: DataAssetWithDomains) => void;
  topicDetails: Topic;
  topicPermissions: OperationPermission;
  fetchTopic: () => void;
  createThread: (data: CreateThread) => void;
  followTopicHandler: () => Promise<void>;
  unFollowTopicHandler: () => Promise<void>;
  versionHandler: () => void;
  onUpdateVote: (data: QueryVote, id: string) => Promise<void>;
  onTopicUpdate: (updatedData: Topic, key: keyof Topic) => Promise<void>;
  handleToggleDelete: (version?: number) => void;
}

export interface TopicConfigObjectInterface {
  Owner?: Record<string, string | JSX.Element | undefined>;
  Partitions: number;
  'Replication Factor'?: number;
  'Retention Size'?: number;
  'CleanUp Policies'?: CleanupPolicy[];
  'Max Message Size'?: number;
  'Schema Type'?: SchemaType;
}
