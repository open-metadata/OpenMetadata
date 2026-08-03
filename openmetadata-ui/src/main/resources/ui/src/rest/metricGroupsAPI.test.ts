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
import type { Operation } from 'fast-json-patch';
import APIClient from './index';
import {
  addMetricsToGroup,
  createMetricGroup,
  deleteMetricGroup,
  getMetricGroupByFqn,
  getMetricGroupMetrics,
  getMetricGroups,
  patchMetricGroup,
  removeMetricsFromGroup,
} from './metricGroupsAPI';

jest.mock('./index', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

describe('metricGroupsAPI', () => {
  beforeEach(() => jest.clearAllMocks());

  it('forwards bounded list and root-only membership params and returns paging data', async () => {
    const response = {
      data: [{ id: 'group', name: 'commercial' }],
      paging: { total: 1 },
    };
    (APIClient.get as jest.Mock).mockResolvedValue({ data: response });

    await expect(
      getMetricGroups({ limit: 50, after: 'cursor' })
    ).resolves.toEqual(response);
    expect(APIClient.get).toHaveBeenLastCalledWith('/metricGroups', {
      params: { limit: 50, after: 'cursor' },
    });

    await getMetricGroupMetrics('group', {
      limit: 20,
      offset: 40,
      q: 'margin',
      rootOnly: true,
    });

    expect(APIClient.get).toHaveBeenLastCalledWith(
      '/metricGroups/group/metrics',
      {
        params: { limit: 20, offset: 40, q: 'margin', rootOnly: true },
      }
    );
  });

  it('encodes FQNs for get and bulk membership paths', async () => {
    (APIClient.get as jest.Mock).mockResolvedValue({ data: { id: 'group' } });
    (APIClient.put as jest.Mock).mockResolvedValue({ data: { success: [] } });
    const references = [{ id: 'metric', type: 'metric' }];

    await getMetricGroupByFqn('Revenue / Growth', { fields: 'owners' });

    expect(APIClient.get).toHaveBeenCalledWith(
      '/metricGroups/name/Revenue%20%2F%20Growth',
      { params: { fields: 'owners' } }
    );

    await addMetricsToGroup('Revenue / Growth', references);
    await removeMetricsFromGroup('Revenue / Growth', references);

    expect(APIClient.put).toHaveBeenNthCalledWith(
      1,
      '/metricGroups/Revenue%20%2F%20Growth/metrics/add',
      { assets: references }
    );
    expect(APIClient.put).toHaveBeenNthCalledWith(
      2,
      '/metricGroups/Revenue%20%2F%20Growth/metrics/remove',
      { assets: references }
    );
  });

  it('returns create, patch, and delete response bodies with exact contracts', async () => {
    const group = { id: 'group', name: 'commercial' };
    (APIClient.post as jest.Mock).mockResolvedValue({ data: group });
    (APIClient.patch as jest.Mock).mockResolvedValue({ data: group });
    (APIClient.delete as jest.Mock).mockResolvedValue({ data: group });

    await expect(createMetricGroup({ name: 'commercial' })).resolves.toEqual(
      group
    );
    expect(APIClient.post).toHaveBeenCalledWith('/metricGroups', {
      name: 'commercial',
    });

    const patch: Operation[] = [
      { op: 'replace', path: '/description', value: 'Updated' },
    ];

    await expect(patchMetricGroup('group', patch)).resolves.toEqual(group);
    expect(APIClient.patch).toHaveBeenCalledWith('/metricGroups/group', patch);
    await expect(deleteMetricGroup('group', true)).resolves.toEqual(group);
    expect(APIClient.delete).toHaveBeenCalledWith(
      '/metricGroups/group?hardDelete=true'
    );
  });

  it('propagates transport errors without changing them', async () => {
    const error = new Error('network unavailable');
    (APIClient.get as jest.Mock).mockRejectedValue(error);

    await expect(
      getMetricGroupMetrics('group', { limit: 20, offset: 0 })
    ).rejects.toBe(error);
  });
});
