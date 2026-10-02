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
import MarketplaceOverviewHeader from './MarketplaceOverviewHeader';

/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  PageLayout: {
    PageHeader: ({ title, subtitle, breadcrumb, actions, variant }: any) => (
      <div data-testid="page-header" data-variant={variant}>
        <div data-testid="hs-breadcrumb">{breadcrumb}</div>
        <div data-testid="hs-title">{title}</div>
        <div data-testid="hs-subtitle">{subtitle}</div>
        <div data-testid="hs-actions">{actions}</div>
      </div>
    ),
  },
  Typography: ({ children, ...props }: any) => (
    <span {...props}>{children}</span>
  ),
}));

jest.mock(
  'components/common/HeaderBreadcrumb/HeaderBreadcrumb.component',
  () => ({
    __esModule: true,
    default: ({ items }: any) => (
      <div data-testid="breadcrumb">
        {(items ?? [])
          .map((i: any) => i.ariaLabel ?? i.label)
          .filter(Boolean)
          .join('|')}
      </div>
    ),
  })
);

jest.mock(
  'components/DataMarketplace/MarketplaceSearchInput/MarketplaceSearchInput.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="marketplace-search-input" />,
  })
);

jest.mock(
  'assets/svg/ask-collate-nav-bar/marketplace-default.svg',
  () => ({ ReactComponent: () => <svg data-testid="marketplace-icon" /> }),
  { virtual: true }
);

jest.mock('../AddNewMenu/AddNewMenu', () => ({
  __esModule: true,
  AddNewMenu: () => <div data-testid="add-new-menu" />,
  default: () => <div data-testid="add-new-menu" />,
}));

describe('MarketplaceOverviewHeader', () => {
  it('renders the title and subtitle inside the shared title layout', () => {
    render(<MarketplaceOverviewHeader />);

    const headerLayout = screen.getByTestId('search-header-row');

    expect(headerLayout).toHaveTextContent('label.data-marketplace');
    expect(headerLayout).toHaveTextContent(
      'message.discover-data-products-subtitle'
    );
    expect(screen.getByTestId('hs-title')).toContainElement(headerLayout);
    expect(screen.getByTestId('hs-subtitle')).toBeEmptyDOMElement();
    expect(screen.getByTestId('page-header')).toHaveAttribute(
      'data-variant',
      'gradient'
    );
  });

  it('renders the marketplace breadcrumb', () => {
    render(<MarketplaceOverviewHeader />);

    expect(screen.getByTestId('breadcrumb')).toHaveTextContent(
      'label.data-marketplace'
    );
  });

  it('moves the search and Add New menu into the title layout', () => {
    render(<MarketplaceOverviewHeader />);

    const headerLayout = screen.getByTestId('search-header-row');

    expect(headerLayout).toContainElement(
      screen.getByTestId('marketplace-search-input')
    );
    expect(headerLayout).toContainElement(screen.getByTestId('add-new-menu'));
    expect(screen.getByTestId('hs-actions')).toBeEmptyDOMElement();
  });

  it('lays the row out like the marketplace list-page headers', () => {
    render(<MarketplaceOverviewHeader />);

    const searchSlot = screen.getByTestId('search-header-search');

    expect(searchSlot).toContainElement(
      screen.getByTestId('marketplace-search-input')
    );
    expect(screen.getByTestId('search-header-actions')).toContainElement(
      screen.getByTestId('add-new-menu')
    );
    expect(screen.getByTestId('search-header-actions')).not.toContainElement(
      screen.getByTestId('marketplace-search-input')
    );
  });
});
