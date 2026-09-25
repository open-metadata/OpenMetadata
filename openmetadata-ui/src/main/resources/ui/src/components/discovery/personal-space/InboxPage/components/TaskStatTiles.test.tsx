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

jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children?: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Box: ({
    children,
    className,
    ...rest
  }: {
    children?: ReactNode;
    className?: string;
    'data-testid'?: string;
  }) => (
    <div className={className} data-testid={rest['data-testid']}>
      {children}
    </div>
  ),
  Skeleton: () => <div data-testid="skeleton" />,
  Typography: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => <span className={className}>{children}</span>,
}));

// Spread the real module: routing helpers reached through the tile builder read
// the day helpers at import time.
jest.mock('../../../../../utils/date-time/DateTimeUtils', () => ({
  ...jest.requireActual('../../../../../utils/date-time/DateTimeUtils'),
  getRelativeTime: (ts: number) => `ago-${ts}`,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { Task } from '../../../../../generated/entity/tasks/task';
import { TaskAboutEntity } from '../taskDetail.types';
import TaskStatTiles, { TaskStatTileGrid } from './TaskStatTiles';

const TASK = { id: 'task-1' } as Task;

const renderTiles = (about?: TaskAboutEntity, isLoading = false) =>
  render(<TaskStatTiles about={about} isLoading={isLoading} task={TASK} />);

describe('TaskStatTiles', () => {
  it('renders the tiles the task type calls for', () => {
    renderTiles({ weeklyQueryCount: 9 });

    expect(screen.getByTestId('task-stat-queries')).toHaveTextContent(
      '9label.queries-this-week'
    );
  });

  it('renders nothing when no number is known', () => {
    const { container } = renderTiles({});

    expect(container).toBeEmptyDOMElement();
  });

  it('shows placeholders while the asset context loads', () => {
    renderTiles(undefined, true);

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });
});

describe('TaskStatTileGrid', () => {
  const tile = (key: string) => ({ key, label: key, value: '1' });

  // Tiles size from their content and never wrap a label, so a long label
  // takes the width it needs rather than splitting across lines.
  it('lets tiles grow from their content and keeps labels on one line', () => {
    render(<TaskStatTileGrid tiles={[tile('a'), tile('b')]} />);

    expect(screen.getByTestId('task-stat-tiles')).toHaveClass('tw:flex-wrap');
    expect(screen.getByTestId('task-stat-a')).toHaveClass('tw:flex-auto');
    expect(screen.getByText('a', { selector: 'span' })).toHaveClass(
      'tw:whitespace-nowrap'
    );
  });

  // A named property reads label-first; a figure reads value-first.
  it('puts the label of a field tile before its value', () => {
    render(
      <TaskStatTileGrid
        tiles={[{ key: 'k', label: 'LABEL', value: 'VALUE', layout: 'field' }]}
      />
    );

    expect(screen.getByTestId('task-stat-k')).toHaveTextContent('LABELVALUE');
  });

  it('renders a linked value as a link', () => {
    render(
      <TaskStatTileGrid
        tiles={[{ key: 'k', label: 'Table', value: 'orders', to: '/t/orders' }]}
      />
    );

    expect(screen.getByRole('link', { name: 'orders' })).toHaveAttribute(
      'href',
      '/t/orders'
    );
  });

  it('colours a value that needs attention', () => {
    render(
      <TaskStatTileGrid
        tiles={[{ key: 'k', label: 'Columns', value: '38', tone: 'error' }]}
      />
    );

    expect(screen.getByText('38')).toHaveClass('tw:text-error-primary');
  });

  it('prefixes the test ids for a plugin-owned tile set', () => {
    render(<TaskStatTileGrid testIdPrefix="dar-stat" tiles={[tile('a')]} />);

    expect(screen.getByTestId('dar-stat-tiles')).toBeInTheDocument();
    expect(screen.getByTestId('dar-stat-a')).toBeInTheDocument();
  });
});
