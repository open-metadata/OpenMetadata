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

import { LineageConfig } from '../components/Entity/EntityLineage/EntityLineage.interface';
import { EntityLineageReponse } from '../components/Lineage/Lineage.interface';
import { AddLineage } from '../generated/api/lineage/addLineage';
import { EntityLineage } from '../generated/type/entityLineage';
import APIClient from './index';

export const getLineageByFQN = async (
  fqn: string,
  type: string,
  upstreamDepth = 3,
  downstreamDepth = 3
) => {
  const response = await APIClient.get<EntityLineage>(
    `/lineage/${type}/name/${fqn}?upstreamDepth=${upstreamDepth}&downstreamDepth=${downstreamDepth}`
  );

  return response.data;
};

export const updateLineageEdge = async (edge: AddLineage) => {
  const response = await APIClient.put<AddLineage>(`/lineage`, edge);

  return response.data;
};

export const getLineageDataByFQN = async (
  fqn: string,
  config?: LineageConfig,
  queryFilter?: string
) => {
  const { upstreamDepth = 1, downstreamDepth = 1 } = config ?? {};
  const response = await APIClient.get<EntityLineageReponse>(
    `/search/getLineage?fqn=${fqn}&upstreamDepth=${upstreamDepth}&downstreamDepth=${downstreamDepth}&query_filter=${queryFilter}`
  );

  return response.data;
};
