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
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatInboxDate } from '../inbox.utils';
import { TaskAboutEntity, TaskStatTilesProps } from '../taskDetail.types';

interface StatTile {
  key: string;
  label: string;
  value: string;
}

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
  if (about.ownerCount !== undefined) {
    tiles.push({
      key: 'owners',
      label: t('label.owner-plural'),
      value: String(about.ownerCount),
    });
  }
  if (about.updatedAt) {
    tiles.push({
      key: 'updatedAt',
      label: t('label.last-updated'),
      value: formatInboxDate(about.updatedAt),
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

  if (isLoading) {
    return (
      <Box
        className="tw:grid tw:grid-cols-2 tw:gap-px tw:sm:grid-cols-4"
        data-testid="task-stat-tiles-loading">
        {[0, 1, 2, 3].map((index) => (
          <Box className="tw:p-4" direction="col" gap={2} key={index}>
            <Skeleton height={24} variant="rounded" width={48} />
            <Skeleton height={14} width="70%" />
          </Box>
        ))}
      </Box>
    );
  }

  const tiles = about ? getStatTiles(about, t) : [];

  if (tiles.length === 0) {
    return null;
  }

  return (
    <Box
      className="tw:grid tw:grid-cols-2 tw:gap-px tw:bg-border-secondary tw:sm:grid-cols-4"
      data-testid="task-stat-tiles">
      {tiles.map((tile) => (
        <Box
          className="tw:bg-primary tw:p-4"
          data-testid={`task-stat-${tile.key}`}
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

export default TaskStatTiles;
