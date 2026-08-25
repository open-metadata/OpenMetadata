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
import { ReactNode } from 'react';
import { LeftSidebarItem } from '../components/MyData/LeftSidebar/LeftSidebar.interface';
import { useApplicationsProvider } from '../components/Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { AppPlugin } from '../components/Settings/Applications/plugins/AppPlugin';
import { NavigationItem } from '../generated/system/ui/uiCustomization';
import { filterHiddenNavigationItems } from '../utils/CustomizaNavigation/CustomizeNavigation';
import { useCustomPages } from './useCustomPages';
import { useSidebarItems } from './useSidebarItems';

const mockUseCustomPages = useCustomPages as jest.MockedFunction<
  typeof useCustomPages
>;
const mockUseApplicationsProvider =
  useApplicationsProvider as jest.MockedFunction<
    typeof useApplicationsProvider
  >;
const mockFilterHiddenNavigationItems =
  filterHiddenNavigationItems as jest.MockedFunction<
    typeof filterHiddenNavigationItems
  >;

jest.mock('./useCustomPages', () => ({
  useCustomPages: jest.fn(),
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

describe('useSidebarItems', () => {
  const mockNavigationItems: NavigationItem[] = [
    {
      id: 'explore',
      title: 'Explore',
      isHidden: false,
      pageId: 'test-page',
      children: [
        {
          id: 'tables',
          pageId: 'test-page',
          title: 'Tables',
          isHidden: false,
        },
        {
          id: 'topics',
          pageId: 'test-page-',
          title: 'Topics',
          isHidden: false,
        },
      ],
    },
    {
      id: 'glossary',
      pageId: 'test-page',
      title: 'Glossary',
      isHidden: false,
    },
  ];

  const mockSidebarItems: LeftSidebarItem[] = [
    {
      key: 'explore',
      title: 'Explore',
      dataTestId: 'explore',
      icon: () => ({} as ReactNode),
      children: [
        {
          key: 'tables',
          dataTestId: 'tables',
          title: 'Tables',
          icon: () => ({} as ReactNode),
        },
        {
          key: 'topics',
          dataTestId: 'topics',
          title: 'Topics',
          icon: () => ({} as ReactNode),
        },
      ],
    },
    {
      key: 'glossary',
      dataTestId: 'glossary',
      title: 'Glossary',
      icon: () => ({} as ReactNode),
    },
  ];

  const mockPlugins: AppPlugin[] = [
    {
      name: 'test-plugin',
      getSidebarActions: jest.fn(() => [
        {
          key: 'plugin-item',
          title: 'Plugin Item',
          icon: {} as ReactNode,
          index: 0,
        },
      ]),
    } as unknown as AppPlugin,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCustomPages.mockReturnValue({
      navigation: mockNavigationItems,
      customizedPage: null,
      isLoading: false,
    });
    mockUseApplicationsProvider.mockReturnValue({
      plugins: [],
      applications: [],
      extensionRegistry: {} as never,
    });
    mockFilterHiddenNavigationItems.mockReturnValue(mockSidebarItems);
  });

  it('should return filtered sidebar items with navigation and empty plugins', () => {
    const { result } = renderHook(() => useSidebarItems());

    expect(mockUseCustomPages).toHaveBeenCalledWith('Navigation');
    expect(mockUseApplicationsProvider).toHaveBeenCalled();
    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledWith(
      mockNavigationItems,
      []
    );
    expect(result.current).toEqual(mockSidebarItems);
  });

  it('should pass plugins to filterHiddenNavigationItems when plugins are available', () => {
    mockUseApplicationsProvider.mockReturnValue({
      plugins: mockPlugins,
      applications: [],
      extensionRegistry: {} as never,
    });

    const { result } = renderHook(() => useSidebarItems());

    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledWith(
      mockNavigationItems,
      mockPlugins
    );
    expect(result.current).toEqual(mockSidebarItems);
  });

  it('should handle null navigation items', () => {
    mockUseCustomPages.mockReturnValue({
      navigation: null,
      customizedPage: null,
      isLoading: false,
    });

    const { result } = renderHook(() => useSidebarItems());

    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledWith(null, []);
    expect(result.current).toEqual(mockSidebarItems);
  });

  it('should handle undefined plugins', () => {
    mockUseApplicationsProvider.mockReturnValue({
      plugins: undefined as unknown as AppPlugin[],
      applications: [],
      extensionRegistry: {} as never,
    });

    const { result } = renderHook(() => useSidebarItems());

    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledWith(
      mockNavigationItems,
      []
    );
    expect(result.current).toEqual(mockSidebarItems);
  });

  it('should recalculate sidebar items when navigation changes', () => {
    const { rerender } = renderHook(() => useSidebarItems());

    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledTimes(1);

    const newNavigationItems: NavigationItem[] = [
      {
        id: 'settings',
        pageId: 'settings-page',
        title: 'Settings',
        isHidden: false,
      },
    ];
    mockUseCustomPages.mockReturnValue({
      navigation: newNavigationItems,
      customizedPage: null,
      isLoading: false,
    });

    rerender();

    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledTimes(2);
    expect(mockFilterHiddenNavigationItems).toHaveBeenLastCalledWith(
      newNavigationItems,
      []
    );
  });

  it('should recalculate sidebar items when plugins change', () => {
    const { rerender } = renderHook(() => useSidebarItems());

    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledTimes(1);

    mockUseApplicationsProvider.mockReturnValue({
      plugins: mockPlugins,
      applications: [],
      extensionRegistry: {} as never,
    });

    rerender();

    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledTimes(2);
    expect(mockFilterHiddenNavigationItems).toHaveBeenLastCalledWith(
      mockNavigationItems,
      mockPlugins
    );
  });

  it('should memoize result when navigation and plugins do not change', () => {
    const { result, rerender } = renderHook(() => useSidebarItems());

    const firstResult = result.current;

    rerender();

    expect(result.current).toBe(firstResult);
    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledTimes(1);
  });

  it('should handle empty navigation array', () => {
    mockUseCustomPages.mockReturnValue({
      navigation: [],
      customizedPage: null,
      isLoading: false,
    });

    const { result } = renderHook(() => useSidebarItems());

    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledWith([], []);
    expect(result.current).toEqual(mockSidebarItems);
  });

  it('should handle multiple plugins', () => {
    const multiplePlugins: AppPlugin[] = [
      {
        name: 'plugin-1',
        getSidebarActions: jest.fn(() => [
          {
            key: 'plugin-1-item',
            title: 'Plugin 1 Item',
            icon: {} as ReactNode,
            index: 0,
          },
        ]),
      } as unknown as AppPlugin,
      {
        name: 'plugin-2',
        getSidebarActions: jest.fn(() => [
          {
            key: 'plugin-2-item',
            title: 'Plugin 2 Item',
            icon: {} as ReactNode,
            index: 1,
          },
        ]),
      } as unknown as AppPlugin,
    ];

    mockUseApplicationsProvider.mockReturnValue({
      plugins: multiplePlugins,
      applications: [],
      extensionRegistry: {} as never,
    });

    const { result } = renderHook(() => useSidebarItems());

    expect(mockFilterHiddenNavigationItems).toHaveBeenCalledWith(
      mockNavigationItems,
      multiplePlugins
    );
    expect(result.current).toEqual(mockSidebarItems);
  });
});
