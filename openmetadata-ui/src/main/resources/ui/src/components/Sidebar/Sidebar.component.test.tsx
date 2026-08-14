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
import Sidebar from './Sidebar.component';

jest.mock('@openmetadata/ui-core-components', () => ({
  NavList: jest
    .fn()
    .mockImplementation(({ activeUrl }) => (
      <div data-active-url={activeUrl} data-testid="nav-list" />
    )),
}));

jest.mock('../../constants/CustomSidebar.constants', () => ({
  getMarketplaceSidebarConfig: jest.fn().mockReturnValue({
    items: [
      { href: '/data-quality', label: 'Data Quality' },
      { href: '/incident-manager', label: 'Incident Manager' },
    ],
  }),
}));

jest.mock('../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: jest.fn().mockReturnValue({
    preferences: { isSidebarCollapsed: false },
  }),
}));

jest.mock('../../utils/LayoutUtils', () => ({
  isNewLayoutRoute: jest.fn().mockReturnValue(true),
}));

jest.mock('../common/BrandImage/BrandImage', () =>
  jest.fn().mockImplementation(() => <div data-testid="brand-image" />)
);

describe('Sidebar', () => {
  it('should select Data Quality for a test case opened from Data Quality', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/test-case/service.database.schema.table.test/results',
            state: {
              breadcrumbData: [
                {
                  name: 'Data Quality',
                  url: '/data-quality/test-cases',
                },
              ],
            },
          },
        ]}>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByTestId('nav-list')).toHaveAttribute(
      'data-active-url',
      '/data-quality'
    );
  });

  it('should select Data Quality for a test case opened from a bundle suite', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/test-case/service.database.schema.table.test/results',
            state: {
              breadcrumbData: [
                {
                  name: 'Test Suites',
                  url: '/data-quality/test-suites/bundle-suites',
                },
                {
                  name: 'Orders Bundle Suite',
                  url: '/test-suites/Orders.Bundle',
                },
              ],
            },
          },
        ]}>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByTestId('nav-list')).toHaveAttribute(
      'data-active-url',
      '/data-quality'
    );
  });

  it('should select Data Quality for a bundle suite detail page', () => {
    render(
      <MemoryRouter initialEntries={['/test-suites/Orders.Bundle']}>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByTestId('nav-list')).toHaveAttribute(
      'data-active-url',
      '/data-quality'
    );
  });

  it('should select Data Quality for a table suite detail page', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname:
              '/table/service.database.schema.orders/profiler/data-quality',
            state: {
              breadcrumbData: [
                {
                  name: 'Test Suites',
                  url: '/data-quality/test-suites/table-suites',
                },
                {
                  name: 'orders',
                  url: '/table/service.database.schema.orders/profiler/data-quality',
                },
              ],
            },
          },
        ]}>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByTestId('nav-list')).toHaveAttribute(
      'data-active-url',
      '/data-quality'
    );
  });
});
