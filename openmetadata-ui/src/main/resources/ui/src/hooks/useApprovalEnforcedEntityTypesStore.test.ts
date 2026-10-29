/*
 *  Copyright 2024 Collate.
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
import { getApprovalEnforcedEntityTypes } from '../rest/metadataTypeAPI';
import { useApprovalEnforcedEntityTypesStore } from './useApprovalEnforcedEntityTypesStore';

jest.mock('../rest/metadataTypeAPI', () => ({
  getApprovalEnforcedEntityTypes: jest.fn(),
}));

const mockGetTypes = getApprovalEnforcedEntityTypes as jest.Mock;
const store = () => useApprovalEnforcedEntityTypesStore.getState();

describe('useApprovalEnforcedEntityTypesStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTypes.mockResolvedValue(['glossary', 'table']);
    useApprovalEnforcedEntityTypesStore.setState({
      entityTypes: undefined,
      isLoading: false,
    });
  });

  it('reads the gated types once for every caller', async () => {
    await Promise.all([store().fetchEntityTypes(), store().fetchEntityTypes()]);
    await store().fetchEntityTypes();

    expect(store().entityTypes).toEqual(['glossary', 'table']);
    expect(mockGetTypes).toHaveBeenCalledTimes(1);
  });

  it('leaves them unread after a failed read, so the next caller reads again', async () => {
    mockGetTypes.mockRejectedValueOnce(new Error('unavailable'));

    await store().fetchEntityTypes();

    expect(store().entityTypes).toBeUndefined();
    expect(store().isLoading).toBe(false);

    await store().fetchEntityTypes();

    expect(store().entityTypes).toEqual(['glossary', 'table']);
  });

  it('reads them again after a workflow change invalidates them', async () => {
    await store().fetchEntityTypes();
    mockGetTypes.mockResolvedValue(['glossary']);

    store().invalidate();
    await store().fetchEntityTypes();

    expect(store().entityTypes).toEqual(['glossary']);
    expect(mockGetTypes).toHaveBeenCalledTimes(2);
  });
});
