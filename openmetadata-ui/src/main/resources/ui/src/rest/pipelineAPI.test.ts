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
import { MAX_PIPELINE_STATUS_PAGE_SIZE } from '../constants/pipeline.constants';
import { StatusType } from '../generated/entity/data/pipeline';
import APIClient from './axiosClient';
import { getAllPipelineStatuses } from './pipelineAPI';

jest.mock('./axiosClient', () => ({
  get: jest.fn(),
}));

const STATUS_URL = '/pipelines/service.pipeline/status';

const statusPage = (length: number, after?: string) => ({
  data: {
    data: Array.from({ length }, (_, index) => ({
      executionStatus: StatusType.Successful,
      timestamp: index,
    })),
    paging: { after, total: length },
  },
});

describe('getAllPipelineStatuses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('follows the after cursor until a page comes back short', async () => {
    (APIClient.get as jest.Mock)
      .mockResolvedValueOnce(statusPage(MAX_PIPELINE_STATUS_PAGE_SIZE, 'older'))
      .mockResolvedValueOnce(statusPage(3, 'oldest'));
    const { signal } = new AbortController();

    const statuses = await getAllPipelineStatuses(
      'service.pipeline',
      { endTs: 2, startTs: 1 },
      signal
    );

    expect(statuses).toHaveLength(MAX_PIPELINE_STATUS_PAGE_SIZE + 3);
    expect(APIClient.get).toHaveBeenCalledTimes(2);
    expect(APIClient.get).toHaveBeenNthCalledWith(1, STATUS_URL, {
      params: {
        after: undefined,
        endTs: 2,
        limit: MAX_PIPELINE_STATUS_PAGE_SIZE,
        startTs: 1,
      },
      signal,
    });
    expect(APIClient.get).toHaveBeenNthCalledWith(2, STATUS_URL, {
      params: {
        after: 'older',
        endTs: 2,
        limit: MAX_PIPELINE_STATUS_PAGE_SIZE,
        startTs: 1,
      },
      signal,
    });
  });

  it('stops when a full page carries no cursor', async () => {
    (APIClient.get as jest.Mock).mockResolvedValueOnce(
      statusPage(MAX_PIPELINE_STATUS_PAGE_SIZE)
    );

    const statuses = await getAllPipelineStatuses('service.pipeline', {
      endTs: 2,
      startTs: 1,
    });

    expect(statuses).toHaveLength(MAX_PIPELINE_STATUS_PAGE_SIZE);
    expect(APIClient.get).toHaveBeenCalledTimes(1);
  });
});
