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

import { act, render, screen, waitFor, within } from '@testing-library/react';
import { PluginRouteProps } from '../../Settings/Applications/plugins/AppPlugin';
import { AI_APP_MODE } from '../../../constants/appMode.constants';
import { useAppModeStore } from '../../../hooks/useAppMode';
import { ReactNode, Suspense } from 'react';
import { ROUTES } from '../../../constants/constants';
import { marketplaceModule } from './marketplace.module';

/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('@openmetadata/ui-core-components', () => ({
  Card: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="card">
      {children}
    </div>
  ),
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Button: ({
    children,
    onClick,
  }: {
    children?: ReactNode;
    onClick?: (...args: unknown[]) => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The full-AI-mode list header renders the shared OM HeaderShell + HeaderBreadcrumb.
// Stub them so the gating can be asserted without a Router (HeaderBreadcrumb calls
// useNavigate) and without depending on OM's internal markup.
jest.mock('components/common/HeaderShell/HeaderShell.component', () => ({
  __esModule: true,
  default: ({
    breadcrumb,
    title,
    subtitle,
    actions,
    'data-testid': dataTestId = 'header-shell',
  }: any) => (
    <div data-testid={dataTestId}>
      {breadcrumb}
      <span>{title}</span>
      <span>{subtitle}</span>
      {actions}
    </div>
  ),
}));

jest.mock(
  'components/common/HeaderBreadcrumb/HeaderBreadcrumb.component',
  () => ({
    __esModule: true,
    default: () => <nav data-testid="header-breadcrumb" />,
  })
);

jest.mock('components/AppRouter/withSuspenseFallback', () => ({
  __esModule: true,
  default: (Component: any) => Component,
}));

jest.mock('components/DomainListing/DomainListPage', () => ({
  __esModule: true,
  default: ({ renderPageHeader }: any) => (
    <div data-testid="domain-list-page">
      {renderPageHeader ? (
        renderPageHeader({
          count: 0,
          createPermission: true,
          onAddClick: jest.fn(),
          search: (
            <input
              aria-label="domain-list-search"
              data-testid="domain-list-search"
            />
          ),
        })
      ) : (
        <div data-testid="default-header" />
      )}
    </div>
  ),
}));

jest.mock('components/DataProduct/DataProductListPage', () => ({
  __esModule: true,
  default: ({ renderPageHeader }: any) => (
    <div data-testid="data-product-list-page">
      {renderPageHeader ? (
        renderPageHeader({
          count: 0,
          createPermission: true,
          onAddClick: jest.fn(),
          search: (
            <input
              aria-label="data-product-list-search"
              data-testid="data-product-list-search"
            />
          ),
        })
      ) : (
        <div data-testid="default-header" />
      )}
    </div>
  ),
}));

jest.mock(
  '../../platform/ai-shell/PermissionedLiveRoute/PermissionedLiveRoute',
  () => ({
    PermissionedLiveRoute: ({ children }: { children?: ReactNode }) => (
      <>{children}</>
    ),
  })
);

jest.mock(
  '../../platform/ai-shell/LiveRefreshBoundary/LiveRefreshBoundary',
  () => ({
    LiveRefreshBoundary: ({ children }: { children?: ReactNode }) => (
      <>{children}</>
    ),
  })
);

const getRoute = (path: string): PluginRouteProps => {
  const route = marketplaceModule.routes.find((r) => r.path === path);
  if (!route) {
    throw new Error(`Expected marketplace route at path ${path}`);
  }

  return route;
};

const renderRoute = (path: string) =>
  render(
    <Suspense fallback={null}>{getRoute(path).element as ReactNode}</Suspense>
  );

const setMode = (mode: string) =>
  act(() => {
    useAppModeStore.getState().setMode(mode);
  });

describe('marketplaceModule — list page header gating', () => {
  beforeEach(() => {
    act(() => {
      useAppModeStore.getState().reset();
    });
    sessionStorage.clear();
  });

  it('renders the gradient header on the domains list in full AI mode', async () => {
    setMode(AI_APP_MODE);

    renderRoute(ROUTES.DOMAIN);

    await screen.findByTestId('domain-list-page');

    expect(screen.getByText('message.domain-description')).toBeInTheDocument();
    expect(screen.getByText('label.add-domain')).toBeInTheDocument();
    expect(screen.queryByTestId('default-header')).not.toBeInTheDocument();

    expect(
      within(screen.getByTestId('list-page-header')).getByTestId(
        'domain-list-search'
      )
    ).toBeInTheDocument();
  });

  it('renders the gradient header on the data products list in full AI mode', async () => {
    setMode(AI_APP_MODE);

    renderRoute(ROUTES.DATA_PRODUCT);

    await screen.findByTestId('data-product-list-page');

    expect(
      screen.getByText('message.data-product-description')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('default-header')).not.toBeInTheDocument();

    expect(
      within(screen.getByTestId('list-page-header')).getByTestId(
        'data-product-list-search'
      )
    ).toBeInTheDocument();
  });

  it('keeps the default header in classic mode', async () => {
    renderRoute(ROUTES.DOMAIN);

    await screen.findByTestId('domain-list-page');

    expect(screen.getByTestId('default-header')).toBeInTheDocument();
    expect(
      screen.queryByText('message.domain-description')
    ).not.toBeInTheDocument();
  });

  it('swaps the header on a mode flip without remounting', async () => {
    renderRoute(ROUTES.DOMAIN);

    await screen.findByTestId('domain-list-page');

    expect(screen.getByTestId('default-header')).toBeInTheDocument();

    setMode(AI_APP_MODE);

    await waitFor(() => {
      expect(
        screen.getByText('message.domain-description')
      ).toBeInTheDocument();
    });

    expect(screen.queryByTestId('default-header')).not.toBeInTheDocument();

    act(() => {
      useAppModeStore.getState().reset();
    });

    await waitFor(() => {
      expect(screen.getByTestId('default-header')).toBeInTheDocument();
    });

    expect(
      screen.queryByText('message.domain-description')
    ).not.toBeInTheDocument();
  });
});
