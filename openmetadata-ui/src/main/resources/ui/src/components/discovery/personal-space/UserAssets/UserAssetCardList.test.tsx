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

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchSourceAlias } from '../../../../interface/search.interface';
import UserAssetCardList from './UserAssetCardList';

const asset = (name: string) =>
  ({
    id: `${name}-id`,
    name,
    fullyQualifiedName: `svc.${name}`,
    entityType: 'table',
    owners: [],
    service: { name: 'svc', type: 'databaseService' },
    database: { name: 'db', fullyQualifiedName: 'svc.db', type: 'database' },
    databaseSchema: {
      name: 'schema',
      fullyQualifiedName: 'svc.db.schema',
      type: 'databaseSchema',
    },
  } as unknown as SearchSourceAlias);

type ListProps = Parameters<typeof UserAssetCardList>[0];

const renderList = (props: Partial<ListProps> = {}) =>
  render(
    <MemoryRouter>
      <UserAssetCardList
        assets={[]}
        hasMore={false}
        isLoading={false}
        onLoadMore={jest.fn()}
        onSelect={jest.fn()}
        {...props}
      />
    </MemoryRouter>
  );

describe('UserAssetCardList', () => {
  it('renders a card per asset and marks the selected one', () => {
    renderList({
      assets: [asset('orders'), asset('customers')],
      selectedId: 'customers-id',
    });

    expect(screen.getByTestId('user-asset-card-svc.orders')).toHaveAttribute(
      'data-selected',
      'false'
    );
    expect(screen.getByTestId('user-asset-card-svc.customers')).toHaveAttribute(
      'data-selected',
      'true'
    );
    expect(
      screen.queryByTestId('user-assets-no-match')
    ).not.toBeInTheDocument();
  });

  it('shows skeletons instead of the no-match message while loading', () => {
    const { container } = renderList({ isLoading: true });

    expect(
      screen.queryByTestId('user-assets-no-match')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('user-assets-list').children.length
    ).toBeGreaterThanOrEqual(3);
    expect(container).not.toHaveTextContent(
      'message.no-assets-match-your-search'
    );
  });

  it('says nothing matches when the list is empty', () => {
    renderList();

    expect(screen.getByTestId('user-assets-no-match')).toHaveTextContent(
      'message.no-assets-match-your-search'
    );
  });

  it('loads more only when more are available', () => {
    const onLoadMore = jest.fn();
    const { rerender } = renderList({ assets: [asset('orders')] });

    expect(
      screen.queryByTestId('user-assets-load-more')
    ).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <UserAssetCardList
          hasMore
          assets={[asset('orders')]}
          isLoading={false}
          onLoadMore={onLoadMore}
          onSelect={jest.fn()}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('user-assets-load-more'));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
