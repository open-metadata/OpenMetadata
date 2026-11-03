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

import axiosClient from './axiosClient';
import { getAllPipelineStatuses } from './pipelineAPI';

jest.mock('./axiosClient');

const statusAt = (timestamp: number) => ({
  executionStatus: 'Successful',
  timestamp,
});

describe('pipelineAPI', () => {
  const mockClient = axiosClient as jest.Mocked<typeof axiosClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllPipelineStatuses', () => {
    it('follows paging.after until the server returns no cursor', async () => {
      mockClient.get
        .mockResolvedValueOnce({
          data: {
            data: [statusAt(3), statusAt(2)],
            paging: { after: 'cursor-1', total: 3 },
          },
        })
        .mockResolvedValueOnce({
          data: { data: [statusAt(1)], paging: { total: 3 } },
        });

      const result = await getAllPipelineStatuses('svc.pipeline', {
        endTs: 10,
        startTs: 0,
      });

      expect(result.map((status) => status.timestamp)).toEqual([3, 2, 1]);
      expect(mockClient.get).toHaveBeenNthCalledWith(
        1,
        '/pipelines/svc.pipeline/status',
        { params: { after: undefined, endTs: 10, startTs: 0 } }
      );
      expect(mockClient.get).toHaveBeenNthCalledWith(
        2,
        '/pipelines/svc.pipeline/status',
        { params: { after: 'cursor-1', endTs: 10, startTs: 0 } }
      );
    });

    it('makes a single request when the first page is the whole range', async () => {
      mockClient.get.mockResolvedValueOnce({
        data: { data: [statusAt(1)], paging: { total: 1 } },
      });

      const result = await getAllPipelineStatuses('svc.pipeline', {
        endTs: 10,
        startTs: 0,
      });

      expect(result).toHaveLength(1);
      expect(mockClient.get).toHaveBeenCalledTimes(1);
    });
  });
});
