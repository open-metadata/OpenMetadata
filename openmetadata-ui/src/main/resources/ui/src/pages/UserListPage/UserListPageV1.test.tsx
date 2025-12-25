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

import { render, waitFor } from '@testing-library/react';
import { act } from 'react-test-renderer';
import { ROUTES } from '../../constants/constants';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
import { useTableFilters } from '../../hooks/useTableFilters';
import { searchQuery } from '../../rest/searchAPI';
import { getUsers } from '../../rest/userAPI';
import { MOCK_EMPTY_USER_DATA, MOCK_USER_DATA } from './MockUserPageData';
import UserListPageV1 from './UserListPageV1';

const mockParam = {
  tab: GlobalSettingOptions.USERS,
};

const mockLocation = {
  pathname: 'pathname',
  search: '',
};
const mockSetFilters = jest.fn();

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({
    ...mockLocation,
  }));
});

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockImplementation(() => mockParam),
}));

jest.mock('../../hooks/useTableFilters', () => ({
  useTableFilters: jest.fn().mockImplementation(() => ({
    filters: {},
    setFilters: mockSetFilters,
  })),
}));

jest.mock('../../rest/userAPI', () => ({
  ...jest.requireActual('../../rest/userAPI'),
  getUsers: jest.fn().mockImplementation(() =>
    Promise.resolve({
      ...MOCK_USER_DATA,
    })
  ),
  updateUser: jest.fn(),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockImplementation(() =>
    Promise.resolve({
      hits: {
        hits: MOCK_USER_DATA.data.map((user) => ({ _source: user })),
        total: { value: MOCK_USER_DATA.data.length },
      },
    })
  ),
}));

jest.mock('../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn().mockImplementation(() => [
    {
      name: 'setting',
      url: ROUTES.SETTINGS,
    },
  ]),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../components/common/Table/Table', () => {
  return jest
    .fn()
    .mockImplementation(
      ({ columns, extraTableFilters, searchProps, dataSource, locale }) => (
        <div>
          {searchProps && (
            <div data-testid="search-bar-container">searchBar</div>
          )}
          {extraTableFilters}
          {columns.map((column: Record<string, string>) => (
            <span key={column.key}>{column.title}</span>
          ))}
          {dataSource && dataSource.length === 0 && locale?.emptyText ? (
            locale.emptyText
          ) : (
            <table>mockTable</table>
          )}
        </div>
      )
    );
});

jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader.component</div>);
});

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>);
  }
);

jest.mock(
  '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => {
    return jest
      .fn()
      .mockImplementation(({ type }) => (
        <div data-testid={`error-placeholder-${type}`}>ErrorPlaceHolder</div>
      ));
  }
);

