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

import { AxiosError, AxiosHeaders } from 'axios';
import { Type } from '../generated/entity/type';
import axiosClient from './axiosClient';
import { deleteCustomPropertyByName } from './metadataTypeAPI';

jest.mock('./axiosClient');

const TYPE_ID = 'type-id';

const typeWith = (...names: string[]) =>
  ({
    id: TYPE_ID,
    name: 'table',
    customProperties: names.map((name) => ({
      name,
      propertyType: { id: 'string-id', type: 'type' },
    })),
  } as Type);

const httpError = (status: number) =>
  new AxiosError('Request failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {},
  });

const guardedRemove = (index: number, name: string) => [
  { op: 'test', path: `/customProperties/${index}/name`, value: name },
  { op: 'remove', path: `/customProperties/${index}` },
];

describe('deleteCustomPropertyByName', () => {
  const mockClient = axiosClient as jest.Mocked<typeof axiosClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('removes the property at its index in a freshly fetched copy, guarded by a test op', async () => {
    const remaining = typeWith('a', 'c');
    mockClient.get.mockResolvedValue({ data: typeWith('a', 'b', 'c') });
    mockClient.patch.mockResolvedValue({ data: remaining });

    const result = await deleteCustomPropertyByName('table', 'b');

    expect(mockClient.get).toHaveBeenCalledWith('/metadata/types/name/table', {
      params: { fields: 'customProperties' },
    });
    expect(mockClient.patch).toHaveBeenCalledWith(
      `/metadata/types/${TYPE_ID}`,
      guardedRemove(1, 'b')
    );
    expect(result).toBe(remaining);
  });

  it('rebuilds the patch from a fresh copy when the list shifted and the guard rejected it', async () => {
    mockClient.get
      .mockResolvedValueOnce({ data: typeWith('a', 'b') })
      .mockResolvedValueOnce({ data: typeWith('a', 'new', 'b') });
    mockClient.patch
      .mockRejectedValueOnce(httpError(400))
      .mockResolvedValueOnce({ data: typeWith('a', 'new') });

    await deleteCustomPropertyByName('table', 'b');

    expect(mockClient.patch).toHaveBeenNthCalledWith(
      1,
      `/metadata/types/${TYPE_ID}`,
      guardedRemove(1, 'b')
    );
    expect(mockClient.patch).toHaveBeenNthCalledWith(
      2,
      `/metadata/types/${TYPE_ID}`,
      guardedRemove(2, 'b')
    );
  });

  it('returns the current type without patching when the property is already gone', async () => {
    const current = typeWith('a');
    mockClient.get.mockResolvedValue({ data: current });

    const result = await deleteCustomPropertyByName('table', 'b');

    expect(mockClient.patch).not.toHaveBeenCalled();
    expect(result).toBe(current);
  });

  it('does not retry an error other than a rejected patch', async () => {
    const forbidden = httpError(403);
    mockClient.get.mockResolvedValue({ data: typeWith('a', 'b') });
    mockClient.patch.mockRejectedValue(forbidden);

    await expect(deleteCustomPropertyByName('table', 'b')).rejects.toBe(
      forbidden
    );
    expect(mockClient.patch).toHaveBeenCalledTimes(1);
  });

  it('gives up after three rejected attempts', async () => {
    const rejected = httpError(400);
    mockClient.get.mockResolvedValue({ data: typeWith('a', 'b') });
    mockClient.patch.mockRejectedValue(rejected);

    await expect(deleteCustomPropertyByName('table', 'b')).rejects.toBe(
      rejected
    );
    expect(mockClient.patch).toHaveBeenCalledTimes(3);
  });
});
