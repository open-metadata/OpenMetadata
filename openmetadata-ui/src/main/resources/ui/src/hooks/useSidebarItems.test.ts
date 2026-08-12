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
import { renderHook } from '@testing-library/react-hooks';
import React, { ReactNode } from 'react';
import { useApplicationsProvider } from '../components/Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { AppPlugin } from '../components/Settings/Applications/plugins/AppPlugin';
import { NavigationItem } from '../generated/system/ui/uiCustomization';
import { getDocumentByFQN } from '../rest/DocStoreAPI';
import { filterHiddenNavigationItems } from '../utils/CustomizaNavigation/CustomizeNavigation';
import { useApplicationStore } from './useApplicationStore';
import { useSidebarItems } from './useSidebarItems';

const mockUseApplicationStore = useApplicationStore as jest.MockedFunction<
  typeof useApplicationStore
>;
const mockUseApplicationsProvider =
  useApplicationsProvider as jest.MockedFunction<typeof useApplicationsProvider>;
const mockFilterHiddenNavigationItems =
  filterHiddenNavigationItems as jest.MockedFunction<
    typeof filterHiddenNavigationItems
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

jest.mock(
  '../components/Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: jest.fn(),
  })
);

jest.mock('../utils/CustomizaNavigation/CustomizeNavigation', () => ({
  filterHiddenNavigationItems: jest.fn(),
}));

const mockPersona = { fullyQualifiedName: 'test-persona' };

const mockNavigationItems: NavigationItem[] = [
  {
    id: 'explore',
    title: 'Explore',
    isHidden: false,
    pageId: 'test-page',
    children: [
      { id: 'tables', pageId: 'test-page', title: 'Tables', isHidden: false },
      { id: 'topics', pageId: 'test-page-', title: 'Topics', isHidden: false },
    ],
  },
  { id: 'glossary', pageId: 'test-page', title: 'Glossary', isHidden: false },
];

const mockDocument = {
  name: 'test-persona',
  fullyQualifiedName: 'persona.test-persona',
  entityType: 'PERSONA',
  data: { navigation: mockNavigationItems },
};

const mockSidebarItems = [
  {
    key: 'explore',
    title: 'Explore',
    dataTestId: 'explore',
    icon: () => ({} as ReactNode),
  },
];

const mockPlugins: AppPlugin[] = [
  {
    name: 'test-plugin',
    getSidebarActions: jest.fn(() => [
      { key: 'plugin-item', title: 'Plugin Item', icon: {} as ReactNode, index: 0 },
    ]),
  } as unknown as AppPlugin,
];

let queryClient: QueryClient;

const createWrapper = () => {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return Wrapper;
};

const mockDefaultProvider = () =>
  mockUseApplicationsProvider.mockReturnValue(
    { plugins: [], applications: [], extensionRegistry: {} } as unknown as ReturnType<
      typeof useApplicationsProvider
    >
  );

