/*
 *  Copyright 2025 Collate.
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

import { renderHook, waitFor } from '@testing-library/react';
import { EntityType } from '../enums/entity.enum';
import {
  getAllCustomProperties,
  getFieldsForEntity,
} from '../rest/metadataTypeAPI';
import { useEntityFields } from './useEntityFields';

// Factory mock so the real module (and its axios/APIClient graph) is never loaded.
jest.mock('../rest/metadataTypeAPI', () => ({
  getFieldsForEntity: jest.fn(),
  getAllCustomProperties: jest.fn(),
}));

const mockGetFieldsForEntity = getFieldsForEntity as jest.Mock;
const mockGetAllCustomProperties = getAllCustomProperties as jest.Mock;

describe('useEntityFields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefixes a type’s custom properties with extension. and leaves standard fields bare', async () => {
    mockGetFieldsForEntity.mockResolvedValue([
      { name: 'description', type: 'string' },
      { name: 'HyperLinkTest', type: 'string' },
    ]);
    mockGetAllCustomProperties.mockResolvedValue({
      [EntityType.TABLE]: [{ name: 'HyperLinkTest', type: 'string' }],
    });

    // Stable reference: the hook's effect depends on entityTypes identity, so a new
    // array literal per render would loop.
    const entityTypes = [EntityType.TABLE];
    const { result } = renderHook(() => useEntityFields(entityTypes));

    await waitFor(() =>
      expect(result.current.fieldOptions).toEqual([
        'description',
        'extension.HyperLinkTest',
      ])
    );

    expect(mockGetAllCustomProperties).toHaveBeenCalledTimes(1);
  });

  it('builds options per entity type so a custom property on one type does not hide a same-named standard field on another', async () => {
    mockGetFieldsForEntity.mockImplementation((entityType: EntityType) =>
      entityType === EntityType.TABLE
        ? Promise.resolve([{ name: 'X', type: 'string' }])
        : Promise.resolve([{ name: 'X', type: 'string' }])
    );
    mockGetAllCustomProperties.mockResolvedValue({
      // X is a custom property only on dashboard; on table X is a standard field.
      [EntityType.DASHBOARD]: [{ name: 'X', type: 'string' }],
    });

    const entityTypes = [EntityType.TABLE, EntityType.DASHBOARD];
    const { result } = renderHook(() => useEntityFields(entityTypes));

    await waitFor(() =>
      expect(result.current.fieldOptions).toEqual(['X', 'extension.X'])
    );
  });

  it('falls back to bare names when custom properties cannot be fetched', async () => {
    mockGetFieldsForEntity.mockResolvedValue([
      { name: 'HyperLinkTest', type: 'string' },
    ]);
    mockGetAllCustomProperties.mockRejectedValue(new Error('boom'));

    const entityTypes = [EntityType.TABLE];
    const { result } = renderHook(() => useEntityFields(entityTypes));

    await waitFor(() =>
      expect(result.current.fieldOptions).toEqual(['HyperLinkTest'])
    );

    expect(result.current.error).toBeNull();
  });

  it('returns no options when no entity types are provided', async () => {
    const entityTypes: EntityType[] = [];
    const { result } = renderHook(() => useEntityFields(entityTypes));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.fieldOptions).toEqual([]);
    expect(mockGetFieldsForEntity).not.toHaveBeenCalled();
  });
});
