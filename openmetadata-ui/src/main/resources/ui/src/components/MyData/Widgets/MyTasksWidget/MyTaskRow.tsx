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
  Avatar,
  Badge,
  Checkbox,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertTriangle,
  CheckCircle,
  ClipboardCheck,
  IconProps,
  Key01,
  MessageSquare01,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Task } from '../../../../generated/entity/tasks/task';
import { getShortRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getMyTaskBucket, MyTaskBucket } from '../../../../utils/myTaskBuckets';
import { getTaskDetailPath } from '../../../../utils/TaskUtils';
import { TOPIC_ROW_TILE_CLASSES } from '../Common/TopicWidget/topicRowStyles';

interface KindStyle {
  icon: FC<IconProps>;
  tile: string;
  labelKey: string;
}

const KIND_STYLES: Record<MyTaskBucket, KindStyle> = {
  [MyTaskBucket.INCIDENTS]: {
    icon: AlertTriangle,
    labelKey: 'label.incident',
    tile: 'tw:bg-utility-error-50 tw:text-utility-error-600',
  },
  [MyTaskBucket.ACCESS]: {
    icon: Key01,
    labelKey: 'label.access-request',
    tile: 'tw:bg-utility-blue-light-50 tw:text-utility-blue-light-600',
  },
  [MyTaskBucket.APPROVALS]: {
    icon: CheckCircle,
    labelKey: 'label.approval',
    tile: 'tw:bg-utility-blue-50 tw:text-utility-blue-600',
  },
  [MyTaskBucket.ALL]: {
    icon: ClipboardCheck,
    labelKey: 'label.task',
    tile: 'tw:bg-utility-gray-50 tw:text-utility-gray-600',
  },
};

// The inbox shows `TASK-00042` as `#00042`; the card reads the same.
const TASK_ID_PREFIX = 'TASK-';

export interface MyTaskRowProps {
  task: Task;
  title: string;
  isSelected: boolean;
  onSelectedChange: (taskId: string, isSelected: boolean) => void;
}

/** One open task: what it is, who raised it, what it is about, and how old. */
const MyTaskRow: React.FC<MyTaskRowProps> = ({
  task,
  title,
  isSelected,
  onSelectedChange,
}) => {
  const { t } = useTranslation();
  const kind = KIND_STYLES[getMyTaskBucket(task) ?? MyTaskBucket.ALL];
  const KindIcon = kind.icon;
  const requester = getEntityName(task.createdBy);
  const aboutName = task.about ? getEntityName(task.about) : undefined;

  return (
    <li
      className={classNames(
        'tw:group tw:flex tw:min-w-0 tw:items-start tw:gap-3 tw:rounded-xl tw:px-2 tw:py-3 tw:transition-colors',
        isSelected
          ? 'tw:bg-utility-brand-50'
          : 'tw:hover:bg-utility-gray-blue-50'
      )}
      data-testid={`my-task-row-${task.id}`}>
      <Checkbox
        aria-label={title}
        className="tw:mt-2"
        data-testid={`my-task-select-${task.id}`}
        isSelected={isSelected}
        onChange={(next) => onSelectedChange(task.id, next)}
      />
      <span
        className={classNames(
          'tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg',
          kind.tile,
          TOPIC_ROW_TILE_CLASSES
        )}>
        <KindIcon aria-hidden size={16} />
        <span className="tw:sr-only">{t(kind.labelKey)}</span>
      </span>
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1.5">
        <Link
          className="tw:min-w-0 tw:no-underline!"
          to={getTaskDetailPath(task)}>
          <Typography
            className="tw:text-text-primary!"
            data-testid="my-task-title"
            ellipsis={{ rows: 2 }}
            size="text-sm"
            weight="medium">
            {title}
          </Typography>
        </Link>
        <span className="tw:flex tw:min-w-0 tw:items-center tw:gap-2">
          {task.taskId && (
            <Typography
              className="tw:shrink-0 tw:text-text-tertiary!"
              size="text-xs">
              {`#${task.taskId.replace(TASK_ID_PREFIX, '')}`}
            </Typography>
          )}
          {requester && (
            <span className="tw:flex tw:min-w-0 tw:items-center tw:gap-1.5">
              <Avatar
                alt={requester}
                initials={requester.charAt(0).toUpperCase()}
                size="xxs"
              />
              <Typography
                className="tw:min-w-0 tw:text-text-secondary!"
                ellipsis={{ rows: 1 }}
                size="text-xs">
                {requester}
              </Typography>
            </span>
          )}
          {aboutName && (
            <Badge
              className="tw:min-w-0 tw:max-w-60 tw:truncate"
              color="gray"
              data-testid="my-task-entity"
              size="sm"
              type="color">
              {aboutName}
            </Badge>
          )}
          <span className="tw:ml-auto tw:flex tw:shrink-0 tw:items-center tw:gap-2 tw:text-text-tertiary">
            {(task.commentCount ?? 0) > 0 && (
              <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs">
                <MessageSquare01 aria-hidden size={12} />
                <span className="tw:sr-only">{t('label.comment-plural')}</span>
                {task.commentCount}
              </span>
            )}
            <Typography className="tw:text-text-tertiary!" size="text-xs">
              {getShortRelativeTime(task.createdAt)}
            </Typography>
          </span>
        </span>
      </div>
    </li>
  );
};

export default MyTaskRow;
