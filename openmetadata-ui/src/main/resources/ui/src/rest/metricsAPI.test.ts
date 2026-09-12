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
import { Direction } from '../generated/api/data/metricObservability';
import type { EntityReference } from '../generated/entity/type';
import APIClient from './index';
import {
  addAssetsToMetric,
  getMetricAssets,
  getMetricHierarchy,
  getMetricHierarchyContext,
  getMetricObservability,
  removeAssetsFromMetric,
} from './metricsAPI';

jest.mock('./index', () => ({
  get: jest.fn(),
  put: jest.fn(),
}));

const assets: EntityReference[] = [
  {
    id: 'table-id',
    name: 'orders',
    fullyQualifiedName: 'warehouse.sales.orders',
    type: 'table',
  },
];

describe('Metric hierarchy, assets, and observability API contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards offset hierarchy pagination and returns the response body', async () => {
    const hierarchy = {
      data: [{ id: 'metric-id', type: 'metric' }],
      paging: { limit: 20, offset: 40, total: 61 },
    };
    (APIClient.get as jest.Mock).mockResolvedValue({ data: hierarchy });

    await expect(
      getMetricHierarchy({ limit: 20, offset: 40, q: 'margin' })
    ).resolves.toEqual(hierarchy);
    expect(APIClient.get).toHaveBeenCalledWith('/metrics/hierarchy', {
      params: { limit: 20, offset: 40, q: 'margin' },
    });
  });

  it('forwards independent hierarchy-context windows', async () => {
    const context = { current: { id: 'metric-id' }, children: [] };
    (APIClient.get as jest.Mock).mockResolvedValue({ data: context });

    await expect(
      getMetricHierarchyContext('metric-id', {
        childLimit: 25,
        childOffset: 50,
        siblingLimit: 10,
        siblingOffset: 20,
      })
    ).resolves.toEqual(context);
    expect(APIClient.get).toHaveBeenCalledWith('/metrics/metric-id/hierarchy', {
      params: {
        childLimit: 25,
        childOffset: 50,
        siblingLimit: 10,
        siblingOffset: 20,
      },
    });
  });

  it('encodes Metric FQNs for permission-controlled bulk add and remove', async () => {
    const result = { success: assets, failed: [] };
    (APIClient.put as jest.Mock).mockResolvedValue({ data: result });

    await expect(
      addAssetsToMetric('Revenue / Growth', assets)
    ).resolves.toEqual(result);
    await expect(
      removeAssetsFromMetric('Revenue / Growth', assets)
    ).resolves.toEqual(result);

    expect(APIClient.put).toHaveBeenNthCalledWith(
      1,
      '/metrics/Revenue%20%2F%20Growth/assets/add',
      { assets }
    );
    expect(APIClient.put).toHaveBeenNthCalledWith(
      2,
      '/metrics/Revenue%20%2F%20Growth/assets/remove',
      { assets }
    );
  });

  it('forwards bounded asset filters and cancellation signal', async () => {
    const controller = new AbortController();
    const response = {
      data: [{ asset: assets[0], direction: Direction.Upstream }],
      paging: { limit: 25, offset: 25, total: 42 },
    };
    (APIClient.get as jest.Mock).mockResolvedValue({ data: response });

    await expect(
      getMetricAssets(
        'metric-id',
        {
          direction: Direction.Upstream,
          entityType: 'table',
          limit: 25,
          offset: 25,
          q: 'orders',
        },
        { signal: controller.signal }
      )
    ).resolves.toEqual(response);
    expect(APIClient.get).toHaveBeenCalledWith('/metrics/metric-id/assets', {
      params: {
        direction: Direction.Upstream,
        entityType: 'table',
        limit: 25,
        offset: 25,
        q: 'orders',
      },
      signal: controller.signal,
    });
  });

  it('requests the global Metric observability result', async () => {
    const observability = { score: 91, health: 'Healthy' };
    (APIClient.get as jest.Mock).mockResolvedValue({ data: observability });

    await expect(getMetricObservability('metric-id')).resolves.toEqual(
      observability
    );
    expect(APIClient.get).toHaveBeenCalledWith(
      '/metrics/metric-id/observability'
    );
  });

  it('propagates transport failures without masking them', async () => {
    const error = new Error('network unavailable');
    (APIClient.get as jest.Mock).mockRejectedValue(error);

    await expect(
      getMetricAssets('metric-id', { limit: 20, offset: 0 })
    ).rejects.toBe(error);
  });
});
