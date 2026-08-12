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
import { renderHook } from '@testing-library/react-hooks';
import { Document } from '../generated/entity/docStore/document';
import { PageType } from '../generated/system/ui/page';
import { getDocumentByFQN } from '../rest/DocStoreAPI';
import { useApplicationStore } from './useApplicationStore';
import { useCustomPages } from './useCustomPages';

const mockUseApplicationStore = useApplicationStore as jest.MockedFunction<
  typeof useApplicationStore
>;
const mockGetDocumentByFQN = getDocumentByFQN as jest.MockedFunction<
  typeof getDocumentByFQN
>;

jest.mock('./useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

jest.mock('../rest/DocStoreAPI', () => ({
  getDocumentByFQN: jest.fn(),
}));

describe('useCustomPages', () => {
  const mockSelectedPersona = {
    fullyQualifiedName: 'test-persona',
  };

  const mockPage = {
    pageType: PageType.Table,
    tabs: [],
  };

  const mockNavigation = [
    {
      name: 'Test Navigation',
      path: '/test',
    },
  ];

  const mockDocument: Document = {
    entityType: 'PERSONA',
    fullyQualifiedName: 'PERSONA.test-persona',
    name: 'test-persona',
    data: {
      pages: [mockPage],
      navigation: mockNavigation,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseApplicationStore.mockReturnValue({
      selectedPersona: mockSelectedPersona,
    });
  });

  it('should fetch and return customized page and navigation when persona is selected', async () => {
    mockGetDocumentByFQN.mockResolvedValue(mockDocument);

    const { result, waitForNextUpdate } = renderHook(() =>
      useCustomPages(PageType.Table)
    );

    expect(result.current.isLoading).toBe(true);

    await waitForNextUpdate();

    expect(mockGetDocumentByFQN).toHaveBeenCalledWith('persona.test-persona');
    expect(result.current.customizedPage).toEqual(mockPage);
    expect(result.current.navigation).toEqual(mockNavigation);
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle error when fetching document fails', async () => {
    mockGetDocumentByFQN.mockRejectedValue(new Error('API Error'));

    const { result, waitForNextUpdate } = renderHook(() =>
      useCustomPages(PageType.Table)
    );

    expect(result.current.isLoading).toBe(true);

    await waitForNextUpdate();

    expect(mockGetDocumentByFQN).toHaveBeenCalledWith('persona.test-persona');
    expect(result.current.customizedPage).toBeNull();
    expect(result.current.navigation).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should not fetch document when no persona is selected', () => {
    mockUseApplicationStore.mockReturnValue({
      selectedPersona: null,
    });

    const { result } = renderHook(() => useCustomPages(PageType.Table));

    expect(mockGetDocumentByFQN).not.toHaveBeenCalled();
    expect(result.current.customizedPage).toBeNull();
    expect(result.current.navigation).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should refetch document when pageType changes', async () => {
    mockGetDocumentByFQN.mockResolvedValue(mockDocument);

    const { rerender, waitForNextUpdate } = renderHook(
      ({ pageType }) => useCustomPages(pageType),
      {
        initialProps: { pageType: PageType.Table },
      }
    );

    await waitForNextUpdate();

    expect(mockGetDocumentByFQN).toHaveBeenCalledTimes(1);

    rerender({ pageType: PageType.Dashboard });

    await waitForNextUpdate();

    expect(mockGetDocumentByFQN).toHaveBeenCalledTimes(2);
  });

  it('should return updated results when selected persona changes', async () => {
    mockGetDocumentByFQN.mockResolvedValueOnce(mockDocument);

    const { result, waitForNextUpdate, rerender } = renderHook(
      ({ selectedPersona }) => {
        mockUseApplicationStore.mockReturnValue({
          selectedPersona,
        });

        return useCustomPages(PageType.Table);
      },
      {
        initialProps: {
          selectedPersona: { fullyQualifiedName: 'test-persona' },
        },
      }
    );

    await waitForNextUpdate();

    expect(mockGetDocumentByFQN).toHaveBeenCalledWith('persona.test-persona');
    expect(result.current.customizedPage).toEqual(mockDocument.data.pages[0]);
    expect(result.current.navigation).toEqual(mockDocument.data.navigation);

    // Change the selected persona
    const newPersona = { fullyQualifiedName: 'new-persona' };
    mockGetDocumentByFQN.mockResolvedValueOnce({
      entityType: 'PERSONA',
      fullyQualifiedName: 'PERSONA.new-persona',
      name: 'new-persona',
      data: {
        pages: [{ pageType: PageType.Table, content: 'New Content' }],
        navigation: [{ name: 'New Navigation' }],
      },
    });

    rerender({ selectedPersona: newPersona });

    await waitForNextUpdate();

    expect(mockGetDocumentByFQN).toHaveBeenCalledWith('persona.new-persona');
    expect(result.current.customizedPage).toEqual({
      pageType: PageType.Table,
      content: 'New Content',
    });
    expect(result.current.navigation).toEqual([{ name: 'New Navigation' }]);
  });
});
