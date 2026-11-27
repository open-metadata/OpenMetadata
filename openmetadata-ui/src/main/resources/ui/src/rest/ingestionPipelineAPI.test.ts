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
import APIClient from './axiosClient';
import { getIngestionPipelineLogById } from './ingestionPipelineAPI';

jest.mock('./axiosClient', () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({ data: {} }) },
}));

describe('getIngestionPipelineLogById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the given run when a run id is passed', async () => {
    await getIngestionPipelineLogById('svc.agent', 'cursor', 'run/1');

    expect(APIClient.get).toHaveBeenCalledWith(
      '/services/ingestionPipelines/logs/svc.agent/run%2F1',
      { params: { after: 'cursor' } }
    );
  });

  it('reads the latest run when no run id is passed', async () => {
    await getIngestionPipelineLogById('svc.agent');

    expect(APIClient.get).toHaveBeenCalledWith(
      '/services/ingestionPipelines/logs/svc.agent/last',
      { params: { after: undefined } }
    );
  });
});