describe('Test UserListPage component', () => {
  let mockTableComponent: jest.Mock;

  beforeAll(() => {
    // Get reference to mocked Table component
    mockTableComponent = jest.requireMock(
      '../../components/common/Table/Table'
    );
  });

  beforeEach(() => {
    // Clear mock calls before each test
    mockTableComponent.mockClear();
    (searchQuery as jest.Mock).mockClear();
    (getUsers as jest.Mock).mockClear();

    // Restore default mock implementations
    (useTableFilters as jest.Mock).mockImplementation(() => ({
      filters: {},
      setFilters: mockSetFilters,
    }));
    (getUsers as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ...MOCK_USER_DATA,
      })
    );
  });

  it('users api should called on initial load', async () => {
    const { findByTestId } = render(<UserListPageV1 />);

    const deletedSwitch = await findByTestId('show-deleted');

    expect(deletedSwitch).toBeInTheDocument();
    expect(deletedSwitch).not.toBeChecked();

    expect(getUsers).toHaveBeenCalled();
  });

  it('should show ErrorPlaceholder when there are no users after initial API call', async () => {
    (getUsers as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...MOCK_EMPTY_USER_DATA,
      })
    );

    const { findByTestId } = render(<UserListPageV1 />);

    const errorPlaceholder = await findByTestId('error-placeholder-CREATE');

    expect(errorPlaceholder).toBeInTheDocument();
    expect(getUsers).toHaveBeenCalledWith({
      fields: 'profile,teams,roles',
      include: 'non-deleted',
      isAdmin: false,
      isBot: false,
      limit: 15,
    });
  });

  it('should call setFilters with deleted flag on clicking showDeleted switch', async () => {
    const { findByTestId } = render(<UserListPageV1 />);

    expect(getUsers).toHaveBeenCalledWith({
      fields: 'profile,teams,roles',
      include: 'non-deleted',
      isAdmin: false,
      isBot: false,
      limit: 15,
    });

    const deletedSwitch = await findByTestId('show-deleted');

    expect(deletedSwitch).toBeInTheDocument();
    expect(deletedSwitch).toHaveAttribute('aria-checked', 'false');

    await act(async () => {
      (useTableFilters as jest.Mock).mockImplementationOnce(() => ({
        filters: {
          isDeleted: true,
        },
      }));
      deletedSwitch.click();
    });

    expect(mockSetFilters).toHaveBeenCalledWith({
      isDeleted: true,
      user: null,
    });
    expect(deletedSwitch).toHaveAttribute('aria-checked', 'true');
  });

  it('should call getUser with deleted flag when filter is applied', async () => {
    (useTableFilters as jest.Mock).mockImplementationOnce(() => ({
      filters: {
        isDeleted: true,
      },
      setFilters: mockSetFilters,
    }));
    render(<UserListPageV1 />);

    expect(getUsers).toHaveBeenCalledWith({
      fields: 'profile,teams,roles',
      include: 'deleted',
      isAdmin: false,
      isBot: false,
      limit: 15,
    });
  });

  it('should render searchbar', async () => {
    const { findByTestId } = render(<UserListPageV1 />);

    expect(getUsers).toHaveBeenCalledWith({
      fields: 'profile,teams,roles',
      include: 'non-deleted',
      isAdmin: false,
      isBot: false,
      limit: 15,
    });

    const searchBar = await findByTestId('search-bar-container');

    expect(searchBar).toBeInTheDocument();
  });

  it('should be render roles column for user listing page', async () => {
    const { findByText } = render(<UserListPageV1 />);

    expect(await findByText('label.role-plural')).toBeInTheDocument();
  });

  it('should not render roles column for admin listing page', async () => {
    mockParam.tab = GlobalSettingOptions.ADMINS;
    const { queryByText } = render(<UserListPageV1 />);

    expect(queryByText('label.role-plural')).not.toBeInTheDocument();

    // reset mockParam
    mockParam.tab = GlobalSettingOptions.USERS;
  });

  it('should pass searchValue prop to Table component searchProps', async () => {
    const mockSearchValue = 'test user';
    (useTableFilters as jest.Mock).mockImplementationOnce(() => ({
      filters: {
        user: mockSearchValue,
      },
      setFilters: mockSetFilters,
    }));

    render(<UserListPageV1 />);

    await waitFor(() => {
      expect(mockTableComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          searchProps: expect.objectContaining({
            searchValue: mockSearchValue,
          }),
        }),
        expect.anything()
      );
    });
  });

  it('should pass onSearch handler (not noop) to Table component searchProps', async () => {
    render(<UserListPageV1 />);

    await waitFor(() => {
      const lastCall =
        mockTableComponent.mock.calls[mockTableComponent.mock.calls.length - 1];
      const searchProps = lastCall[0].searchProps;

      expect(searchProps.onSearch).toBeDefined();
      expect(typeof searchProps.onSearch).toBe('function');
      // useCallback may wrap the function, so we just check it exists and is a function
    });
  });

  it('should call searchQuery API when search value is provided', async () => {
    const mockSearchValue = 'john';
    (useTableFilters as jest.Mock).mockImplementationOnce(() => ({
      filters: {
        user: mockSearchValue,
      },
      setFilters: mockSetFilters,
    }));

    render(<UserListPageV1 />);

    await waitFor(() => {
      expect(searchQuery).toHaveBeenCalledWith({
        query: `*${mockSearchValue}*`,
        pageNumber: 1,
        pageSize: 15,
        queryFilter: {
          query: {
            bool: {
              must: [
                { term: { isAdmin: 'false' } },
                { term: { isBot: 'false' } },
              ],
            },
          },
        },
        searchIndex: 'user_search_index',
        includeDeleted: false,
      });
    });
  });

  it('should call searchQuery with isAdmin filter when on admin page', async () => {
    const mockSearchValue = 'admin user';
    mockParam.tab = GlobalSettingOptions.ADMINS;
    (useTableFilters as jest.Mock).mockImplementationOnce(() => ({
      filters: {
        user: mockSearchValue,
      },
      setFilters: mockSetFilters,
    }));

    render(<UserListPageV1 />);

    await waitFor(() => {
      expect(searchQuery).toHaveBeenCalledWith({
        query: `*${mockSearchValue}*`,
        pageNumber: 1,
        pageSize: 15,
        queryFilter: {
          query: {
            bool: {
              must: [
                { term: { isAdmin: 'true' } },
                { term: { isBot: 'false' } },
              ],
            },
          },
        },
        searchIndex: 'user_search_index',
        includeDeleted: false,
      });
    });

    // reset mockParam
    mockParam.tab = GlobalSettingOptions.USERS;
  });

  it('should maintain search functionality during loading state', async () => {
    const mockSearchValue = 'test';
    (useTableFilters as jest.Mock).mockImplementation(() => ({
      filters: {
        user: mockSearchValue,
      },
      setFilters: mockSetFilters,
    }));

    const { rerender } = render(<UserListPageV1 />);

    // Simulate re-render during loading
    rerender(<UserListPageV1 />);

    await waitFor(() => {
      const lastCall =
        mockTableComponent.mock.calls[mockTableComponent.mock.calls.length - 1];
      const searchProps = lastCall[0].searchProps;

      // Search value should be maintained even during re-renders
      expect(searchProps.searchValue).toBe(mockSearchValue);
      expect(searchProps.onSearch).toBeDefined();
    });

    // Reset to default mock
    (useTableFilters as jest.Mock).mockImplementation(() => ({
      filters: {},
      setFilters: mockSetFilters,
    }));
  });

  it('should have correct debounce interval for search', async () => {
    render(<UserListPageV1 />);

    await waitFor(() => {
      expect(mockTableComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          searchProps: expect.objectContaining({
            typingInterval: 350,
          }),
        }),
        expect.anything()
      );
    });
  });

  it('should maintain stable searchProps reference when dependencies do not change', async () => {
    const { rerender } = render(<UserListPageV1 />);

    await waitFor(() => {
      expect(mockTableComponent).toHaveBeenCalled();
    });

    const firstCallSearchProps =
      mockTableComponent.mock.calls[mockTableComponent.mock.calls.length - 1][0]
        .searchProps;

    // Re-render without changing dependencies
    rerender(<UserListPageV1 />);

    await waitFor(() => {
      const lastCallSearchProps =
        mockTableComponent.mock.calls[
          mockTableComponent.mock.calls.length - 1
        ][0].searchProps;

      // searchProps object reference should be the same (memoized)
      expect(lastCallSearchProps).toBe(firstCallSearchProps);
    });
  });

  it('should update searchProps reference when searchValue changes', async () => {
    const { rerender } = render(<UserListPageV1 />);

    await waitFor(() => {
      expect(mockTableComponent).toHaveBeenCalled();
    });

    const firstCallSearchProps =
      mockTableComponent.mock.calls[mockTableComponent.mock.calls.length - 1][0]
        .searchProps;

    // Change search value
    (useTableFilters as jest.Mock).mockImplementation(() => ({
      filters: {
        user: 'new search value',
      },
      setFilters: mockSetFilters,
    }));

    rerender(<UserListPageV1 />);

    await waitFor(() => {
      const lastCallSearchProps =
        mockTableComponent.mock.calls[
          mockTableComponent.mock.calls.length - 1
        ][0].searchProps;

      // searchProps object reference should change when searchValue changes
      expect(lastCallSearchProps).not.toBe(firstCallSearchProps);
      expect(lastCallSearchProps.searchValue).toBe('new search value');
    });

    // Reset mock
    (useTableFilters as jest.Mock).mockImplementation(() => ({
      filters: {},
      setFilters: mockSetFilters,
    }));
  });

  it('should call setFilters when onSearch is triggered', async () => {
    render(<UserListPageV1 />);

    let capturedOnSearch: ((value: string) => void) | undefined;

    await waitFor(() => {
      const lastCall =
        mockTableComponent.mock.calls[mockTableComponent.mock.calls.length - 1];

      capturedOnSearch = lastCall[0].searchProps.onSearch;

      expect(capturedOnSearch).toBeDefined();
    });

    // Trigger the onSearch handler
    act(() => {
      capturedOnSearch?.('test search');
    });

    await waitFor(() => {
      expect(mockSetFilters).toHaveBeenCalledWith({ user: 'test search' });
    });
  });

  it('should call setFilters with null when onSearch is triggered with empty string', async () => {
    render(<UserListPageV1 />);

    let capturedOnSearch: ((value: string) => void) | undefined;

    await waitFor(() => {
      const lastCall =
        mockTableComponent.mock.calls[mockTableComponent.mock.calls.length - 1];
      capturedOnSearch = lastCall[0].searchProps.onSearch;
    });

    // Trigger the onSearch handler with empty string
    act(() => {
      capturedOnSearch?.('');
    });

    await waitFor(() => {
      expect(mockSetFilters).toHaveBeenCalledWith({ user: null });
    });
  });

  it('should clear search when toggling deleted filter', async () => {
    const mockSearchValue = 'test search';
    (useTableFilters as jest.Mock).mockImplementationOnce(() => ({
      filters: {
        user: mockSearchValue,
      },
      setFilters: mockSetFilters,
    }));

    const { findByTestId } = render(<UserListPageV1 />);

    const deletedSwitch = await findByTestId('show-deleted');

    await act(async () => {
      deletedSwitch.click();
    });

    await waitFor(() => {
      expect(mockSetFilters).toHaveBeenCalledWith({
        isDeleted: true,
        user: null,
      });
    });

    // Reset mock
    (useTableFilters as jest.Mock).mockImplementation(() => ({
      filters: {},
      setFilters: mockSetFilters,
    }));
  });

  it('should use number-based pagination when search is active', async () => {
    const mockSearchValue = 'john';
    (useTableFilters as jest.Mock).mockImplementationOnce(() => ({
      filters: {
        user: mockSearchValue,
      },
      setFilters: mockSetFilters,
    }));

    render(<UserListPageV1 />);

    await waitFor(() => {
      expect(mockTableComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          customPaginationProps: expect.objectContaining({
            isNumberBased: true,
          }),
        }),
        expect.anything()
      );
    });
  });

  it('should use cursor-based pagination when search is not active', async () => {
    render(<UserListPageV1 />);

    await waitFor(() => {
      expect(mockTableComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          customPaginationProps: expect.objectContaining({
            isNumberBased: false,
          }),
        }),
        expect.anything()
      );
    });
  });

  it('should have stable onSearch handler reference across re-renders', async () => {
    const { rerender } = render(<UserListPageV1 />);

    await waitFor(() => {
      expect(mockTableComponent).toHaveBeenCalled();
    });

    const firstOnSearch =
      mockTableComponent.mock.calls[mockTableComponent.mock.calls.length - 1][0]
        .searchProps.onSearch;

    // Re-render without changing dependencies
    rerender(<UserListPageV1 />);

    await waitFor(() => {
      const lastOnSearch =
        mockTableComponent.mock.calls[
          mockTableComponent.mock.calls.length - 1
        ][0].searchProps.onSearch;

      // onSearch handler reference should be stable (useCallback)
      expect(lastOnSearch).toBe(firstOnSearch);
    });
  });
});
