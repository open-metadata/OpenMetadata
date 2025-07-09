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

import { render } from '@testing-library/react';
import { act } from 'react-test-renderer';
import { ROUTES } from '../../constants/constants';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
import { useTableFilters } from '../../hooks/useTableFilters';
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

jest.mock('../../rest/miscAPI', () => ({
  searchData: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: MOCK_USER_DATA,
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
      limit: 50,
    });
  });

  it('should call setFilters with deleted flag on clicking showDeleted switch', async () => {
    const { findByTestId } = render(<UserListPageV1 />);

    expect(getUsers).toHaveBeenCalledWith({
      fields: 'profile,teams,roles',
      include: 'non-deleted',
      isAdmin: false,
      isBot: false,
      limit: 50,
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
      limit: 50,
    });
  });

  it('should render searchbar', async () => {
    const { findByTestId } = render(<UserListPageV1 />);

    expect(getUsers).toHaveBeenCalledWith({
      fields: 'profile,teams,roles',
      include: 'non-deleted',
      isAdmin: false,
      isBot: false,
      limit: 50,
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
});
