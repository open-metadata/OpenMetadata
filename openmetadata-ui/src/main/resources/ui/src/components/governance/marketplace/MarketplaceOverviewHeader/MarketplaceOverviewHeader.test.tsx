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

jest.mock('components/common/HeaderShell/HeaderShell.component', () => ({
  __esModule: true,
  default: ({
    title,
    subtitle,
    breadcrumb,
    actions,
    actionsClassName,
    variant,
  }: any) => (
    <div data-testid="header-shell" data-variant={variant}>
      <div data-testid="hs-breadcrumb">{breadcrumb}</div>
      <div data-testid="hs-title">{title}</div>
      <div data-testid="hs-subtitle">{subtitle}</div>
      <div className={actionsClassName} data-testid="hs-actions">
        {actions}
      </div>
    </div>
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
  'components/DataMarketplace/MarketplaceSearchBar/MarketplaceSearchBar.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="marketplace-search-bar" />,
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

    const headerLayout = screen.getByTestId('marketplace-header-layout');

    expect(headerLayout).toHaveTextContent('label.data-marketplace');
    expect(headerLayout).toHaveTextContent(
      'message.discover-data-products-subtitle'
    );
    expect(screen.getByTestId('hs-title')).toContainElement(headerLayout);
    expect(screen.getByTestId('hs-subtitle')).toBeEmptyDOMElement();
    expect(screen.getByTestId('header-shell')).toHaveAttribute(
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

    const headerLayout = screen.getByTestId('marketplace-header-layout');

    expect(headerLayout).toContainElement(
      screen.getByTestId('marketplace-search-bar')
    );
    expect(headerLayout).toContainElement(screen.getByTestId('add-new-menu'));
    expect(screen.getByTestId('hs-actions')).toBeEmptyDOMElement();
  });

  it('centers the search and Add New button in one constrained group', () => {
    render(<MarketplaceOverviewHeader />);

    const actionsGroup = screen.getByTestId('marketplace-actions-group');
    const searchBar = screen.getByTestId('marketplace-search-bar');
    const addNewMenu = screen.getByTestId('add-new-menu');

    expect(screen.getByTestId('marketplace-header-layout')).toHaveClass(
      'tw:w-full',
      'tw:min-w-0',
      'tw:flex-1'
    );
    expect(actionsGroup).toContainElement(searchBar);
    expect(actionsGroup).toContainElement(addNewMenu);
    expect(actionsGroup).toHaveClass(
      'tw:flex',
      'tw:w-full',
      'tw:max-w-5xl',
      'tw:min-w-0',
      'tw:flex-1',
      'tw:items-center',
      'tw:gap-4',
      'tw:mx-auto',
      'tw:px-8'
    );
    expect(searchBar.parentElement).toHaveClass(
      'tw:w-full',
      'tw:min-w-0',
      'tw:flex-1'
    );
  });
});
