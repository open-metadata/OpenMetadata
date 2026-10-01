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
import { getContextMemoryByName } from './contextMemoryAPI';

jest.mock('./axiosClient', () => ({ get: jest.fn() }));

const mockedApiClient = APIClient as jest.Mocked<typeof APIClient>;

describe('contextMemoryAPI', () => {
  it('resolves a file-derived memory by its quoted FQN', async () => {
    const memory = { id: 'memory-id', name: 'metrics.md-f02e2a5c' };
    mockedApiClient.get.mockResolvedValue({ data: memory });

    expect(await getContextMemoryByName(memory.name, 'owners')).toEqual(memory);
    expect(mockedApiClient.get).toHaveBeenCalledWith(
      '/contextCenter/memories/name/%22metrics.md-f02e2a5c%22',
      { params: { fields: 'owners' } }
    );
  });
});
