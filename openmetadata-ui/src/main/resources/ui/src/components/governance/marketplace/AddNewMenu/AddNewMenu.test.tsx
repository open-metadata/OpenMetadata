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
import { ReactNode } from 'react';
import { AddNewMenu } from './AddNewMenu';

/* eslint-disable @typescript-eslint/no-explicit-any */
const openDomainDrawer = jest.fn();
const openDataProductDrawer = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('components/DomainListing/hooks/useDomainCreateDrawer', () => ({
  useDomainCreateDrawer: () => ({
    formDrawer: <div data-testid="domain-drawer" />,
    openDrawer: openDomainDrawer,
  }),
}));

jest.mock('components/DataProduct/hooks/useDataProductCreateDrawer', () => ({
  useDataProductCreateDrawer: () => ({
    formDrawer: <div data-testid="data-product-drawer" />,
    openDrawer: openDataProductDrawer,
  }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: ({ children }: { children?: ReactNode }) => (
    <button data-testid="marketplace-add-new-button">{children}</button>
  ),
  Dropdown: {
    Root: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Popover: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Menu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Item: ({ children, onAction, ['data-testid']: testId }: any) => (
      <button data-testid={testId} onClick={onAction}>
        {children}
      </button>
    ),
  },
}));

describe('AddNewMenu', () => {
  beforeEach(() => {
    openDomainDrawer.mockClear();
    openDataProductDrawer.mockClear();
  });

  it('mounts both create drawers and the trigger', () => {
    render(<AddNewMenu />);

    expect(
      screen.getByTestId('marketplace-add-new-button')
    ).toBeInTheDocument();
    expect(screen.getByTestId('domain-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('data-product-drawer')).toBeInTheDocument();
  });

  it('opens the domain create drawer in place on Add Domain', () => {
    render(<AddNewMenu />);

    fireEvent.click(screen.getByTestId('marketplace-add-domain'));

    expect(openDomainDrawer).toHaveBeenCalledTimes(1);
  });

  it('opens the data product create drawer in place on Add Data Product', () => {
    render(<AddNewMenu />);

    fireEvent.click(screen.getByTestId('marketplace-add-data-product'));

    expect(openDataProductDrawer).toHaveBeenCalledTimes(1);
  });
});
