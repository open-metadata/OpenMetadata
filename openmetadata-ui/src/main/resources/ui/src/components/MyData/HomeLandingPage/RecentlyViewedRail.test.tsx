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

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getRecentlyViewedData } from '../../../utils/RecentActivityUtils';
import RecentlyViewedRail from './RecentlyViewedRail';

jest.mock('../../../utils/RecentActivityUtils', () => ({
  getRecentlyViewedData: jest.fn(),
}));

jest.mock('../../../utils/LandingPageWidgetIconUtils', () => ({
  getEntityIcon: jest.fn().mockReturnValue(<span data-testid="entity-icon" />),
}));

const mockGetRecentlyViewedData = getRecentlyViewedData as jest.MockedFunction<
  typeof getRecentlyViewedData
>;

const renderRail = () =>
  render(
    <MemoryRouter>
      <RecentlyViewedRail />
    </MemoryRouter>
  );

describe('RecentlyViewedRail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders one entry per recently viewed asset', () => {
    mockGetRecentlyViewedData.mockReturnValue([
      {
        displayName: 'Customers',
        entityType: 'table',
        fqn: 'svc.db.schema.customers',
        id: 'id-1',
        serviceType: 'Snowflake',
        timestamp: 2,
      },
      {
        displayName: 'Orders',
        entityType: 'table',
        fqn: 'svc.db.schema.orders',
        id: 'id-2',
        serviceType: 'Snowflake',
        timestamp: 1,
      },
    ] as never);

    renderRail();

    expect(screen.getAllByTestId('recently-viewed-asset')).toHaveLength(2);
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
  });

  // An empty rail is the normal state of a new browser, so it renders nothing
  // rather than an empty state a user would read as lost history.
  it('renders nothing when the user has viewed nothing yet', () => {
    mockGetRecentlyViewedData.mockReturnValue([]);

    renderRail();

    expect(
      screen.queryByTestId('recently-viewed-rail')
    ).not.toBeInTheDocument();
  });

  it('falls back to the fqn when an entry carries no display name', () => {
    mockGetRecentlyViewedData.mockReturnValue([
      {
        entityType: 'topic',
        fqn: 'svc.orders-stream',
        id: 'id-3',
        timestamp: 1,
      },
    ] as never);

    renderRail();

    expect(screen.getByText('svc.orders-stream')).toBeInTheDocument();
  });
});
