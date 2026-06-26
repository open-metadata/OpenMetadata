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
import React from 'react';
import ManageMenuButton, { ManageMenuItem } from './ManageMenuButton.component';

/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('@openmetadata/ui-core-components', () => ({
  Typography: ({ children }: any) => <span>{children}</span>,
  Dropdown: {
    Root: ({ children }: any) => (
      <div data-testid="dropdown-root">{children}</div>
    ),
    DotsButton: ({ className, 'data-testid': testId }: any) => (
      <button className={className} data-testid={testId} type="button">
        dots
      </button>
    ),
    Popover: ({ children, className }: any) => (
      <div className={className} data-testid="dropdown-popover">
        {children}
      </div>
    ),
    // Threads the component's onAction down to each item so a click on an
    // item drives the real handleAction path.
    Menu: ({ children, onAction, 'aria-label': ariaLabel }: any) => (
      <div aria-label={ariaLabel} data-testid="dropdown-menu">
        {React.Children.map(children, (child: any) =>
          React.cloneElement(child, { onAction })
        )}
      </div>
    ),
  },
}));

jest.mock('react-aria-components', () => ({
  MenuItem: ({
    children,
    id,
    isDisabled,
    onAction,
    className,
    'data-testid': testId,
  }: any) => {
    if (typeof className === 'function') {
      className({ isFocused: false, isDisabled: Boolean(isDisabled) });
    }

    return (
      <div
        data-disabled={String(Boolean(isDisabled))}
        data-testid={testId}
        onClick={() => onAction?.(id)}>
        {children}
      </div>
    );
  },
}));

const Icon = ({ className }: { className?: string }) => (
  <span className={className} data-testid="item-icon" />
);

const buildItems = (): ManageMenuItem[] => [
  {
    key: 'import',
    icon: Icon,
    title: 'Import',
    description: 'Import desc',
    onClick: jest.fn(),
  },
  {
    key: 'export',
    icon: Icon,
    title: 'Export',
    onClick: jest.fn(),
  },
];

describe('ManageMenuButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the dots trigger button', () => {
    render(<ManageMenuButton items={buildItems()} />);

    expect(screen.getByTestId('manage-button')).toBeInTheDocument();
  });

  it('should render an item per descriptor with title and description', () => {
    render(<ManageMenuButton items={buildItems()} />);

    expect(screen.getByTestId('import')).toBeInTheDocument();
    expect(screen.getByTestId('export')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
    expect(screen.getByText('Import desc')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
    // export has no description
    expect(screen.queryByText('Export desc')).not.toBeInTheDocument();
  });

  it('should render the icon for each item', () => {
    render(<ManageMenuButton items={buildItems()} />);

    expect(screen.getAllByTestId('item-icon')).toHaveLength(2);
  });

  it('should forward the ariaLabel to the menu', () => {
    render(
      <ManageMenuButton ariaLabel="Manage test case" items={buildItems()} />
    );

    expect(screen.getByTestId('dropdown-menu')).toHaveAttribute(
      'aria-label',
      'Manage test case'
    );
  });

  it('should call the item onClick when the item is activated', () => {
    const items = buildItems();
    render(<ManageMenuButton items={items} />);

    fireEvent.click(screen.getByTestId('export'));

    expect(items[1].onClick).toHaveBeenCalledTimes(1);
    expect(items[0].onClick).not.toHaveBeenCalled();
  });

  it('should not call onClick for a disabled item', () => {
    const items = buildItems();
    items[0].disabled = true;
    render(<ManageMenuButton items={items} />);

    fireEvent.click(screen.getByTestId('import'));

    expect(items[0].onClick).not.toHaveBeenCalled();
    expect(screen.getByTestId('import')).toHaveAttribute(
      'data-disabled',
      'true'
    );
  });

  it('should apply the optional wrapper to the item content', () => {
    const items = buildItems();
    items[0].wrapper = (node) => <div data-testid="wrapped">{node}</div>;
    render(<ManageMenuButton items={items} />);

    expect(screen.getByTestId('wrapped')).toBeInTheDocument();
  });

  it('should apply custom trigger and popover class names', () => {
    render(
      <ManageMenuButton
        items={buildItems()}
        popoverClassName="custom-popover"
        triggerClassName="custom-trigger"
      />
    );

    expect(screen.getByTestId('manage-button')).toHaveClass('custom-trigger');
    expect(screen.getByTestId('dropdown-popover')).toHaveClass(
      'custom-popover'
    );
  });
});
