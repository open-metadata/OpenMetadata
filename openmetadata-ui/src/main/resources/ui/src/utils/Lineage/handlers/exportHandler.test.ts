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
import { EntityType } from '../../../enums/entity.enum';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { exportLineageAsync } from '../../../rest/lineageAPI';
import { exportLineageData } from './exportHandler';

jest.mock('../../../rest/lineageAPI', () => ({
  exportLineageAsync: jest.fn(),
}));

const mockExportLineageAsync = exportLineageAsync as jest.Mock;

describe('exportLineageData', () => {
  beforeEach(() => {
    useLineageStore.getState().reset();
    mockExportLineageAsync.mockReset();
    mockExportLineageAsync.mockResolvedValue({ jobId: 'job1' });
  });

  it('calls exportLineageAsync with entity context and time filter from the store, and the given query filter', async () => {
    useLineageStore.setState({
      entityFqn: 'sample_data.ecommerce_db.shopify.dim_address',
      entityType: EntityType.TABLE,
      lineageConfig: {
        upstreamDepth: 2,
        downstreamDepth: 3,
        nodesPerLayer: 50,
      },
      timeFilter: { startTime: 100, endTime: 200 },
    });

    const result = await exportLineageData('{"query":{}}');

    expect(mockExportLineageAsync).toHaveBeenCalledWith(
      'sample_data.ecommerce_db.shopify.dim_address',
      EntityType.TABLE,
      { upstreamDepth: 2, downstreamDepth: 3, nodesPerLayer: 50 },
      '{"query":{}}',
      100,
      200
    );
    expect(result).toEqual({ jobId: 'job1' });
  });

  it('falls back to an empty string entityType when none is set', async () => {
    useLineageStore.setState({
      entityFqn: 'sample_data.ecommerce_db.shopify.dim_address',
      entityType: undefined,
    });

    await exportLineageData('');

    expect(mockExportLineageAsync).toHaveBeenCalledWith(
      'sample_data.ecommerce_db.shopify.dim_address',
      '',
      expect.anything(),
      '',
      undefined,
      undefined
    );
  });
});
