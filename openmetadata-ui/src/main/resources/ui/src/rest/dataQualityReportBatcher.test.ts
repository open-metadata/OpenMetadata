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
import { batchedDataQualityReport } from './dataQualityReportBatcher';
import { getDataQualityReportBatch } from './testAPI';

jest.mock('./testAPI', () => ({
  getDataQualityReportBatch: jest.fn(),
}));

const mockGetDataQualityReportBatch = getDataQualityReportBatch as jest.Mock;

describe('dataQualityReportBatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should coalesce requests fired in the same tick into a single batch call', async () => {
    mockGetDataQualityReportBatch.mockResolvedValue({
      results: [
        { key: '0', report: { data: [{ a: '1' }], metadata: {} } },
        { key: '1', report: { data: [{ b: '2' }], metadata: {} } },
      ],
    });

    const [first, second] = await Promise.all([
      batchedDataQualityReport({ index: 'testCase', aggregationQuery: 'agg1' }),
      batchedDataQualityReport({ index: 'table', aggregationQuery: 'agg2' }),
    ]);

    expect(mockGetDataQualityReportBatch).toHaveBeenCalledTimes(1);
    expect(mockGetDataQualityReportBatch).toHaveBeenCalledWith({
      requests: [
        { index: 'testCase', aggregationQuery: 'agg1', key: '0' },
        { index: 'table', aggregationQuery: 'agg2', key: '1' },
      ],
    });
    expect(first).toEqual({ data: [{ a: '1' }], metadata: {} });
    expect(second).toEqual({ data: [{ b: '2' }], metadata: {} });
  });

  it('should reject only the failed item and resolve the rest', async () => {
    mockGetDataQualityReportBatch.mockResolvedValue({
      results: [
        { key: '0', report: { data: [], metadata: {} } },
        { key: '1', error: 'aggregation failed' },
      ],
    });

    const ok = batchedDataQualityReport({
      index: 'testCase',
      aggregationQuery: 'agg',
    });
    const bad = batchedDataQualityReport({
      index: 'missing',
      aggregationQuery: 'agg',
    });

    await expect(ok).resolves.toEqual({ data: [], metadata: {} });
    await expect(bad).rejects.toThrow('aggregation failed');
  });

  it('should reject all callers when the batch request itself fails', async () => {
    mockGetDataQualityReportBatch.mockRejectedValue(new Error('network error'));

    const first = batchedDataQualityReport({
      index: 'testCase',
      aggregationQuery: 'agg',
    });
    const second = batchedDataQualityReport({
      index: 'table',
      aggregationQuery: 'agg',
    });

    await expect(first).rejects.toThrow('network error');
    await expect(second).rejects.toThrow('network error');
  });

  it('should start a new batch for requests fired after the previous flush', async () => {
    mockGetDataQualityReportBatch.mockResolvedValue({
      results: [{ key: '0', report: { data: [], metadata: {} } }],
    });

    await batchedDataQualityReport({
      index: 'testCase',
      aggregationQuery: 'a',
    });
    await batchedDataQualityReport({ index: 'table', aggregationQuery: 'b' });

    expect(mockGetDataQualityReportBatch).toHaveBeenCalledTimes(2);
  });

  it('should split a render tick larger than the server cap into multiple POSTs', async () => {
    mockGetDataQualityReportBatch.mockImplementation((data) =>
      Promise.resolve({
        results: data.requests.map((request: { key: string }) => ({
          key: request.key,
          report: { data: [], metadata: {} },
        })),
      })
    );

    const pending = Array.from({ length: 51 }, (_, index) =>
      batchedDataQualityReport({
        index: 'testCase',
        aggregationQuery: `agg${index}`,
      })
    );
    await Promise.all(pending);

    expect(mockGetDataQualityReportBatch).toHaveBeenCalledTimes(2);
    const chunkSizes = mockGetDataQualityReportBatch.mock.calls
      .map(([data]) => data.requests.length)
      .sort((a: number, b: number) => b - a);

    expect(chunkSizes).toEqual([50, 1]);
  });
});
