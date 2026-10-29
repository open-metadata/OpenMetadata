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
import { useFirstLineEnd } from '../../../../../hooks/useFirstLineEnd';
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
 * its asset-type badge right after the last word of the first line. A wrapped
 * title's box spans its full width, so the badge is placed where the first
 * line measures to end, not after the box: it never drops to a later line,
 * and it never floats off at the box's edge.
 */
const TaskTitle: React.FC<TaskTitleProps> = ({
  text,
  entityType,
  size,
  children,
}) => {
  const { ref, end } = useFirstLineEnd<HTMLDivElement>(text);

  return (
    <Box className="tw:relative tw:min-w-0" direction="col">
      <div className="tw:max-w-3/4" ref={ref}>
        <ClampedText text={text}>{children}</ClampedText>
      </div>
      {entityType && (
        // One title line tall, so the badge centres on the first line. Until
        // the line is measured it waits at the title's edge.
        <span
          className={classNames(
            'tw:absolute tw:top-0 tw:flex tw:h-lh tw:items-center tw:pl-2',
            TASK_TITLE_LINE_CLASS[size],
            end === undefined && 'tw:left-3/4'
          )}
          data-testid="task-title-badge-slot"
          style={end === undefined ? undefined : { left: end }}>
          <TaskTitleEntityBadge entityType={entityType} />
        </span>
      )}
    </Box>
  );
};

export default TaskTitle;
