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

import { Box, Skeleton, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getRelativeTime } from '../../../../../utils/date-time/DateTimeUtils';
import { TaskAboutEntity, TaskStatTilesProps } from '../taskDetail.types';

export interface StatTile {
  key: string;
  label: string;
  value: string;
}

// Enumerated so Tailwind sees every class literally. The grid always has exactly
// as many columns as tiles: a hidden tile must not leave an empty cell, which
// the separator background would paint as a grey block.
const COLUMNS_CLASS: Record<number, string> = {
  1: 'tw:sm:grid-cols-1',
  2: 'tw:sm:grid-cols-2',
  3: 'tw:sm:grid-cols-3',
  4: 'tw:sm:grid-cols-4',
  5: 'tw:sm:grid-cols-5',
};
const PLACEHOLDER_TILES = [0, 1, 2, 3];

export interface TaskStatTileGridProps {
  tiles: StatTile[];
  isLoading?: boolean;
  /** Prefix for each tile's `data-testid`; the grid itself gets `-tiles`. */
  testIdPrefix?: string;
}

/**
 * The asset card's strip of stat tiles. Shared so a plugin supplying its own
 * tiles for a task type renders them exactly as the inbox does.
 */
export const TaskStatTileGrid: React.FC<TaskStatTileGridProps> = ({
  tiles,
  isLoading = false,
  testIdPrefix = 'task-stat',
}) => {
  if (isLoading) {
    return (
      <Box
        className={classNames('tw:grid tw:gap-px', COLUMNS_CLASS[4])}
        data-testid={`${testIdPrefix}-tiles-loading`}>
        {PLACEHOLDER_TILES.map((index) => (
          <Box className="tw:p-4" direction="col" gap={2} key={index}>
            <Skeleton height={24} variant="rounded" width={48} />
            <Skeleton height={14} width="70%" />
          </Box>
        ))}
      </Box>
    );
  }

  if (tiles.length === 0) {
    return null;
  }

  return (
    <Box
      className={classNames(
        'tw:grid tw:grid-cols-1 tw:gap-px tw:bg-border-secondary',
        COLUMNS_CLASS[Math.min(tiles.length, 5)]
      )}
      data-testid={`${testIdPrefix}-tiles`}>
      {tiles.map((tile) => (
        <Box
          className="tw:bg-primary tw:p-4"
          data-testid={`${testIdPrefix}-${tile.key}`}
          direction="col"
          gap={1}
          key={tile.key}>
          <Typography size="text-lg" weight="semibold">
            {tile.value}
          </Typography>
          <Typography className="tw:text-secondary" size="text-xs">
            {tile.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * The tiles a task's asset can actually back with data today. A value that is
 * missing (an entity type without columns, a lineage service that did not
 * answer) drops its tile rather than showing a zero it cannot vouch for.
 */
const getStatTiles = (about: TaskAboutEntity, t: Translate): StatTile[] => {
  const tiles: StatTile[] = [];

  if (about.downstreamCount !== undefined) {
    tiles.push({
      key: 'downstream',
      label: t('label.downstream'),
      value: String(about.downstreamCount),
    });
  }
  if (about.columnCount !== undefined) {
    tiles.push({
      key: 'columns',
      label: t('label.column-plural'),
      value: String(about.columnCount),
    });
  }
  // A calendar-week figure, so it is labelled as this week rather than as the
  // last seven days.
  if (about.weeklyQueryCount !== undefined) {
    tiles.push({
      key: 'queries',
      label: t('label.queries-this-week'),
      value: String(about.weeklyQueryCount),
    });
  }
  // Nothing records when an asset lost its owner, so an unowned asset says so
  // plainly instead of showing a count of zero or a duration it cannot know.
  if (about.ownerCount !== undefined) {
    tiles.push({
      key: 'owners',
      label: t('label.owner-plural'),
      value: about.ownerCount
        ? String(about.ownerCount)
        : t('label.no-owner'),
    });
  }
  // The only timestamp available is the last metadata change — not data
  // freshness — so the label names exactly that.
  if (about.updatedAt) {
    tiles.push({
      key: 'updatedAt',
      label: t('label.metadata-updated'),
      value: getRelativeTime(about.updatedAt),
    });
  }

  return tiles;
};

/**
 * The asset context strip inside the task's asset card. A plugin can replace it
 * wholesale for a task type it owns (see `InboxTaskPanelContribution.stats`).
 */
const TaskStatTiles: React.FC<TaskStatTilesProps> = ({ about, isLoading }) => {
  const { t } = useTranslation();

  return (
    <TaskStatTileGrid
      isLoading={isLoading}
      tiles={about ? getStatTiles(about, t) : []}
    />
  );
};

export default TaskStatTiles;
