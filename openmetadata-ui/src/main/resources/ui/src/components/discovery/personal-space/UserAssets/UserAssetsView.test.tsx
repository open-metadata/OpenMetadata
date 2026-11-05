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

import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchIndex } from '../../../../enums/search.enum';
import { User } from '../../../../generated/entity/teams/user';
import { searchQuery } from '../../../../rest/searchAPI';
import UserAssetsView from './UserAssetsView';

const mockCurrentUser = { id: 'me', name: 'me' };

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: mockCurrentUser }),
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

// No debounce, so a typed search is requested on the next render.
jest.mock('../../../../hooks/common/useDebouncedValue', () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));

jest.mock(
  '../../../Explore/EntitySummaryPanel/EntitySummaryPanel.component',
  () => ({
    __esModule: true,
    default: ({
      entityDetails,
      handleClosePanel,
    }: {
      entityDetails: { details: { name: string } };
      handleClosePanel: () => void;
    }) => (
      <div data-testid="summary-panel">
        {entityDetails.details.name}
        <button
          aria-label="close"
          data-testid="summary-panel-close"
          onClick={handleClosePanel}
        />
      </div>
    ),
  })
);

jest.mock('./UserAssetStats', () => ({
  __esModule: true,
  default: () => <div data-testid="user-asset-stats" />,
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockSearchQuery = searchQuery as jest.Mock;

const asset = (name: string) => ({
  id: `${name}-id`,
  name,
  fullyQualifiedName: `svc.db.schema.${name}`,
  entityType: 'table',
  description: name === 'orders' ? 'Orders fact table' : undefined,
  owners: [],
  service: { name: 'svc', type: 'databaseService' },
  database: { name: 'db', fullyQualifiedName: 'svc.db', type: 'database' },
  databaseSchema: {
    name: 'schema',
    fullyQualifiedName: 'svc.db.schema',
    type: 'databaseSchema',
  },
});

const respondWith = (names: string[]) =>
  mockSearchQuery.mockResolvedValue({
    hits: {
      total: { value: names.length },
      hits: names.map((name) => ({ _source: asset(name) })),
    },
  });

const alice = {
  id: 'alice',
  name: 'alice.johnson',
  displayName: 'Alice Johnson',
  teams: [{ id: 'team-1', type: 'team' }],
} as User;

const renderView = (props: Partial<Parameters<typeof UserAssetsView>[0]>) =>
  render(
    <MemoryRouter>
      <UserAssetsView kind="owned" user={alice} {...props} />
    </MemoryRouter>
  );

const lastRequest = () =>
  mockSearchQuery.mock.calls[mockSearchQuery.mock.calls.length - 1][0];

describe('UserAssetsView', () => {
  beforeEach(() => {
    mockSearchQuery.mockReset();
  });

  it('lists assets owned by the user or their teams, with stats, first one selected', async () => {
    respondWith(['orders', 'customers']);
    renderView({ kind: 'owned' });

    expect(await screen.findByTestId('summary-panel')).toHaveTextContent(
      'orders'
    );

    const request = lastRequest();

    expect(request.searchIndex).toBe(SearchIndex.DATA_ASSET);
    expect(JSON.stringify(request.queryFilter)).toContain('"alice"');
    expect(JSON.stringify(request.queryFilter)).toContain('"team-1"');
    expect(JSON.stringify(request.queryFilter)).toContain('owners.id');
    expect(screen.getByTestId('user-asset-stats')).toBeInTheDocument();
    expect(
      screen.getByTestId('user-asset-card-svc.db.schema.orders')
    ).toHaveAttribute('data-selected', 'true');
    expect(screen.getByText('Orders fact table')).toBeInTheDocument();
    expect(
      within(
        screen.getByTestId('user-asset-card-svc.db.schema.customers')
      ).getByText('label.no-description')
    ).toBeInTheDocument();
  });

  it('lists followed assets without stats for the following kind', async () => {
    respondWith(['orders']);
    renderView({ kind: 'following' });

    await screen.findByTestId('summary-panel');

    const filter = JSON.stringify(lastRequest().queryFilter);

    expect(filter).toContain('followers');
    expect(filter).not.toContain('team-1');
    expect(screen.queryByTestId('user-asset-stats')).not.toBeInTheDocument();
  });

  it('selects the clicked card', async () => {
    respondWith(['orders', 'customers']);
    renderView({});

    await screen.findByTestId('summary-panel');
    fireEvent.click(
      within(
        screen.getByTestId('user-asset-card-svc.db.schema.customers')
      ).getByTestId('user-asset-card-name')
    );

    expect(screen.getByTestId('summary-panel')).toHaveTextContent('customers');
  });

  it('closes the summary panel instead of falling back to the first asset', async () => {
    respondWith(['orders', 'customers']);
    renderView({});

    await screen.findByTestId('summary-panel');
    fireEvent.click(screen.getByTestId('summary-panel-close'));

    expect(screen.queryByTestId('summary-panel')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('user-asset-card-svc.db.schema.orders')
    ).toHaveAttribute('data-selected', 'false');
  });

  it('shows an error with reload, not the empty state, when the list fails to load', async () => {
    mockSearchQuery.mockRejectedValueOnce(new Error('boom'));
    renderView({ kind: 'owned' });

    expect(
      await screen.findByText('message.something-went-wrong')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('user-assets-empty')).not.toBeInTheDocument();

    respondWith(['orders']);
    fireEvent.click(screen.getByRole('button', { name: 'label.reload' }));

    expect(await screen.findByTestId('summary-panel')).toHaveTextContent(
      'orders'
    );
  });

  it('searches by the typed text and says when nothing matches', async () => {
    respondWith(['orders']);
    renderView({});
    await screen.findByTestId('summary-panel');

    respondWith([]);
    fireEvent.change(screen.getByTestId('user-assets-search'), {
      target: { value: 'zzz' },
    });

    expect(
      await screen.findByText('message.no-assets-match-your-search')
    ).toBeInTheDocument();
    expect(lastRequest().query).toBe('*zzz*');
  });

  it('shows the other user empty state by first name, keeping the stat tiles', async () => {
    respondWith([]);
    renderView({ kind: 'owned' });

    expect(await screen.findByTestId('user-assets-empty')).toHaveTextContent(
      'message.user-does-not-own-any-assets'
    );
    expect(screen.getByTestId('user-asset-stats')).toBeInTheDocument();
  });

  it('offers to explore when the current user follows nothing', async () => {
    respondWith([]);
    renderView({
      kind: 'following',
      user: { ...alice, id: 'me' } as User,
    });

    const empty = await screen.findByTestId('user-assets-empty');

    expect(empty).toHaveTextContent('message.you-are-not-following-anything');
    expect(
      within(empty).getByRole('button', { name: 'label.explore-assets' })
    ).toBeInTheDocument();
  });
});
