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

import { Persona } from '../generated/entity/teams/persona';
import axiosClient from './index';
import { searchPersonas } from './PersonaAPI';

jest.mock('./index');

describe('PersonaAPI', () => {
  const mockClient = axiosClient as jest.Mocked<typeof axiosClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchPersonas', () => {
    it('queries the personas search endpoint and returns the data list', async () => {
      const personas = [{ id: 'p1', name: 'analyst' }] as Persona[];
      mockClient.get.mockResolvedValue({
        data: { data: personas, paging: { total: 1 } },
      });

      const result = await searchPersonas('ana', 50);

      expect(mockClient.get).toHaveBeenCalledWith('/personas/search', {
        params: { q: 'ana', limit: 50, offset: 0 },
      });
      expect(result).toEqual(personas);
    });

    it('omits the q param for an empty query and defaults the limit', async () => {
      mockClient.get.mockResolvedValue({
        data: { data: [], paging: { total: 0 } },
      });

      await searchPersonas('');

      expect(mockClient.get).toHaveBeenCalledWith('/personas/search', {
        params: { q: undefined, limit: 25, offset: 0 },
      });
    });
  });
});
