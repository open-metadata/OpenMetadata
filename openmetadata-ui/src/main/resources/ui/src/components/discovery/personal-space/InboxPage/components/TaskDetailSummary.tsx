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

import { Box, Typography } from '@openmetadata/ui-core-components';
import {
  Calendar,
  Clock,
  Key01,
  Stars01,
  Tag01,
  Type01,
  User01,
  Users01,
} from '@untitledui/icons';
import React from 'react';
import { Link } from 'react-router-dom';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { formatInboxDate } from '../inbox.utils';
import {
  TaskDetailCallout,
  TaskDetailRow,
  TaskDetailRowIcon,
  TaskDetailRowValue,
} from '../taskDetail.types';

export interface TaskDetailSummaryProps {
  rows: TaskDetailRow[];
  callout?: TaskDetailCallout;
}

const ROW_ICON: Record<TaskDetailRowIcon, typeof User01> = {
  calendar: Calendar,
  clock: Clock,
  owner: Users01,
  shield: Key01,
  source: Stars01,
  tag: Tag01,
  type: Type01,
  user: User01,
};

/** Renders one row's value; the union keeps the descriptor free of JSX. */
const RowValue: React.FC<{ value: TaskDetailRowValue }> = ({ value }) => {
  switch (value.kind) {
    case 'date':
      return (
        <Typography size="text-sm">
          {formatInboxDate(value.timestamp)}
        </Typography>
      );

    case 'users':
      return (
        <Box align="center" className="tw:flex-wrap" gap={2}>
          {value.refs.map((ref) => (
            <Box align="center" gap={1} key={ref.id}>
              <ProfilePicture
                displayName={getEntityName(ref)}
                name={ref.name ?? ''}
                width="20"
              />
              <Typography size="text-sm">{getEntityName(ref)}</Typography>
            </Box>
          ))}
        </Box>
      );

    // The full tag FQN, as a reviewer searches for it: "PII.Sensitive".
    case 'tags':
      return (
        <Typography className="tw:font-mono" size="text-xs">
          {value.tags.map((tag) => tag.tagFQN).join(', ')}
        </Typography>
      );

    case 'link':
      return (
        <Link
          className="tw:text-sm tw:font-semibold! tw:text-brand-secondary tw:no-underline! tw:hover:underline!"
          to={value.to}>
          {value.label}
        </Link>
      );

    default:
      return <Typography size="text-sm">{value.text}</Typography>;
  }
};

/**
 * The task's key/value summary and its rationale callout, drawn from the
 * type's descriptor: each row an icon and label, then its value on the same
 * line. Two columns on a wide pane, one when it is narrow.
 */
const TaskDetailSummary: React.FC<TaskDetailSummaryProps> = ({
  rows,
  callout,
}) => (
  <Box data-testid="task-detail-summary" direction="col" gap={5}>
    {rows.length > 0 && (
      <div className="tw:grid tw:grid-cols-1 tw:gap-x-8 tw:gap-y-3 tw:sm:grid-cols-2">
        {rows.map((row) => {
          const Icon = ROW_ICON[row.icon];

          return (
            <Box align="start" gap={2} key={row.key}>
              <Icon
                className="tw:mt-0.5 tw:shrink-0 tw:text-fg-quaternary"
                height={16}
                width={16}
              />
              <Typography
                className="tw:w-28 tw:shrink-0 tw:text-tertiary"
                size="text-sm">
                {row.label}
              </Typography>
              <div className="tw:min-w-0 tw:flex-1 tw:break-words">
                <RowValue value={row.value} />
              </div>
            </Box>
          );
        })}
      </div>
    )}

    {callout && (
      <Box
        className="tw:rounded-xl tw:border tw:border-l-2 tw:border-secondary tw:border-l-utility-brand-300 tw:bg-secondary tw:px-4 tw:py-3"
        data-testid="task-detail-callout"
        direction="col"
        gap={1}>
        <Typography
          className="tw:uppercase tw:text-tertiary tw:tracking-wide"
          size="text-xs"
          weight="semibold">
          {callout.label}
        </Typography>
        <Typography className="tw:break-words" size="text-sm">
          {callout.text}
        </Typography>
      </Box>
    )}
  </Box>
);

export default TaskDetailSummary;
