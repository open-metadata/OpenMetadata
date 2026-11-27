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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ReactElement } from 'react';
import { Include } from '../../../../../../generated/type/include';
import { getApplicationList } from '../../../../../../rest/applicationAPI';
import type { ApplicationsHeader } from './Applications.types';
import ApplicationsList from './ApplicationsList';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

let mockIsAdmin = true;

jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));

jest.mock('../../../../../../hoc/LimitWrapper', () =>
  jest.fn(({ children }) => children)
);

jest.mock('../../../../../../rest/applicationAPI', () => ({
  getApplicationList: jest.fn(),
}));

const apps = [
  {
    id: '1',
    name: 'SearchIndexingApplication',
    fullyQualifiedName: 'SearchIndexingApplication',
    displayName: 'Search Indexing',
    description: 'Index assets',
  },
  {
    id: '2',
    name: 'CacheWarmupApplication',
    fullyQualifiedName: 'CacheWarmupApplication',
    displayName: 'Cache Warmup',
    enabled: false,
  },
];

const onNavigate = jest.fn();
const onHeaderChange = jest.fn();

const renderList = async () => {
  const result = render(
    <ApplicationsList onHeaderChange={onHeaderChange} onNavigate={onNavigate} />
  );
  await act(async () => undefined);

  return result;
};

const renderHeaderActions = () => {
  const header: ApplicationsHeader = onHeaderChange.mock.calls.at(-1)[0];

  return render(header.actions as ReactElement);
};

describe('ApplicationsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdmin = true;
    (getApplicationList as jest.Mock).mockResolvedValue({
      data: apps,
      paging: { total: 2 },
    });
  });

  it('renders installed app cards with core-ui only', async () => {
    const { container } = await renderList();

    expect(
      screen.getByText('label.installed-application-plural')
    ).toBeVisible();
    expect(
      screen.getByTestId('search-indexing-application-card')
    ).toBeInTheDocument();
    expect(container.querySelector('[class*="ant-"]')).toBeNull();
  });

  it('marks a runtime-disabled app as unavailable', async () => {
    await renderList();

    expect(screen.getByTestId('cache-warmup-application-card')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('opens the app detail view on card click', async () => {
    await renderList();

    fireEvent.click(
      within(
        screen.getByTestId('search-indexing-application-card')
      ).getByTestId('config-btn')
    );

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'detail',
      fqn: 'SearchIndexingApplication',
    });
  });

  it('shows the empty state when nothing is installed', async () => {
    (getApplicationList as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    await renderList();

    expect(
      screen.getByText('message.no-installed-applications-found')
    ).toBeInTheDocument();
  });

  it('puts the disabled toggle and Browse apps button in the header', async () => {
    await renderList();
    renderHeaderActions();

    expect(screen.getByTestId('show-disabled')).toBeInTheDocument();
    expect(screen.getByTestId('browse-apps')).toBeEnabled();
  });

  it('hides Browse apps for non-admins', async () => {
    mockIsAdmin = false;
    await renderList();
    renderHeaderActions();

    expect(screen.queryByTestId('browse-apps')).not.toBeInTheDocument();
  });

  it('lists disabled apps when the header toggle is switched on', async () => {
    await renderList();
    const { unmount } = renderHeaderActions();

    await act(async () => {
      fireEvent.click(screen.getByRole('switch'));
    });
    unmount();

    expect(getApplicationList).toHaveBeenLastCalledWith(
      expect.objectContaining({ include: Include.Deleted })
    );
    expect(
      screen.getByText('label.disabled-application-plural')
    ).toBeInTheDocument();
  });
});
