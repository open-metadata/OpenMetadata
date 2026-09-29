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
import { ReactNode } from 'react';

jest.mock('@openmetadata/ui-core-components', () => {
  const Pass = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );

  return {
    Badge: ({ children }: { children?: ReactNode }) => (
      <span data-testid="list-count">{children}</span>
    ),
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
      }: {
        children?: ReactNode;
        'data-testid'?: string;
      }) => (
        <div data-testid={testId} role="menu">
          {children}
        </div>
      ),
      Item: ({ label }: { label?: string }) => (
        <div role="menuitem">{label}</div>
      ),
    },
    Typography: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { countValue?: number }) =>
      options ? `${key}:${options.countValue}` : key,
  }),
}));

import TaskDetailListValue from './TaskDetailListValue';

const COLUMNS = Array.from({ length: 20 }, (_, index) => `column_${index + 1}`);

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

    const menu = screen.getByTestId('task-detail-list-popover');

    expect(menu).toHaveTextContent('Columns requested');
    expect(screen.getByTestId('list-count')).toHaveTextContent('20');
    expect(screen.getAllByRole('menuitem')).toHaveLength(20);
  });

  it('offers no popover when everything fits inline', () => {
    render(
      <TaskDetailListValue items={['a', 'b', 'c']} title="Columns requested" />
    );

    expect(screen.getByText('a, b, c')).toBeInTheDocument();
    expect(
      screen.queryByTestId('task-detail-list-more')
    ).not.toBeInTheDocument();
  });
});
