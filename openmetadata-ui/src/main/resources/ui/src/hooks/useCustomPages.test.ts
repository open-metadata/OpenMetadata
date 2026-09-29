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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
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

const createWrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return Wrapper;
};

describe('useCustomPages', () => {
  let queryClient: QueryClient;

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
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    jest.clearAllMocks();
    mockUseApplicationStore.mockReturnValue({
      selectedPersona: mockSelectedPersona,
    });
  });

  it('should fetch and return customized page and navigation when persona is selected', async () => {
    mockGetDocumentByFQN.mockResolvedValue(mockDocument);

    const { result } = renderHook(() => useCustomPages(PageType.Table), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.customizedPage).toEqual(mockPage);
    });

    expect(mockGetDocumentByFQN).toHaveBeenCalledWith('persona.test-persona');
    expect(result.current.navigation).toEqual(mockNavigation);
  });

  it('should handle error when fetching document fails', async () => {
    mockGetDocumentByFQN.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useCustomPages(PageType.Table), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.navigation).toEqual([]);
    });

    expect(mockGetDocumentByFQN).toHaveBeenCalledWith('persona.test-persona');
    expect(result.current.customizedPage).toBeNull();
  });

  it('should not fetch document when no persona is selected', async () => {
    mockUseApplicationStore.mockReturnValue({
      selectedPersona: null,
    });

    const { result } = renderHook(() => useCustomPages(PageType.Table), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockGetDocumentByFQN).not.toHaveBeenCalled();
    expect(result.current.customizedPage).toBeNull();
    expect(result.current.navigation).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should filter by pageType from cached doc without re-fetching', async () => {
    const mockDocWithMultiplePages: Document = {
      ...mockDocument,
      data: {
        pages: [
          { pageType: PageType.Table, tabs: [] },
          { pageType: PageType.Dashboard, tabs: [] },
        ],
        navigation: mockNavigation,
      },
    };
    mockGetDocumentByFQN.mockResolvedValue(mockDocWithMultiplePages);

    const { result, rerender } = renderHook(
      ({ pageType }: { pageType: PageType }) => useCustomPages(pageType),
      {
        initialProps: { pageType: PageType.Table },
        wrapper: createWrapper(queryClient),
      }
    );

    await waitFor(() => {
      expect(result.current.customizedPage?.pageType).toBe(PageType.Table);
    });

    // Changing pageType filters locally from the cached doc — no extra network request.
    expect(mockGetDocumentByFQN).toHaveBeenCalledTimes(1);

    rerender({ pageType: PageType.Dashboard });

    expect(mockGetDocumentByFQN).toHaveBeenCalledTimes(1);
    expect(result.current.customizedPage?.pageType).toBe(PageType.Dashboard);
  });

  it('should remove null pages before caching a legacy persona document', async () => {
    const legacyDocument = {
      ...mockDocument,
      data: {
        ...mockDocument.data,
        pages: [null, mockPage],
      },
    } as Document;
    mockGetDocumentByFQN.mockResolvedValue(legacyDocument);

    const { result } = renderHook(() => useCustomPages(PageType.Table), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.customizedPage).toEqual(mockPage);
    });

    expect(
      queryClient.getQueryData(['docStore', 'persona.test-persona'])
    ).toEqual({
      ...legacyDocument,
      data: {
        ...legacyDocument.data,
        pages: [mockPage],
      },
    });
  });

  it('should return updated results when selected persona changes', async () => {
    mockGetDocumentByFQN.mockResolvedValueOnce(mockDocument);

    const { result, rerender } = renderHook(
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
        wrapper: createWrapper(queryClient),
      }
    );

    await waitFor(() => {
      expect(result.current.customizedPage).toEqual(mockDocument.data.pages[0]);
    });

    expect(mockGetDocumentByFQN).toHaveBeenCalledWith('persona.test-persona');
    expect(result.current.navigation).toEqual(mockDocument.data.navigation);

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

    await waitFor(() => {
      expect(result.current.customizedPage).toEqual({
        pageType: PageType.Table,
        content: 'New Content',
      });
    });

    expect(mockGetDocumentByFQN).toHaveBeenCalledWith('persona.new-persona');
    expect(result.current.navigation).toEqual([{ name: 'New Navigation' }]);
  });
});