describe('useSidebarItems', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    jest.clearAllMocks();
    mockUseApplicationStore.mockReturnValue({ selectedPersona: mockPersona });
    mockGetDocumentByFQN.mockResolvedValue(mockDocument);
    mockDefaultProvider();
    mockFilterHiddenNavigationItems.mockReturnValue(mockSidebarItems as never);
  });

  it('should return filtered sidebar items with navigation and empty plugins', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useSidebarItems(), {
      wrapper: createWrapper(),
    });

    await waitForNextUpdate();

    expect(mockGetDocumentByFQN).toHaveBeenCalledWith('persona.test-persona');
    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledWith(
      mockNavigationItems,
      []
    );
    expect(result.current).toEqual(mockSidebarItems);
  });

  it('should pass plugins to filterHiddenNavigationItems when plugins are available', async () => {
    mockUseApplicationsProvider.mockReturnValue(
      { plugins: mockPlugins, applications: [], extensionRegistry: {} } as unknown as ReturnType<
        typeof useApplicationsProvider
      >
    );

    const { waitForNextUpdate } = renderHook(() => useSidebarItems(), {
      wrapper: createWrapper(),
    });

    await waitForNextUpdate();

    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledWith(
      mockNavigationItems,
      mockPlugins
    );
  });

  it('should handle null navigation when no persona is selected', () => {
    mockUseApplicationStore.mockReturnValue({ selectedPersona: null });

    renderHook(() => useSidebarItems(), { wrapper: createWrapper() });

    expect(mockGetDocumentByFQN).not.toHaveBeenCalled();
    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledWith(null, []);
  });

  it('should handle undefined plugins', () => {
    mockUseApplicationStore.mockReturnValue({ selectedPersona: null });
    mockUseApplicationsProvider.mockReturnValue(
      { plugins: undefined, applications: [], extensionRegistry: {} } as unknown as ReturnType<
        typeof useApplicationsProvider
      >
    );

    renderHook(() => useSidebarItems(), { wrapper: createWrapper() });

    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledWith(null, []);
  });

  it('should recalculate sidebar items when persona changes', async () => {
    const newPersona = { fullyQualifiedName: 'new-persona' };
    const newNavigation: NavigationItem[] = [
      { id: 'settings', pageId: 'settings-page', title: 'Settings', isHidden: false },
    ];
    mockGetDocumentByFQN
      .mockResolvedValueOnce(mockDocument)
      .mockResolvedValueOnce({ ...mockDocument, data: { navigation: newNavigation } });

    const { rerender, waitForNextUpdate } = renderHook(
      () => useSidebarItems(),
      { wrapper: createWrapper() }
    );

    await waitForNextUpdate();

    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledWith(
      mockNavigationItems,
      []
    );

    mockUseApplicationStore.mockReturnValue({ selectedPersona: newPersona });
    rerender();

    await waitForNextUpdate();

    expect(mockGetDocumentByFQN).toHaveBeenCalledWith('persona.new-persona');
    expect(mockFilterHiddenNavigationItems).toHaveBeenLastCalledWith(
      newNavigation,
      []
    );
  });

  it('should recalculate sidebar items when plugins change', async () => {
    const { rerender, waitForNextUpdate } = renderHook(
      () => useSidebarItems(),
      { wrapper: createWrapper() }
    );

    await waitForNextUpdate();

    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledTimes(1);

    mockUseApplicationsProvider.mockReturnValue(
      { plugins: mockPlugins, applications: [], extensionRegistry: {} } as unknown as ReturnType<
        typeof useApplicationsProvider
      >
    );
    rerender();

    expect(mockFilterHiddenNavigationItems).toHaveBeenLastCalledWith(
      mockNavigationItems,
      mockPlugins
    );
  });

  it('should memoize result when navigation and plugins do not change', async () => {
    const { result, rerender, waitForNextUpdate } = renderHook(
      () => useSidebarItems(),
      { wrapper: createWrapper() }
    );

    await waitForNextUpdate();

    const firstResult = result.current;

    rerender();

    expect(result.current).toBe(firstResult);
    expect(mockGetDocumentByFQN).toHaveBeenCalledTimes(1);
  });

  it('should handle empty navigation array', async () => {
    mockGetDocumentByFQN.mockResolvedValue({
      ...mockDocument,
      data: { navigation: [] },
    });

    const { waitForNextUpdate } = renderHook(() => useSidebarItems(), {
      wrapper: createWrapper(),
    });

    await waitForNextUpdate();

    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledWith([], []);
  });

  it('should handle multiple plugins', async () => {
    const multiplePlugins: AppPlugin[] = [
      {
        name: 'plugin-1',
        getSidebarActions: jest.fn(() => [
          { key: 'plugin-1-item', title: 'Plugin 1 Item', icon: {} as ReactNode, index: 0 },
        ]),
      } as unknown as AppPlugin,
      {
        name: 'plugin-2',
        getSidebarActions: jest.fn(() => [
          { key: 'plugin-2-item', title: 'Plugin 2 Item', icon: {} as ReactNode, index: 1 },
        ]),
      } as unknown as AppPlugin,
    ];

    mockUseApplicationsProvider.mockReturnValue(
      { plugins: multiplePlugins, applications: [], extensionRegistry: {} } as unknown as ReturnType<
        typeof useApplicationsProvider
      >
    );

    const { waitForNextUpdate } = renderHook(() => useSidebarItems(), {
      wrapper: createWrapper(),
    });

    await waitForNextUpdate();

    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledWith(
      mockNavigationItems,
      multiplePlugins
    );
  });
});
