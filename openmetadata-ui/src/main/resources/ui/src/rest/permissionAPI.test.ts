/*
 *  Copyright 2022 Collate.
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

import { ResourceEntity } from '../enums/permissions.enum';
import APIClient from './axiosClient';
import { getEntityPermissionById } from './permissionAPI';

jest.mock('./axiosClient', () => ({ get: jest.fn() }));
const get = APIClient.get as jest.MockedFunction<typeof APIClient.get>;

beforeEach(() => {
  get.mockClear();
  get.mockResolvedValue({ data: { resource: 'ontology', permissions: [] } });
});

it('preserves the existing permission request when no cancellation signal is supplied', async () => {
  await expect(
    getEntityPermissionById(ResourceEntity.ONTOLOGY, 'owner')
  ).resolves.toEqual({ resource: 'ontology', permissions: [] });
  expect(get).toHaveBeenCalledWith('/permissions/ontology/owner');
});

it('forwards the account count cancellation signal to the HTTP request', async () => {
  const controller = new AbortController();
  await getEntityPermissionById(
    ResourceEntity.ONTOLOGY,
    'owner',
    controller.signal
  );

  expect(get).toHaveBeenCalledWith('/permissions/ontology/owner', {
    signal: controller.signal,
  });

  controller.abort();

  expect(get.mock.calls[0][1]?.signal?.aborted).toBe(true);
});
