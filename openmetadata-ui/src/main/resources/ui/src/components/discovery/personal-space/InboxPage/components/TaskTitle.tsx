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
import { Box } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React, { ReactNode } from 'react';
import ClampedText from './ClampedText';
import { TaskTitleSize, TASK_TITLE_LINE_CLASS } from './TaskTitle.constants';
import TaskTitleEntityBadge from './TaskTitleEntityBadge';

export interface TaskTitleProps {
  /** The full title, shown in the clamp's tooltip. */
  text: string;
  /** The asset type the title names, set as a badge after it. */
  entityType?: string;
  /** The Typography size the title is set in. */
  size: TaskTitleSize;
  /** The rendered title; may carry links. */
  children: ReactNode;
}

/**
 * A task's title, clamped to two lines within three quarters of the row, with
 * its asset-type badge beside it on the first line: a wrapped title never
 * pushes the badge down or under it.
 */
const TaskTitle: React.FC<TaskTitleProps> = ({
  text,
  entityType,
  size,
  children,
}) => (
  <Box align="start" className="tw:min-w-0" gap={2}>
    <ClampedText className="tw:max-w-3/4" text={text}>
      {children}
    </ClampedText>
    {entityType && (
      // One title line tall, so the badge centres on the first line.
      <span
        className={classNames(
          'tw:flex tw:h-lh tw:shrink-0 tw:items-center',
          TASK_TITLE_LINE_CLASS[size]
        )}>
        <TaskTitleEntityBadge entityType={entityType} />
      </span>
    )}
  </Box>
);

export default TaskTitle;
