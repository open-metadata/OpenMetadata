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

import axiosClient from '.';
import { CreateEventPublisherJob } from '../generated/api/createEventPublisherJob';
import {
  EventPublisherJob,
  PublisherType,
  RunMode,
} from '../generated/settings/eventPublisherJob';

export const getAllReIndexStatus = async (mode: RunMode) => {
  const res = await axiosClient.get<EventPublisherJob>(
    `/indexResource/reindex/status/${mode}`
  );

  return res.data;
};

export const reIndexByPublisher = async ({
  runMode,
  entities = ['all'],
  recreateIndex = true,
  batchSize,
  flushIntervalInSec,
}: CreateEventPublisherJob) => {
  const payload = {
    publisherType: PublisherType.ElasticSearch,
    runMode,
    recreateIndex,
    entities,
    batchSize,
    flushIntervalInSec,
  };

  const res = await axiosClient.post('/indexResource/reindex', payload);

  return res.data;
};
