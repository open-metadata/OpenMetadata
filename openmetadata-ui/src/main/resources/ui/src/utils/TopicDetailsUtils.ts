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

import { TopicConfigObjectInterface } from 'components/TopicDetails/TopicDetails.interface';
import { isUndefined } from 'lodash';
import { Topic } from '../generated/entity/data/topic';
import { sortTagsCaseInsensitive } from './CommonUtils';

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

export const getFormattedTopicDetails = (topicDetails: Topic): Topic => {
  if (
    !isUndefined(topicDetails.messageSchema) &&
    !isUndefined(topicDetails.messageSchema?.schemaFields)
  ) {
    // Sorting tags as the response of PATCH request does not return the sorted order
    // of tags, but is stored in sorted manner in the database
    // which leads to wrong PATCH payload sent after further tags removal
    const schemaFields = topicDetails.messageSchema.schemaFields.map(
      (schemaField) =>
        isUndefined(schemaField.tags)
          ? schemaField
          : { ...schemaField, tags: sortTagsCaseInsensitive(schemaField.tags) }
    );

    return {
      ...topicDetails,
      tags: topicDetails.tags ?? [],
      messageSchema: { ...topicDetails.messageSchema, schemaFields },
    };
  } else {
    return { ...topicDetails, tags: topicDetails.tags ?? [] };
  }
};
