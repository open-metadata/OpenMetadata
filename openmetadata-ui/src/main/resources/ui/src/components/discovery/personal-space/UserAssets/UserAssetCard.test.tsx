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
import UserAssetCard from './UserAssetCard';

const table = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'orders-id',
    name: 'orders',
    displayName: 'Orders',
    fullyQualifiedName: 'svc.db.schema.orders',
    entityType: 'table',
    description: '**Orders** fact table',
    owners: [{ id: 'o1', type: 'user', name: 'bob', displayName: 'Bob' }],
    service: { name: 'svc', type: 'databaseService' },
    database: { name: 'db', fullyQualifiedName: 'svc.db', type: 'database' },
    databaseSchema: {
      name: 'schema',
      fullyQualifiedName: 'svc.db.schema',
      type: 'databaseSchema',
    },
    ...overrides,
  } as unknown as SearchSourceAlias);

const renderCard = (
  source: SearchSourceAlias,
  isSelected = false,
  onSelect = jest.fn()
) =>
  render(
    <MemoryRouter>
      <UserAssetCard
        isSelected={isSelected}
        source={source}
        onSelect={onSelect}
      />
    </MemoryRouter>
  );

describe('UserAssetCard', () => {
  it('renders the breadcrumb trail, name, plain description and owner', () => {
    renderCard(table());
    const card = screen.getByTestId('user-asset-card-svc.db.schema.orders');

    expect(card).toHaveAttribute('data-selected', 'false');
    expect(screen.getByTestId('user-asset-card-name')).toHaveTextContent(
      'Orders'
    );
    expect(screen.getByText('Orders fact table')).toBeInTheDocument();
    expect(card).toHaveTextContent('svc');
    expect(card).toHaveTextContent('Bob');
  });

  it('links the parent schema under the description', () => {
    renderCard(table());

    const parentLinks = screen
      .getAllByRole('link', { name: 'schema' })
      .filter((link) => link.getAttribute('href')?.includes('svc.db.schema'));

    expect(parentLinks.length).toBeGreaterThan(0);
  });

  it('falls back to the no-description label', () => {
    renderCard(table({ description: undefined }));

    expect(screen.getByText('label.no-description')).toBeInTheDocument();
  });

  it('selects the asset when its name is clicked', () => {
    const onSelect = jest.fn();
    const source = table();
    renderCard(source, true, onSelect);

    expect(
      screen.getByTestId('user-asset-card-svc.db.schema.orders')
    ).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('user-asset-card-name')).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    fireEvent.click(screen.getByTestId('user-asset-card-name'));

    expect(onSelect).toHaveBeenCalledWith(source);
  });

  it('draws the brand border only on the selected card', () => {
    const { unmount } = renderCard(table(), true);

    expect(
      screen.getByTestId('user-asset-card-svc.db.schema.orders')
    ).toHaveClass('tw:border-brand');

    unmount();
    renderCard(table(), false);

    expect(
      screen.getByTestId('user-asset-card-svc.db.schema.orders')
    ).not.toHaveClass('tw:border-brand');
  });
});
