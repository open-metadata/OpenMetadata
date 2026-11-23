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

import axios from 'axios';
import APIClient from './axiosClient';
import { exportDatabaseSchemaDetailsInCSV } from './databaseAPI';

jest.mock('./axiosClient', () => ({ get: jest.fn() }));

describe('exportDatabaseSchemaDetailsInCSV', () => {
  it.each([
    [{ recursive: true }, 'recursive=true'],
    [
      { recursive: false, entityTypes: 'table' as const },
      'recursive=false&entityTypes=table',
    ],
    [
      { recursive: true, entityTypes: 'storedProcedure' as const },
      'recursive=true&entityTypes=storedProcedure',
    ],
  ])('serializes the scoped schema export query', async (params, query) => {
    const job = { jobId: '17', message: 'Queued' };
    (APIClient.get as jest.Mock).mockResolvedValue({ data: job });

    await expect(
      exportDatabaseSchemaDetailsInCSV(
        'service.database."customer orders"',
        params
      )
    ).resolves.toEqual(job);

    const [url, options] = (APIClient.get as jest.Mock).mock.calls.at(-1);

    expect(axios.getUri({ url, ...options })).toBe(
      `databaseSchemas/name/service.database.%22customer%20orders%22/exportAsync?${query}`
    );
  });
});
