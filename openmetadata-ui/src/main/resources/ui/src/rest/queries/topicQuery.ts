/*
 *  Copyright 2026 Collate.
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

import { QueryClient } from '@tanstack/react-query';
import { TabSpecificField } from '../../enums/entity.enum';
import { Topic } from '../../generated/entity/data/topic';
import { getTopicByFqn } from '../topicsAPI';

export const TOPIC_DEFAULT_FIELDS = [
  TabSpecificField.OWNERS,
  TabSpecificField.FOLLOWERS,
  TabSpecificField.TAGS,
  TabSpecificField.DOMAINS,
  TabSpecificField.DATA_PRODUCTS,
  TabSpecificField.VOTES,
  TabSpecificField.EXTENSION,
].join(',');

export const topicQueryKey = (fqn: string, fields: string) =>
  ['topic', fqn, fields] as const;

export const topicQueryFn = (fqn: string, fields: string) => () =>
  getTopicByFqn(fqn, { fields });

export const prefetchTopicByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: topicQueryKey(fqn, fields),
      queryFn: topicQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type TopicQueryData = Topic | undefined;

export const prefetchTopic = (queryClient: QueryClient, fqn: string) =>
  prefetchTopicByFqn(queryClient, fqn, TOPIC_DEFAULT_FIELDS);
