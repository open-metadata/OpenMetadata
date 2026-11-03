/*
 *  Copyright 2024 Collate.
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
  Box,
  Button,
  ButtonUtility,
  Card,
  Owner,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  Comment,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isEqual } from 'lodash';
import { useCallback, useMemo } from 'react';
import {
  ButtonProps as AriaButtonProps,
  PressEvent,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as TaskCloseIcon } from '../../../assets/svg/ic-close-task.svg';
import { ReactComponent as TaskOpenIcon } from '../../../assets/svg/ic-open-task.svg';
import EntityPopOverCard from '../../../components/common/PopOverCard/EntityPopOverCard';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import { EntityType } from '../../../enums/entity.enum';
import { useAuth } from '../../../hooks/authHooks';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import DescriptionTaskFromTask from '../../../pages/TasksPage/shared/DescriptionTaskFromTask';
import TagsTaskFromTask from '../../../pages/TasksPage/shared/TagsTaskFromTask';
import {
  resolveTask as resolveTaskAPI,
  Task,
  TaskEntityStatus,
  TaskEntityType,
  TaskResolutionType,
} from '../../../rest/tasksAPI';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import EntityLink from '../../../utils/EntityLink';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getNameFromFQN } from '../../../utils/FqnUtils';
import { getErrorText } from '../../../utils/StringUtils';
import {
  isDescriptionTaskType,
  isRecognizerFeedbackTask,
  isTagsTaskType,
} from '../../../utils/TaskActionUtils';
import {
  getTaskDetailPathFromTask,
  getTaskDisplayId,
  isTaskPendingFurtherApproval,
} from '../../../utils/TaskNavigationUtils';
import { getNormalizedTaskPayload } from '../../../utils/TaskPayloadUtils';
import {
  getTaskResolveBody,
  isOntologyReviewTask,
} from '../../../utils/TaskUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { getTaskTypeMessageKey } from '../../Entity/Task/MetadataCompletionTask/MetadataCompletionTask.utils';
import {
  CARD_CONTAINER_CLASS_NAME,
  handleCardContainerKeyDown,
} from '../ActivityFeedCardNew/ActivityFeedcardNew.utils';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './task-feed-card.less';

const getTaskRowGapClassName = (
  isTaskTestCaseResult: boolean,
  isTaskApprovalRequest: boolean,
  isTaskDescription: boolean
): string | undefined => {
  if (isTaskTestCaseResult || isTaskApprovalRequest) {
    return 'tw:gap-y-1.5';
  }

  return isTaskDescription ? undefined : 'tw:gap-y-3.5';
};

const getTaskStatusIcon = (status?: TaskEntityStatus) =>
  status === TaskEntityStatus.Open ? TaskOpenIcon : TaskCloseIcon;

const getReplyCountLabelKey = (commentsCount: number) =>
  commentsCount === 1 ? 'label.one-reply' : 'label.number-reply-plural';

const getHasTaskEditAccess = ({
  isAdminUser,
  isTaskApprovalRequest,
  isAssignee,
  isPartOfAssigneeTeam,
  isCreator,
}: {
  isAdminUser?: boolean;
  isTaskApprovalRequest: boolean;
  isAssignee?: boolean;
  isPartOfAssigneeTeam?: boolean;
  isCreator: boolean;
}): boolean => {
  const isAdminNonApproval = isAdminUser && !isTaskApprovalRequest;

  return (
    isAdminNonApproval ||
    Boolean(isAssignee) ||
    (Boolean(isPartOfAssigneeTeam) && !isCreator)
  );
};

interface TaskFeedCardFromTaskProps {
  task: Task;
  className?: string;
  isActive?: boolean;
  onAfterClose?: () => void;
  onUpdateEntityDetails?: () => void;
  isOpenInDrawer?: boolean;
  onTaskClick?: (task: Task) => void;
}

const TaskFeedCardFromTask = ({
  task,
  className = '',
  isActive,
  onAfterClose,
  onUpdateEntityDetails,
  isOpenInDrawer = false,
  onTaskClick,
}: TaskFeedCardFromTaskProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setActiveTask, showTaskDrawer } = useActivityFeedProvider();
  const { currentUser } = useApplicationStore();
  const { isAdminUser } = useAuth();
  const isTaskTags = isTagsTaskType(task.type);
  const isTaskDescription = isDescriptionTaskType(task.type);
  const taskDisplayId = useMemo(
    () => getTaskDisplayId(task.taskId),
    [task.taskId]
  );
  const { fieldPath, suggestedValue, isSuggestionEmpty } = useMemo(
    () => getNormalizedTaskPayload(task),
    [task]
  );
  const [, , user] = useUserProfile({
    permission: true,
    name: task.createdBy?.name ?? '',
  });

  const { entityType, entityFQN } = useMemo(
    () => ({
      entityType: (task.about?.type as EntityType) ?? EntityType.TABLE,
      entityFQN: task.about?.fullyQualifiedName ?? '',
    }),
    [task.about]
  );

  const isEntityDetailsAvailable = useMemo(
    () => Boolean(entityFQN) && Boolean(entityType),
    [entityFQN, entityType]
  );

  const taskColumnName = useMemo(() => {
    const columnName = fieldPath
      ? EntityLink.getTableColumnName(
          `<#E::${entityType}::${entityFQN}::${fieldPath}>`
        ) ?? ''
      : '';

    if (columnName) {
      return (
        <Typography className="p-r-xss column-name">
          {columnName} {t('label.in-lowercase')}
        </Typography>
      );
    }

    return null;
  }, [entityFQN, entityType, fieldPath, t]);

  const handleTaskLinkClick = () => {
    navigate(getTaskDetailPathFromTask(task));
    setActiveTask(task);
  };

  const handleCardClick = useCallback(() => {
    onTaskClick?.(task);
  }, [onTaskClick, task]);

  const taskLinkTitleElement = useMemo(
    () =>
      isEntityDetailsAvailable ? (
        <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
          <Button
            ellipsis
            className="tw:max-w-full"
            color="link-color"
            data-testid="redirect-task-button-link"
            tooltip={`#${taskDisplayId} ${t(
              getTaskTypeMessageKey(task) ?? 'label.task'
            )} ${getNameFromFQN(entityFQN)} (${entityType})`}
            onClick={handleTaskLinkClick}>
            <Typography className="m-r-xss task-details-id">{`#${taskDisplayId} `}</Typography>

            <Typography className="m-r-xss  m-r-xss task-details-entity-link">
              {t(getTaskTypeMessageKey(task) ?? 'label.task')}
            </Typography>

            {taskColumnName}

            <Typography
              className="break-all header-link text-sm tw:text-primary"
              data-testid="entity-link">
              {getNameFromFQN(entityFQN)}
            </Typography>

            <Typography className="p-l-xss text-sm entity-type">{`(${entityType})`}</Typography>
          </Button>
        </EntityPopOverCard>
      ) : null,
    [
      entityFQN,
      entityType,
      handleTaskLinkClick,
      isEntityDetailsAvailable,
      t,
      task,
      taskDisplayId,
      taskColumnName,
    ]
  );

  const isTaskTestCaseResult = task.type === TaskEntityType.TestCaseResolution;
  const isTaskApprovalRequest = [
    TaskEntityType.GlossaryApproval,
    TaskEntityType.RequestApproval,
  ].includes(task.type);
  const isTaskRecognizerFeedbackApproval = isRecognizerFeedbackTask(task);
  const isApprovalWorkflowTask =
    isTaskApprovalRequest || isTaskRecognizerFeedbackApproval;

  const getTransition = (resolutionType: TaskResolutionType) =>
    task.availableTransitions?.find(
      (transition) => transition.resolutionType === resolutionType
    ) ??
    task.availableTransitions?.find((transition) =>
      resolutionType === TaskResolutionType.Rejected
        ? transition.id === 'reject'
        : transition.id === 'approve'
    );

  const canQuickResolve = () =>
    task.status === TaskEntityStatus.Open && !isOntologyReviewTask(task);

  const updateTaskData = async (
    newValue: string,
    resolutionType: TaskResolutionType = TaskResolutionType.Approved
  ) => {
    if (!task?.id) {
      return;
    }
    try {
      const updatedTask = await resolveTaskAPI(
        task.id,
        getTaskResolveBody(task, {
          transitionId: getTransition(resolutionType)?.id,
          resolutionType,
          newValue,
        })
      );
      showSuccessToast(
        isTaskPendingFurtherApproval(updatedTask)
          ? 'Vote recorded.'
          : t('server.task-resolved-successfully')
      );
      onAfterClose?.();
      onUpdateEntityDetails?.();
    } catch (err) {
      showErrorToast(
        getErrorText(err as AxiosError, t('server.unexpected-error'))
      );
    }
  };

  const onTaskResolve = () => {
    if (!isApprovalWorkflowTask && isEmpty(suggestedValue)) {
      showErrorToast(
        t('message.field-text-is-required', {
          fieldText: isTaskTags
            ? t('label.tag-plural')
            : t('label.description'),
        })
      );

      return;
    }

    if (isTaskTags) {
      updateTaskData(suggestedValue || '[]');
    } else {
      const newValue = isApprovalWorkflowTask
        ? 'approved'
        : suggestedValue ?? '';
      updateTaskData(newValue);
    }
  };

  const onTaskReject = async () => {
    updateTaskData(
      isApprovalWorkflowTask ? 'rejected' : '',
      TaskResolutionType.Rejected
    );
  };

  const isCreator = isEqual(task.createdBy?.name, currentUser?.name);
  const checkIfUserPartOfTeam = useCallback(
    (teamId: string): boolean => {
      return Boolean(currentUser?.teams?.find((team) => teamId === team.id));
    },
    [currentUser]
  );
  const isAssignee = task.assignees?.some((assignee) =>
    isEqual(assignee.id, currentUser?.id)
  );
  const isPartOfAssigneeTeam = task.assignees?.some((assignee) =>
    assignee.type === 'team' ? checkIfUserPartOfTeam(assignee.id ?? '') : false
  );
  const hasEditAccess = getHasTaskEditAccess({
    isAdminUser,
    isTaskApprovalRequest,
    isAssignee,
    isPartOfAssigneeTeam,
    isCreator,
  });

  const showReplies = useCallback(() => {
    showTaskDrawer?.(task);
  }, [showTaskDrawer, task]);

  // The press must keep bubbling so the card also selects the task, as the
  // reply icon did before. ButtonUtility does not declare onPress, so it is
  // passed as typed react-aria props.
  const replyPressProps: Pick<AriaButtonProps, 'onPress'> = {
    onPress: (event: PressEvent) => {
      event.continuePropagation();
      showReplies();
    },
  };

  const commentsCount = task.comments?.length ?? 0;

  // Kept as a closure so the footer's own branching (reply count, edit
  // access, per-status action buttons) stays out of the component's own
  // cyclomatic complexity.
  const renderTaskFooter = () => (
    <Box
      align="center"
      className="task-feed-card-footer w-full tw:gap-y-3"
      justify="between"
      wrap="wrap">
      <Box align="center" gap={4}>
        <Box align="center" gap={2} justify="center">
          <ButtonUtility
            aria-label={t('label.reply')}
            color="tertiary"
            data-testid="task-reply-button"
            icon={Comment}
            size="sm"
            {...replyPressProps}
          />
          {commentsCount > 0 ? (
            <Button
              color="link-gray"
              data-testid="replies-count"
              onPress={showReplies}>
              {t(getReplyCountLabelKey(commentsCount), {
                number: commentsCount,
              })}
            </Button>
          ) : null}
        </Box>

        <Box align="center" className="tw:text-tertiary" gap={2}>
          <Owner
            isCompactView={false}
            owners={task.assignees ?? []}
            showLabel={false}
          />
        </Box>
      </Box>

      {!isTaskTestCaseResult && hasEditAccess && !isSuggestionEmpty && (
        <Box gap={4}>
          {canQuickResolve() && (
            <Button
              className="tw:gap-1.5 tw:text-success-primary tw:hover:text-success-primary"
              color="link-gray"
              data-testid="approve-button"
              iconLeading={
                <CheckCircleFilled
                  className="tw:shrink-0 tw:text-fg-success-primary"
                  size={14}
                />
              }
              size="xs"
              onPress={onTaskResolve}>
              {t('label.approve')}
            </Button>
          )}
          {canQuickResolve() && (
            <Button
              className="tw:gap-1.5"
              color="link-destructive"
              data-testid="reject-button"
              iconLeading={
                <CloseCircleFilled className="tw:shrink-0" size={14} />
              }
              size="xs"
              onPress={onTaskReject}>
              {t('label.reject')}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );

  const TaskStatusIcon = getTaskStatusIcon(task.status);

  return (
    // The less `task-feed-card-v1-new` rules (unlayered) own the surface,
    // border and active state; Card adds the clickable/focus behaviour.
    <Card
      isClickable
      aria-label={`#${taskDisplayId} ${t(
        getTaskTypeMessageKey(task) ?? 'label.task'
      )}`}
      className={classNames(
        className,
        'task-feed-card-v1-new',
        CARD_CONTAINER_CLASS_NAME,
        { active: isActive }
      )}
      data-testid="task-feed-card"
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardContainerKeyDown(handleCardClick)}>
      <Box
        className={classNames(
          'tw:min-w-0',
          getTaskRowGapClassName(
            isTaskTestCaseResult,
            isTaskApprovalRequest,
            isTaskDescription
          )
        )}
        wrap="wrap">
        <Box align="start" className="tw:w-full tw:min-w-0" direction="col">
          <div className="tw:flex tw:w-full tw:min-w-0 tw:items-center">
            <TaskStatusIcon
              className="tw:mr-1 tw:size-3.5 tw:shrink-0"
              data-testid={`task-status-icon-${task.status?.toLowerCase()}`}
            />
            <div className="tw:flex tw:min-w-0 tw:flex-1">
              {taskLinkTitleElement}
            </div>
          </div>
          <div className="tw:mt-1">
            <Typography>
              <UserPopOverCard
                key={task.createdBy?.name}
                userName={task.createdBy?.name ?? ''}>
                <Typography
                  className="task-created-by-text p-r-xss"
                  data-testid="task-created-by">
                  {getEntityName(user)}
                </Typography>
              </UserPopOverCard>
              <Typography className="task-timestamp-text">
                {t('message.created-this-task-lowercase')}
              </Typography>
              {task.createdAt && (
                <Tooltip
                  excludeTriggerFromTabOrder
                  title={formatDateTime(task.createdAt)}>
                  <Typography
                    className="p-l-xss task-timestamp-text"
                    data-testid="timestamp">
                    {getRelativeTime(task.createdAt)}
                  </Typography>
                </Tooltip>
              )}
            </Typography>
          </div>
        </Box>
        <div className="w-full">
          {isTaskTags && (
            <Card>
              <Card.Content>
                <TagsTaskFromTask hasEditAccess={false} task={task} />
              </Card.Content>
            </Card>
          )}
        </div>
        {isTaskDescription && (
          <DescriptionTaskFromTask hasEditAccess={false} task={task} />
        )}
        {!isOpenInDrawer && renderTaskFooter()}
      </Box>
    </Card>
  );
};

export default TaskFeedCardFromTask;
