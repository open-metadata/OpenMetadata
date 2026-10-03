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

// The menu's onAction, so a mock item can report being chosen.
let mockMenuAction: ((key: string) => void) | undefined;

jest.mock('@openmetadata/ui-core-components', () => {
  const Pass = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );

  return {
    Badge: ({ children }: { children?: ReactNode }) => (
      <span data-testid="list-count">{children}</span>
    ),
    Box: ({
      children,
      'data-testid': testId,
    }: {
      children?: ReactNode;
      'data-testid'?: string;
    }) => <div data-testid={testId}>{children}</div>,
    Button: ({
      children,
      'data-testid': testId,
    }: {
      children?: ReactNode;
      'data-testid'?: string;
    }) => <button data-testid={testId}>{children}</button>,
    // Open state lives in react-aria; here the menu is always rendered.
    Dropdown: {
      Root: Pass,
      Popover: Pass,
      Section: Pass,
      SectionHeader: Pass,
      Menu: ({
        children,
        'data-testid': testId,
        onAction,
      }: {
        children?: ReactNode;
        'data-testid'?: string;
        onAction?: (key: string) => void;
      }) => {
        mockMenuAction = onAction;

        return (
          <div data-testid={testId} role="menu">
            {children}
          </div>
        );
      },
      Item: ({ id, children }: { id?: string; children?: ReactNode }) => (
        <button role="menuitem" onClick={() => mockMenuAction?.(id ?? '')}>
          {children}
        </button>
      ),
    },
    Typography: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
  };
});

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { countValue?: number }) =>
      options ? `${key}:${options.countValue}` : key,
  }),
}));

import TaskDetailListValue from './TaskDetailListValue';

const COLUMNS = Array.from({ length: 20 }, (_, index) => ({
  label: `column_${index + 1}`,
  to: `/table/svc.db.sch.t.column_${index + 1}`,
}));

describe('TaskDetailListValue', () => {
  it('shows the first four inline and counts the rest', () => {
    render(<TaskDetailListValue items={COLUMNS} title="Columns requested" />);

    expect(
      screen.getByText(/column_1, column_2, column_3, column_4/)
    ).toBeInTheDocument();
    expect(screen.getByTestId('task-detail-list-more')).toHaveTextContent(
      'label.view-more-count:16'
    );
  });

  it('lists every item under the title in the standard dropdown', () => {
    render(<TaskDetailListValue items={COLUMNS} title="Columns requested" />);

    expect(screen.getByTestId('task-detail-list-header')).toHaveTextContent(
      'Columns requested'
    );
    expect(screen.getByTestId('list-count')).toHaveTextContent('20');
    expect(screen.getAllByRole('menuitem')).toHaveLength(20);
  });

  // The header sits outside the scrolling menu, so it stays in view.
  it('keeps the header out of the scrolling list', () => {
    render(<TaskDetailListValue items={COLUMNS} title="Columns requested" />);

    expect(screen.getByTestId('task-detail-list-popover')).not.toContainElement(
      screen.getByTestId('task-detail-list-header')
    );
  });

  it('opens the chosen item', () => {
    render(<TaskDetailListValue items={COLUMNS} title="Columns requested" />);

    fireEvent.click(screen.getByText('column_7'));

    expect(mockNavigate).toHaveBeenCalledWith('/table/svc.db.sch.t.column_7');
  });

  it('offers no popover when everything fits inline', () => {
    render(
      <TaskDetailListValue
        items={[{ label: 'a' }, { label: 'b' }, { label: 'c' }]}
        title="Columns requested"
      />
    );

    expect(screen.getByText('a, b, c')).toBeInTheDocument();
    expect(
      screen.queryByTestId('task-detail-list-more')
    ).not.toBeInTheDocument();
  });

  // Dropdown.Item truncates its own label; a long nested path must wrap.
  it('lets a long name wrap rather than cut off', () => {
    const longName = 'payload.customer.billing_address.postal_code_extension';
    render(
      <TaskDetailListValue
        items={[
          ...COLUMNS.slice(0, 4),
          { label: longName, to: '/table/svc.db.sch.t.long' },
        ]}
        title="Columns requested"
      />
    );

    const name = screen.getByText(longName);

    expect(name).toHaveTextContent(longName);
    expect(name).toHaveClass('tw:whitespace-normal', 'tw:break-all');
  });
});
