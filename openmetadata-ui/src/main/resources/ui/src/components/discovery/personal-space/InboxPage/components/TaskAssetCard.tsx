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

import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import { startCase } from 'lodash';
import React, { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../../../enums/entity.enum';
import { Task } from '../../../../../generated/entity/tasks/task';
import { getEntityIcon } from '../../../../../utils/EntityIconUtils';
import { getEntityLinkFromType } from '../../../../../utils/EntityLinkUtils';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { TaskAboutEntity, TaskStatTilesProps } from '../taskDetail.types';
import { formatEntityType } from '../taskList.utils';
import TaskStatTiles from './TaskStatTiles';

export interface TaskAssetCardProps {
  task: Task;
  about?: TaskAboutEntity;
  isLoading: boolean;
  /** Replaces the default stat tiles for a plugin-owned task type. */
  StatTiles?: ComponentType<TaskStatTilesProps>;
}

/**
 * The asset a task is about: what it is, how it is classified, a way into it,
 * and the few numbers that tell a reviewer whether the change matters.
 *
 * Renders nothing when neither the task nor its incident test case names an
 * entity.
 */
const TaskAssetCard: React.FC<TaskAssetCardProps> = ({
  task,
  about,
  isLoading,
  StatTiles = TaskStatTiles,
}) => {
  const { t } = useTranslation();
  // An incident often names no `about`; its failing test case, fetched from the
  // description, stands in so the card still says what failed.
  const testCase = about?.testCase;
  const aboutRef =
    task.about ??
    (testCase?.fullyQualifiedName
      ? {
          id: testCase.id,
          type: EntityType.TEST_CASE,
          name: testCase.name,
          displayName: testCase.displayName,
          fullyQualifiedName: testCase.fullyQualifiedName,
        }
      : undefined);

  if (!aboutRef?.fullyQualifiedName || !aboutRef.type) {
    return null;
  }

  const parentPath = aboutRef.fullyQualifiedName
    .split('.')
    .slice(0, -1)
    .join('.');

  return (
    <Box
      className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary"
      data-testid="task-asset-card"
      direction="col">
      <Box align="center" className="tw:justify-between tw:gap-3 tw:p-4">
        <Box align="center" className="tw:min-w-0" gap={3}>
          <span className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-secondary tw:text-fg-quaternary">
            {getEntityIcon(aboutRef.type)}
          </span>
          <Box className="tw:min-w-0" direction="col" gap={1}>
            <Box align="center" className="tw:flex-wrap" gap={2}>
              <Typography
                className="tw:break-all"
                size="text-sm"
                weight="semibold">
                {getEntityName(aboutRef)}
              </Typography>
              {about?.tier && (
                <Badge color="blue" size="sm" type="color">
                  {about.tier.displayName || startCase(about.tier.name)}
                </Badge>
              )}
              {Boolean(about?.piiColumnCount) && (
                <Badge color="error" size="sm" type="color">
                  {t('label.pii-uppercase')}
                </Badge>
              )}
            </Box>
            <Typography className="tw:text-tertiary" size="text-xs">
              {[formatEntityType(aboutRef.type), parentPath]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          </Box>
        </Box>
        <Link
          className="tw:shrink-0 tw:text-sm tw:font-semibold! tw:text-brand-secondary tw:no-underline! tw:hover:underline!"
          data-testid="task-open-asset"
          to={getEntityLinkFromType(
            aboutRef.fullyQualifiedName,
            aboutRef.type as EntityType
          )}>
          {t('label.open-asset')}
        </Link>
      </Box>

      <StatTiles about={about} isLoading={isLoading} task={task} />
    </Box>
  );
};

export default TaskAssetCard;
