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

jest.mock('@openmetadata/ui-core-components', () => ({
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
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('../../../../../utils/date-time/DateTimeUtils', () => ({
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
  // The usage figure is a calendar week, so it must not claim seven days.
  it('labels the weekly usage as queries this week', () => {
    renderTiles({ weeklyQueryCount: 9 });

    expect(screen.getByTestId('task-stat-queries')).toHaveTextContent(
      '9label.queries-this-week'
    );
  });

  // Nothing records when an asset lost its owner, so no duration is shown.
  it('says "No owner" for an unowned asset rather than a zero', () => {
    renderTiles({ ownerCount: 0 });

    expect(screen.getByTestId('task-stat-owners')).toHaveTextContent(
      'label.no-owner'
    );
  });

  it('counts owners when the asset has them', () => {
    renderTiles({ ownerCount: 2 });

    expect(screen.getByTestId('task-stat-owners')).toHaveTextContent('2');
  });

  // The timestamp is the last metadata change, not data freshness.
  it('names the timestamp as a metadata update, relative to now', () => {
    renderTiles({ updatedAt: 1000 });

    expect(screen.getByTestId('task-stat-updatedAt')).toHaveTextContent(
      'ago-1000label.metadata-updated'
    );
  });

  it('hides a tile whose number is unknown', () => {
    renderTiles({ downstreamCount: 3 });

    expect(screen.getByTestId('task-stat-downstream')).toBeInTheDocument();
    expect(screen.queryByTestId('task-stat-queries')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-stat-owners')).not.toBeInTheDocument();
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

  // A hidden tile must not leave an empty cell behind, which the separator
  // background would paint as a grey block.
  it('gives the row exactly as many columns as tiles', () => {
    render(<TaskStatTileGrid tiles={[tile('a'), tile('b')]} />);

    expect(screen.getByTestId('task-stat-tiles')).toHaveClass(
      'tw:sm:grid-cols-2'
    );
  });

  it('prefixes the test ids for a plugin-owned tile set', () => {
    render(<TaskStatTileGrid testIdPrefix="dar-stat" tiles={[tile('a')]} />);

    expect(screen.getByTestId('dar-stat-tiles')).toBeInTheDocument();
    expect(screen.getByTestId('dar-stat-a')).toBeInTheDocument();
  });
});
