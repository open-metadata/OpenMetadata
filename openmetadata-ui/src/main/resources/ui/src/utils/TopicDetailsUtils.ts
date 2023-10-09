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

import { TopicConfigObjectInterface } from '../components/TopicDetails/TopicDetails.interface';
import { Topic } from '../generated/entity/data/topic';

export const getConfigObject = (
  topicDetails: Topic
): TopicConfigObjectInterface => {
  return {
    Partitions: topicDetails.partitions,
    'Replication Factor': topicDetails.replicationFactor,
    'Retention Size': topicDetails.retentionSize,
    'CleanUp Policies': topicDetails.cleanupPolicies,
    'Max Message Size': topicDetails.maximumMessageSize,
    'Schema Type': topicDetails.messageSchema?.schemaType,
  };
};
