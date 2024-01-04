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
import APIClient from './index';

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
    `/search/getLineage`,
    {
      params: {
        fqn,
        upstreamDepth,
        downstreamDepth,
        query_filter: queryFilter,
        includeDeleted: false,
      },
    }
  );

  return response.data;
};
