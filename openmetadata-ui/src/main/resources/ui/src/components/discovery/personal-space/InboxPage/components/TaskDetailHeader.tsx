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
  Button,
  Dropdown,
  Typography,
} from '@openmetadata/ui-core-components';
import { DotsVertical } from '@untitledui/icons';
import React, { ComponentProps, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserTeamSelectableList } from '../../../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { Task } from '../../../../../generated/entity/tasks/task';
import { EntityReference } from '../../../../../generated/entity/teams/user';
import { TaskTypeBadge } from '../taskDetail.types';
import { TaskStatusBadge, TaskStatusTone } from '../taskResolution.utils';
import { splitTaskActions, TaskResolveAction } from '../taskResolve.utils';

export interface TaskDetailHeaderProps {
  task: Task;
  typeBadge: TaskTypeBadge;
  statusBadge?: TaskStatusBadge;
  actions: TaskResolveAction[];
  loadingTransitionId?: string;
  onAssigneeUpdate: (
    action: TaskResolveAction
  ) => (updated?: EntityReference[]) => void;
  onTransition: (action: TaskResolveAction) => () => void;
}

type TaskActionButtonColor = ComponentProps<typeof Button>['color'];

// The status leads the header as a badge; its tone picks the colour, so
// "Pending approval" reads blue, an outcome green or red, the rest neutral.
const STATUS_BADGE_COLOR: Record<
  TaskStatusTone,
  ComponentProps<typeof Badge>['color']
> = {
  brand: 'brand',
  success: 'success',
  error: 'error',
  gray: 'gray',
};

const getTaskActionTestId = (action: TaskResolveAction): string => {
  if (action.kind === 'approve') {
    return 'task-approve';
  }
  if (action.kind === 'reject') {
    return 'task-reject';
  }

  return `task-transition-${action.id}`;
};

interface TaskActionButtonProps {
  action: TaskResolveAction;
  color: TaskActionButtonColor;
  loadingTransitionId?: string;
  task: Task;
  onAssigneeUpdate: TaskDetailHeaderProps['onAssigneeUpdate'];
  onTransition: TaskDetailHeaderProps['onTransition'];
}

/** One resolve/reject/approve/assignee-reassign control in the task header. */
const TaskActionButton = ({
  action,
  color,
  loadingTransitionId,
  task,
  onAssigneeUpdate,
  onTransition,
}: TaskActionButtonProps) => {
  const { t } = useTranslation();
  const isBusy = loadingTransitionId === action.id;
  const isDisabled =
    loadingTransitionId !== undefined && loadingTransitionId !== action.id;

  // Native button trigger: the AntD Popover injects onClick via
  // cloneElement, which the react-aria Button would swallow.
  if (action.kind === 'assignee') {
    return (
      <UserTeamSelectableList
        hasPermission
        label={t('label.assignee-plural')}
        multiple={{ user: false, team: false }}
        owner={task.assignees ?? []}
        onUpdate={onAssigneeUpdate(action)}>
        <button
          className={
            'tw:cursor-pointer tw:rounded-md tw:border tw:border-secondary ' +
            'tw:bg-primary tw:px-3 tw:py-1.5 tw:text-sm tw:font-semibold ' +
            'tw:text-secondary tw:shadow-xs tw:hover:bg-secondary ' +
            'tw:disabled:cursor-not-allowed tw:disabled:opacity-50'
          }
          data-testid={`task-transition-${action.id}`}
          disabled={isDisabled || isBusy}
          type="button">
          {action.label}
        </button>
      </UserTeamSelectableList>
    );
  }

  return (
    <Button
      color={color}
      data-testid={getTaskActionTestId(action)}
      isDisabled={isDisabled}
      isLoading={isBusy}
      size="sm"
      onClick={onTransition(action)}>
      {action.label}
    </Button>
  );
};

/**
 * The task's identity and what can be done about it: type chip, task id, the
 * state it is waiting in, and its actions.
 *
 * Two actions stay visible as buttons — the affirmative one filled — and the
 * rest fold into an overflow menu, so a task with many transitions does not
 * spread its header across the pane. An assignee action keeps its own picker
 * trigger, which a menu item cannot host.
 */
const TaskDetailHeader: React.FC<TaskDetailHeaderProps> = ({
  task,
  typeBadge,
  statusBadge,
  actions,
  loadingTransitionId,
  onAssigneeUpdate,
  onTransition,
}) => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { primary, secondary, overflow } = splitTaskActions(actions);
  // An assignee action opens a picker rather than firing, so it cannot live in
  // the menu — it stays a button even when it did not win a header slot.
  const menuActions = overflow.filter((action) => action.kind !== 'assignee');
  const extraButtons = overflow.filter((action) => action.kind === 'assignee');

  return (
    <Box align="center" className="tw:justify-between tw:gap-3 tw:mb-2" gap={3}>
      {/* Status, then id and type: the one question a viewer brings is
          whether the task waits on them. */}
      <Box align="center" className="tw:min-w-0 tw:flex-wrap" gap={2}>
        {statusBadge && (
          <Badge
            className="tw:font-medium"
            color={STATUS_BADGE_COLOR[statusBadge.tone]}
            data-color={statusBadge.tone}
            data-testid="task-status-badge"
            size="md"
            type="color">
            {statusBadge.label}
          </Badge>
        )}
        <Typography
          className="tw:text-secondary"
          size="text-sm"
          weight="medium">
          {task.taskId ?? ''}
        </Typography>
        <span aria-hidden className="tw:text-sm tw:text-quaternary">
          ·
        </span>
        <Typography
          className="tw:text-tertiary"
          data-testid="task-type-badge"
          size="text-sm">
          {typeBadge.label}
        </Typography>
      </Box>

      <Box align="center" className="tw:shrink-0" gap={2}>
        {secondary && (
          <TaskActionButton
            action={secondary}
            color="secondary"
            key={secondary.id}
            loadingTransitionId={loadingTransitionId}
            task={task}
            onAssigneeUpdate={onAssigneeUpdate}
            onTransition={onTransition}
          />
        )}
        {primary && (
          <TaskActionButton
            action={primary}
            color="primary"
            key={primary.id}
            loadingTransitionId={loadingTransitionId}
            task={task}
            onAssigneeUpdate={onAssigneeUpdate}
            onTransition={onTransition}
          />
        )}
        {extraButtons.map((action) => (
          <TaskActionButton
            action={action}
            color="secondary"
            key={action.id}
            loadingTransitionId={loadingTransitionId}
            task={task}
            onAssigneeUpdate={onAssigneeUpdate}
            onTransition={onTransition}
          />
        ))}

        {menuActions.length > 0 && (
          <Dropdown.Root isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <Button
              aria-label={t('label.more-action-plural')}
              color="secondary"
              data-testid="task-actions-menu"
              iconLeading={<DotsVertical className="tw:size-4" />}
              size="sm"
            />
            <Dropdown.Popover className="tw:w-max tw:min-w-40">
              <Dropdown.Menu
                onAction={(key) => {
                  const action = menuActions.find(
                    (candidate) => candidate.id === key
                  );
                  setIsMenuOpen(false);
                  action && onTransition(action)();
                }}>
                {menuActions.map((action) => (
                  <Dropdown.Item
                    data-testid={getTaskActionTestId(action)}
                    id={action.id}
                    key={action.id}>
                    {action.label}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>
        )}
      </Box>
    </Box>
  );
};

export default TaskDetailHeader;
