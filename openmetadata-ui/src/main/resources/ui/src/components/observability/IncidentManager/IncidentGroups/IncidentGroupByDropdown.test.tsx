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
import { IncidentGroupBy } from '../../../../generated/tests/testCaseIncidentGroup';
import IncidentGroupByDropdown from './IncidentGroupByDropdown';

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest
    .fn()
    .mockImplementation(
      ({
        children,
        'data-testid': testId,
      }: {
        children: ReactNode;
        'data-testid': string;
      }) => <button data-testid={testId}>{children}</button>
    ),
  Dropdown: {
    Root: jest
      .fn()
      .mockImplementation(({ children }: { children: ReactNode }) => (
        <div>{children}</div>
      )),
    Popover: jest
      .fn()
      .mockImplementation(({ children }: { children: ReactNode }) => (
        <div>{children}</div>
      )),
    Menu: jest
      .fn()
      .mockImplementation(
        ({
          children,
          selectedKeys,
          onAction,
        }: {
          children: ReactNode;
          selectedKeys: string[];
          onAction: (key: string) => void;
        }) => (
          <div data-selected-keys={selectedKeys.join(',')} role="menu">
            <button
              data-testid="menu-action-owner"
              onClick={() => onAction(IncidentGroupBy.Owner)}>
              owner
            </button>
            {children}
          </div>
        )
      ),
    Section: jest
      .fn()
      .mockImplementation(({ children }: { children: ReactNode }) => (
        <div>{children}</div>
      )),
    SectionHeader: jest
      .fn()
      .mockImplementation(({ children }: { children: ReactNode }) => (
        <div>{children}</div>
      )),
    Item: jest
      .fn()
      .mockImplementation(
        ({
          label,
          'data-testid': testId,
        }: {
          label: string;
          'data-testid': string;
        }) => <div data-testid={testId}>{label}</div>
      ),
  },
}));

describe('IncidentGroupByDropdown', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list every grouping dimension', () => {
    render(
      <IncidentGroupByDropdown
        value={IncidentGroupBy.TestDefinition}
        onChange={mockOnChange}
      />
    );

    expect(
      screen.getByTestId('incident-group-by-option-testDefinition')
    ).toHaveTextContent('label.test-case-type');
    expect(
      screen.getByTestId('incident-group-by-option-table')
    ).toHaveTextContent('label.table');
    expect(
      screen.getByTestId('incident-group-by-option-owner')
    ).toHaveTextContent('label.test-case-owner');
  });

  it('should show the selected dimension on the trigger', () => {
    render(
      <IncidentGroupByDropdown
        value={IncidentGroupBy.Table}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByTestId('incident-group-by-button')).toHaveTextContent(
      'label.group-by label.table'
    );
    expect(screen.getByRole('menu')).toHaveAttribute(
      'data-selected-keys',
      IncidentGroupBy.Table
    );
  });

  it('should report the picked dimension', () => {
    render(
      <IncidentGroupByDropdown
        value={IncidentGroupBy.Table}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByTestId('menu-action-owner'));

    expect(mockOnChange).toHaveBeenCalledWith(IncidentGroupBy.Owner);
  });
});
