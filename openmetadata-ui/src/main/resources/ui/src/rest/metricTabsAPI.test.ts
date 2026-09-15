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
import { EntityType } from '../enums/entity.enum';
import APIClient from './index';
import {
  getMetricTabAssetDetails,
  getMetricTabAssetFields,
  getMetricTabLineage,
} from './metricTabsAPI';

jest.mock('./index', () => ({
  get: jest.fn(),
  put: jest.fn(),
}));

describe('metricTabsAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (APIClient.get as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('uses only supported detail fields for each asset collection', async () => {
    expect(getMetricTabAssetFields(EntityType.TABLE)).toBe(
      'domains,owners,tags,columns,usageSummary'
    );
    expect(getMetricTabAssetFields(EntityType.DASHBOARD)).toBe(
      'domains,owners,tags,usageSummary'
    );
    expect(getMetricTabAssetFields(EntityType.TOPIC)).toBe(
      'domains,owners,tags'
    );

    await getMetricTabAssetDetails(EntityType.TOPIC, 'kafka.orders');

    expect(APIClient.get).toHaveBeenCalledWith('/topics/name/kafka.orders', {
      params: { fields: 'domains,owners,tags', include: 'all' },
    });
  });

  it('requests the generated EntityLineage endpoint shape at one hop', async () => {
    const lineage = {
      downstreamEdges: [{ fromEntity: 'asset-1', toEntity: 'metric-1' }],
      entity: { id: 'metric-1', type: 'metric' },
      upstreamEdges: [],
    };
    (APIClient.get as jest.Mock).mockResolvedValue({ data: lineage });

    await expect(getMetricTabLineage('revenue')).resolves.toEqual(lineage);
    expect(APIClient.get).toHaveBeenCalledWith('/lineage/getLineage', {
      params: {
        downstreamDepth: 1,
        fqn: 'revenue',
        type: EntityType.METRIC,
        upstreamDepth: 1,
      },
    });
  });
});
