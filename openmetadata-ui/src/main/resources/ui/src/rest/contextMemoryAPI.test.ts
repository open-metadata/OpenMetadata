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
import {
  getContextMemoryByName,
  getMemoryDerivations,
  MAX_DERIVATION_ENTITIES,
} from './contextMemoryAPI';

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

  it('asks for the derivations of at most the ids the server reads', async () => {
    const derivation = {
      entity: { id: 'term-1', type: 'glossaryTerm' },
      memory: { id: 'memory-1', type: 'contextMemory' },
      evidence: { confidence: 0.92, reasons: ['Defines a metric'] },
    };
    mockedApiClient.get.mockResolvedValue({ data: { data: [derivation] } });
    const ids = Array.from(
      { length: MAX_DERIVATION_ENTITIES + 5 },
      (_, index) => `term-${index}`
    );

    expect(await getMemoryDerivations('glossaryTerm', ids)).toEqual([
      derivation,
    ]);
    expect(mockedApiClient.get).toHaveBeenCalledWith(
      '/contextCenter/memories/derivations',
      {
        params: {
          entityType: 'glossaryTerm',
          entityIds: ids.slice(0, MAX_DERIVATION_ENTITIES).join(','),
        },
      }
    );
  });

  it('does not call the server without ids', async () => {
    mockedApiClient.get.mockClear();

    expect(await getMemoryDerivations('glossaryTerm', [])).toEqual([]);
    expect(mockedApiClient.get).not.toHaveBeenCalled();
  });
});
