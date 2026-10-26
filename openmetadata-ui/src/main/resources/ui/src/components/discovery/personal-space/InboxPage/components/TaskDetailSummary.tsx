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
  AvatarGroup,
  Box,
  Button,
  toOwnerRefs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Calendar,
  Clock,
  Columns03,
  Key01,
  Stars01,
  Tag01,
  Type01,
  User01,
  Users01,
} from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import AgentBadge from '../../../../../components/common/AgentBadge/AgentBadge';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../../../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { getFrontEndFormat } from '../../../../../utils/FeedUtilsPure';
import { ActivityChange, formatInboxDate } from '../inbox.utils';
import {
  TaskDetailCallout,
  TaskDetailRow,
  TaskDetailRowIcon,
  TaskDetailRowValue,
} from '../taskDetail.types';
import ActivityChangePanel from './ActivityChangePanel';
import TaskDetailListValue from './TaskDetailListValue';

export interface TaskDetailSummaryProps {
  rows: TaskDetailRow[];
  change?: ActivityChange;
  callout?: TaskDetailCallout;
}

const ROW_ICON: Record<TaskDetailRowIcon, typeof User01> = {
  calendar: Calendar,
  clock: Clock,
  columns: Columns03,
  owner: Users01,
  shield: Key01,
  source: Stars01,
  tag: Tag01,
  type: Type01,
  user: User01,
};

// Past this many, a row's people collapse into "+N".
const MAX_VISIBLE_PEOPLE = 3;

/**
 * Several people stack as owners do everywhere else: a hover card per avatar and a "+N" listing
 * the rest under the row's plural title. One person reads with their name.
 */
const UsersValue: React.FC<{
  value: Extract<TaskDetailRowValue, { kind: 'users' }>;
  label: string;
}> = ({ value, label }) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();

  return value.refs.length > 1 ? (
    <AvatarGroup
      maxCount={MAX_VISIBLE_PEOPLE}
      overflowTeamsLabel={t('label.team-plural')}
      overflowTitleLabel={value.title ?? label}
      overflowUsersLabel={t('label.user-plural')}
      owners={toOwnerRefs(value.refs)}
    />
  ) : (
    <Box align="center" gap={1}>
      <ProfilePicture
        matchRingToFill
        displayName={getEntityName(value.refs[0])}
        name={value.refs[0]?.name ?? ''}
        width="20"
      />
      <Typography size="text-sm">
        {getEntityName(value.refs[0])}
        {/* The viewer is named as themselves, e.g. "harsh.soni (You)". */}
        {value.refs[0]?.id === currentUser?.id && ` (${t('label.you')})`}
      </Typography>
    </Box>
  );
};

/** Renders one row's value; the union keeps the descriptor free of JSX. */
const RowValue: React.FC<{ value: TaskDetailRowValue; label: string }> = ({
  value,
  label,
}) => {
  switch (value.kind) {
    // A date reads on one line, however long its neighbour's value.
    case 'date':
      return (
        <Typography className="tw:whitespace-nowrap" size="text-sm">
          {formatInboxDate(value.timestamp)}
        </Typography>
      );

    case 'users':
      return <UsersValue label={label} value={value} />;

    case 'agent':
      return <AgentBadge name={value.name} />;

    // The full tag FQN, as a reviewer searches for it: "PII.Sensitive".
    case 'tags':
      return (
        <Typography size="text-sm">
          {value.tags.map((tag) => tag.tagFQN).join(', ')}
        </Typography>
      );

    case 'list':
      return <TaskDetailListValue items={value.items} title={value.title} />;

    case 'link':
      return (
        <Button color="link-color" href={value.to} size="sm">
          {value.label}
        </Button>
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
  change,
  callout,
}) => (
  <Box data-testid="task-detail-summary" direction="col" gap={5}>
    {rows.length > 0 && (
      // Content-sized columns: a short left value ("Full Access") lends its
      // spare width to a long right one ("14 Days · expires Oct 8, 2026").
      // The pane, not the window, decides the second column: beside the task
      // list it is narrow on any screen. `minmax(0, …)` lets a column shrink
      // and wrap its value instead of running past the pane.
      <div className="tw:@container">
        <div className="tw:grid tw:grid-cols-1 tw:gap-x-8 tw:gap-y-3 tw:@2xl:grid-cols-[minmax(0,auto)_minmax(0,auto)]">
          {rows.map((row) => {
            const Icon = ROW_ICON[row.icon];

            return (
              <Box align="center" gap={2} key={row.key}>
                <Icon
                  className="tw:shrink-0 tw:text-quaternary"
                  height={16}
                  width={16}
                />
                <Typography
                  className="tw:w-28 tw:shrink-0 tw:text-tertiary"
                  size="text-sm">
                  {row.label}
                </Typography>
                <div className="tw:min-w-0 tw:flex-1 tw:break-words">
                  <RowValue label={row.label} value={row.value} />
                </div>
              </Box>
            );
          })}
        </div>
      </div>
    )}

    {change && <ActivityChangePanel change={change} />}

    {callout && (
      // A surface of its own, not a layout Box. In dark the pane behind is
      // bg-secondary, so it lifts to bg-surface.
      <div
        className="tw:flex tw:flex-col tw:gap-1 tw:rounded-xl tw:border tw:border-l-2 tw:border-secondary tw:border-l-utility-brand-300 tw:bg-secondary tw:px-4 tw:py-3 tw:dark:bg-surface"
        data-testid="task-detail-callout">
        <Typography
          className="tw:uppercase tw:text-tertiary tw:tracking-wide"
          size="text-xs"
          weight="semibold">
          {callout.label}
        </Typography>
        {/* Descriptions, reasons and suggestions are markdown, with mentions. */}
        <RichTextEditorPreviewerV1
          className="tw:break-words tw:text-sm"
          enableSeeMoreVariant={false}
          markdown={getFrontEndFormat(callout.text)}
        />
      </div>
    )}
  </Box>
);

export default TaskDetailSummary;
