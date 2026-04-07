/*
 *  Copyright 2025 Collate.
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

import { EntityType } from '../enums/entity.enum';
import { LineageDirection } from '../generated/api/lineage/searchLineageRequest';
import APIClient from './index';
import {
  exportLineageByEntityCountAsync,
  getLineageByEntityCount,
  getLineageDataByFQN,
  getLineagePagingData,
} from './lineageAPI';

jest.mock('./index', () => ({
  get: jest.fn().mockResolvedValue({ data: {} }),
}));

const mockGet = APIClient.get as jest.MockedFunction<typeof APIClient.get>;

describe('lineageAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getLineageByEntityCount sends entityType and maxDepth params', async () => {
    await getLineageByEntityCount({
      fqn: 'service.db.schema.table',
      entityType: EntityType.TABLE,
      direction: LineageDirection.Upstream,
      nodeDepth: 4,
      upstreamDepth: 4,
      downstreamDepth: 2,
      from: 10,
      size: 25,
      query_filter: 'name:orders',
      include_pagination_info: true,
    });

    expect(mockGet).toHaveBeenCalledWith('lineage/getLineageByEntityCount', {
      params: {
        fqn: 'service.db.schema.table',
        entityType: EntityType.TABLE,
        direction: LineageDirection.Upstream,
        nodeDepth: 4,
        maxDepth: 4,
        upstreamDepth: 4,
        downstreamDepth: 2,
        from: 10,
        size: 25,
        query_filter: 'name:orders',
        include_pagination_info: true,
        type: undefined,
      },
    });
  });

  it('exportLineageByEntityCountAsync sends entityType and maxDepth params', async () => {
    await exportLineageByEntityCountAsync({
      fqn: 'service.db.schema.table',
      type: EntityType.TABLE,
      direction: LineageDirection.Downstream,
      nodeDepth: 3,
      query_filter: 'tags.tagFQN:Tier.Tier1',
    });

    expect(mockGet).toHaveBeenCalledWith('lineage/exportByEntityCountAsync', {
      params: {
        fqn: 'service.db.schema.table',
        type: undefined,
        entityType: EntityType.TABLE,
        direction: LineageDirection.Downstream,
        nodeDepth: 3,
        maxDepth: 3,
        query_filter: 'tags.tagFQN:Tier.Tier1',
      },
    });
  });

  it('getLineagePagingData sends explicit directional depths', async () => {
    await getLineagePagingData({
      fqn: 'service.db.schema.table',
      type: EntityType.TABLE,
      upstreamDepth: 2,
      downstreamDepth: 5,
      query_filter: 'deleted:false',
    });

    expect(mockGet).toHaveBeenCalledWith('lineage/getPaginationInfo', {
      params: {
        fqn: 'service.db.schema.table',
        type: undefined,
        entityType: EntityType.TABLE,
        upstreamDepth: 2,
        downstreamDepth: 5,
        query_filter: 'deleted:false',
      },
    });
  });

  it('getLineageDataByFQN uses directional endpoint when direction is provided', async () => {
    await getLineageDataByFQN({
      fqn: 'service.db.schema.table',
      entityType: EntityType.TABLE,
      direction: LineageDirection.Downstream,
      config: {
        upstreamDepth: 0,
        downstreamDepth: 3,
      },
      queryFilter: 'name:orders',
      columnFilter: 'columnName:customer_id',
    });

    expect(mockGet).toHaveBeenCalledWith('lineage/getLineage/Downstream', {
      params: {
        fqn: 'service.db.schema.table',
        type: EntityType.TABLE,
        upstreamDepth: 0,
        downstreamDepth: 3,
        query_filter: 'name:orders',
        column_filter: 'columnName:customer_id',
        includeDeleted: false,
        size: undefined,
        from: undefined,
      },
    });
  });
});
