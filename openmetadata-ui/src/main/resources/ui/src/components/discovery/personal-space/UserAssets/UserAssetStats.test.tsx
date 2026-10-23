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
import { ROUTES } from '../../../../constants/constants';
import { User } from '../../../../generated/entity/teams/user';
import UserAssetStats from './UserAssetStats';

const mockStats = jest.fn();

jest.mock('./useUserAssetStats', () => ({
  useUserAssetStats: () => mockStats(),
}));

const stats = (queryStats: Record<string, unknown> = {}) => ({
  assetStats: { total: 9, tables: 5, dashboards: 3, pipelines: 1 },
  incidentStats: { total: 4, severity1: 2 },
  queryStats: { count: 17, mostViewed: 'Orders', ...queryStats },
  requireAttention: 2,
  dataHealthScore: 78,
  isLoading: false,
  error: undefined,
  failed: { assets: false, incidents: false, queries: false, health: false },
  refetch: jest.fn(),
});

const renderStats = () =>
  render(
    <MemoryRouter>
      <UserAssetStats user={{ id: 'u1', name: 'alice' } as User} />
    </MemoryRouter>
  );

describe('UserAssetStats', () => {
  it('renders each tile value from the stats hook', () => {
    mockStats.mockReturnValue(stats());
    renderStats();

    expect(
      screen.getByTestId('stat-card-assets-owned-value')
    ).toHaveTextContent('9');
    expect(
      screen.getByTestId('stat-card-assets-owned-breakdown')
    ).toHaveTextContent('5label.table-plural3label.dashboard-plural1');
    expect(screen.getByTestId('stat-card-data-health-value')).toHaveTextContent(
      '78'
    );
    expect(
      screen.getByTestId('stat-card-open-incidents-value')
    ).toHaveTextContent('4');
    expect(screen.getByTestId('stat-card-queries-value')).toHaveTextContent(
      '17'
    );
  });

  it('shows a capped query count as a lower bound', () => {
    mockStats.mockReturnValue(stats({ isPartial: true }));
    renderStats();

    expect(screen.getByTestId('stat-card-queries-value')).toHaveTextContent(
      '17+'
    );
  });

  it('links health and incidents to their pages and queries to the top table', () => {
    mockStats.mockReturnValue(stats({ mostViewedFqn: 'svc.db.s.orders' }));
    renderStats();

    expect(screen.getByTestId('stat-card-data-health-link')).toHaveAttribute(
      'href',
      ROUTES.DATA_QUALITY
    );
    expect(screen.getByTestId('stat-card-open-incidents-link')).toHaveAttribute(
      'href',
      ROUTES.INCIDENT_MANAGER
    );
    expect(
      screen.getByTestId('stat-card-queries-link').getAttribute('href')
    ).toMatch(/svc\.db\.s\.orders.*table_queries/);
    expect(
      screen.queryByTestId('stat-card-assets-owned-link')
    ).not.toBeInTheDocument();
  });

  it('has no queries link and a plain subtitle without a most-viewed table', () => {
    mockStats.mockReturnValue(stats());
    renderStats();

    expect(
      screen.queryByTestId('stat-card-queries-link')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('stat-card-queries-subtitle')).toHaveTextContent(
      'label.most-viewed-entity'
    );
  });

  it('hides values while loading', () => {
    mockStats.mockReturnValue({ ...stats(), isLoading: true });
    renderStats();

    expect(
      screen.queryByTestId('stat-card-assets-owned-value')
    ).not.toBeInTheDocument();
  });

  it('shows a reload only on the tile whose request failed, keeping the others', () => {
    const refetch = jest.fn();
    mockStats.mockReturnValue({
      ...stats(),
      error: new Error('denied'),
      failed: { assets: false, incidents: true, queries: false, health: false },
      refetch,
    });
    renderStats();

    expect(
      screen.getByTestId('stat-card-assets-owned-value')
    ).toHaveTextContent('9');
    expect(
      screen.getByTestId('stat-card-open-incidents-value')
    ).toHaveTextContent('--');
    expect(screen.getAllByTestId('stat-card-reload')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('stat-card-reload'));

    expect(refetch).toHaveBeenCalled();
  });
});
