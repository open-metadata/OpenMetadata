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

import {
  Badge,
  Box,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { StatTile, TaskStatTilesProps } from '../taskDetail.types';
import { getTaskStatTiles } from '../taskStatTiles.utils';

const PLACEHOLDER_TILES = [0, 1, 2, 3];

const TONE_CLASS: Record<NonNullable<StatTile['tone']>, string> = {
  error: 'tw:text-error-primary',
  warning: 'tw:text-warning-primary',
};

/** A tile's value as plain text, a link, or a coloured badge. */
const TileValue: React.FC<{ tile: StatTile }> = ({ tile }) => {
  if (tile.to) {
    return (
      <Link
        className="tw:text-sm tw:text-utility-blue-dark-500 tw:underline!"
        to={tile.to}>
        {tile.value}
      </Link>
    );
  }
  if (tile.badgeColor) {
    return (
      <Badge color={tile.badgeColor} size="sm" type="color">
        {tile.value}
      </Badge>
    );
  }

  return (
    <Typography
      className={classNames(tile.tone && TONE_CLASS[tile.tone])}
      size={tile.layout === 'field' ? 'text-sm' : 'text-md'}
      weight="semibold">
      {tile.value}
    </Typography>
  );
};

export interface TaskStatTileGridProps {
  tiles: StatTile[];
  isLoading?: boolean;
  /** Prefix for each tile's `data-testid`; the grid itself gets `-tiles`. */
  testIdPrefix?: string;
}

/**
 * The asset card's strip of stat tiles. Shared so a plugin supplying its own
 * tiles for a task type renders them exactly as the inbox does.
 *
 * A `metric` tile puts its value first — a count or a time. A `field` tile puts
 * its label first — a named property such as a test type.
 */
export const TaskStatTileGrid: React.FC<TaskStatTileGridProps> = ({
  tiles,
  isLoading = false,
  testIdPrefix = 'task-stat',
}) => {
  if (isLoading) {
    return (
      <Box
        className="tw:flex tw:flex-wrap tw:gap-px"
        data-testid={`${testIdPrefix}-tiles-loading`}>
        {PLACEHOLDER_TILES.map((index) => (
          <Box className="tw:flex-1 tw:p-4" direction="col" gap={2} key={index}>
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

  // A wrapping row rather than equal columns: each tile grows from its content's
  // width, so a long label ("Active access requests") takes the room it needs
  // instead of wrapping, and a narrow pane wraps whole tiles, never words. The
  // tiles always fill the row, so no empty cell shows the separator colour.
  return (
    <Box
      className="tw:flex tw:flex-wrap tw:gap-px tw:border-t tw:border-secondary tw:bg-border-secondary"
      data-testid={`${testIdPrefix}-tiles`}>
      {tiles.map((tile) => {
        const label = (
          <Typography
            className="tw:whitespace-nowrap tw:text-tertiary"
            size="text-xs">
            {tile.label}
          </Typography>
        );
        const isField = tile.layout === 'field';

        return (
          <Box
            align="start"
            className="tw:flex-auto tw:bg-secondary tw:px-4 tw:py-3"
            data-testid={`${testIdPrefix}-${tile.key}`}
            direction="col"
            gap={1}
            key={tile.key}>
            {isField && label}
            <TileValue tile={tile} />
            {!isField && label}
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * The asset context strip inside the task's asset card, chosen by task type. A
 * plugin can replace it for a type it owns (`InboxTaskPanelContribution.stats`).
 */
const TaskStatTiles: React.FC<TaskStatTilesProps> = ({
  task,
  about,
  isLoading,
}) => {
  const { t } = useTranslation();

  return (
    <TaskStatTileGrid
      isLoading={isLoading}
      tiles={about ? getTaskStatTiles(task, about, t) : []}
    />
  );
};

export default TaskStatTiles;
