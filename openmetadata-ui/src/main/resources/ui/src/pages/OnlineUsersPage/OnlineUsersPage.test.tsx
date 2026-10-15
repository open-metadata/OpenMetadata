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

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { User } from '../../generated/entity/teams/user';
import { getOnlineUsers } from '../../rest/userAPI';
import OnlineUsersPage from './OnlineUsersPage';

const mockUseAuth = jest.fn();

jest.mock('../../hooks/authHooks', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../rest/userAPI', () => ({
  getOnlineUsers: jest.fn(),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn(({ children }) => <div>{children}</div>)
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn(() => null)
);

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn(() => <div data-testid="permission-placeholder" />)
);

jest.mock('../../utils/Users.util', () => ({
  commonUserDetailColumns: () => [
    { title: 'label.username', dataIndex: 'name', key: 'username' },
    { title: 'label.name', dataIndex: 'displayName', key: 'name' },
    { title: 'label.team-plural', dataIndex: 'teams', key: 'teams' },
    { title: 'label.role-plural', dataIndex: 'roles', key: 'roles' },
  ],
}));

jest.mock('../../components/common/Table/TableV2', () =>
  jest.fn(
    ({
      columns,
      dataSource,
      extraTableFilters,
      'data-testid': testId,
    }: {
      columns: {
        key: string;
        title: string;
        dataIndex: keyof User;
        render?: (value: unknown, record: User) => ReactNode;
      }[];
      dataSource: User[];
      extraTableFilters: ReactNode;
      'data-testid': string;
    }) => (
      <div data-testid={testId}>
        {extraTableFilters}
        {columns.map((col) => (
          <span key={col.key} role="columnheader">
            {col.title}
          </span>
        ))}
        {dataSource.map((record) => (
          <div data-testid={`row-${record.name}`} key={record.id}>
            {columns.map((col) => (
              <span key={col.key}>
                {col.render
                  ? col.render(record[col.dataIndex], record)
                  : String(record[col.dataIndex] ?? '')}
              </span>
            ))}
          </div>
        ))}
      </div>
    )
  )
);

const mockGetOnlineUsers = getOnlineUsers as jest.Mock;

const renderPage = () =>
  render(
    <MemoryRouter>
      <OnlineUsersPage />
    </MemoryRouter>
  );
const MINUTE = 60 * 1000;

const user = (name: string, minutesAgo?: number): User =>
  ({
    id: name,
    name,
    email: `${name}@example.com`,
    lastActivityTime:
      minutesAgo === undefined ? undefined : Date.now() - minutesAgo * MINUTE,
  } as User);

describe('OnlineUsersPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ isAdminUser: true });
    mockGetOnlineUsers.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows the online users table with its columns and the last 24 hours by default', async () => {
    renderPage();

    expect(await screen.findByTestId('online-users-page')).toBeInTheDocument();
    expect(screen.getByText('label.online-user-plural')).toBeInTheDocument();

    [
      'label.username',
      'label.last-activity',
      'label.team-plural',
      'label.role-plural',
    ].forEach((header) =>
      expect(
        screen.getByRole('columnheader', { name: header })
      ).toBeInTheDocument()
    );

    expect(screen.getByText('label.time-window:')).toBeInTheDocument();
    expect(screen.getByTestId('time-window-select')).toHaveTextContent(
      'label.last-24-hours'
    );

    await waitFor(() =>
      expect(mockGetOnlineUsers).toHaveBeenCalledWith(
        expect.objectContaining({ timeWindow: 1440 })
      )
    );
  });

  it('refetches with the selected time window', async () => {
    renderPage();

    await waitFor(() => expect(mockGetOnlineUsers).toHaveBeenCalled());

    fireEvent.click(
      within(screen.getByTestId('time-window-select')).getByRole('button')
    );
    fireEvent.click(
      await screen.findByRole('option', { name: 'label.last-hour' })
    );

    await waitFor(() =>
      expect(mockGetOnlineUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ timeWindow: 60 })
      )
    );

    expect(screen.getByTestId('time-window-select')).toHaveTextContent(
      'label.last-hour'
    );
  });

  it.each([
    ['online-now', 2, 'label.online-now'],
    ['minutes', 30, 'label.n-minutes-ago'],
    ['hours', 3 * 60, 'label.n-hours-ago'],
    ['days', 3 * 24 * 60, 'label.n-days-ago'],
  ])(
    'formats the last activity of a user active %s ago',
    async (name, minutesAgo, label) => {
      mockGetOnlineUsers.mockResolvedValue({
        data: [user(name, minutesAgo)],
        paging: { total: 1 },
      });

      renderPage();

      expect(await screen.findByTestId(`row-${name}`)).toHaveTextContent(label);
    }
  );

  it('shows "never" for a user with no recorded activity', async () => {
    mockGetOnlineUsers.mockResolvedValue({
      data: [user('idle')],
      paging: { total: 1 },
    });

    renderPage();

    expect(await screen.findByTestId('row-idle')).toHaveTextContent(
      'label.never'
    );
  });

  it('blocks non-admins without asking for online users', () => {
    mockUseAuth.mockReturnValue({ isAdminUser: false });

    renderPage();

    expect(screen.getByTestId('permission-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('online-users-page')).not.toBeInTheDocument();
    expect(mockGetOnlineUsers).not.toHaveBeenCalled();
  });
});
