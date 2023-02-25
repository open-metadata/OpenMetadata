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
import { t } from 'i18next';
import { TabSpecificField } from '../enums/entity.enum';
import { Topic } from '../generated/entity/data/topic';

export const topicDetailsTabs = [
  {
    name: t('label.schema'),
    path: 'schema',
  },
  {
    name: t('label.activity-feed-and-task-plural'),
    path: 'activity_feed',
    field: TabSpecificField.ACTIVITY_FEED,
  },
  {
    name: t('label.sample-data'),
    path: 'sample_data',
    field: TabSpecificField.SAMPLE_DATA,
  },
  {
    name: t('label.config'),
    path: 'config',
  },
  {
    name: t('label.lineage'),
    path: 'lineage',
    field: TabSpecificField.LINEAGE,
  },
  {
    name: t('label.custom-property-plural'),
    path: 'custom_properties',
  },
];

export const getCurrentTopicTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'activity_feed':
      currentTab = 2;

      break;
    case 'sample_data':
      currentTab = 3;

      break;
    case 'config':
      currentTab = 4;

      break;
    case 'lineage':
      currentTab = 5;

      break;
    case 'custom_properties':
      currentTab = 6;

      break;

    case 'schema':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};

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
