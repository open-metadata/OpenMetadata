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

import Icon, { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import {
  Button as CoreButton,
  Owner,
  Tooltip,
} from '@openmetadata/ui-core-components';
import { Button, Card, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isEqual } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as TaskCloseIcon } from '../../../assets/svg/ic-close-task.svg';
import { ReactComponent as TaskOpenIcon } from '../../../assets/svg/ic-open-task.svg';
import { ReactComponent as ReplyIcon } from '../../../assets/svg/ic-reply-2.svg';
import EntityPopOverCard from '../../../components/common/PopOverCard/EntityPopOverCard';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import { TASK_ENTITY_TYPES } from '../../../constants/Task.constant';
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
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  CARD_CONTAINER_CLASS_NAME,
  handleCardContainerKeyDown,
} from '../ActivityFeedCardNew/ActivityFeedcardNew.utils';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './task-feed-card.less';

// What antd's Row/Col contributed: a wrapping flex row, and columns that never
// outgrow it; `span={24}` columns take a full line.
const COL_CLASS_NAME = 'tw:relative tw:max-w-full tw:min-h-px';
const FULL_ROW_COL_CLASS_NAME = `${COL_CLASS_NAME} tw:shrink-0 tw:grow-0 tw:basis-full`;

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
        <Typography.Text className="p-r-xss column-name">
          {columnName} {t('label.in-lowercase')}
        </Typography.Text>
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
            className="p-0 task-feed-header"
            data-testid="redirect-task-button-link"
            type="link"
            onClick={handleTaskLinkClick}>
            <Typography.Text className="m-r-xss task-details-id">{`#${taskDisplayId} `}</Typography.Text>

            <Typography.Text className="m-r-xss  m-r-xss task-details-entity-link">
              {t(TASK_ENTITY_TYPES[task.type] ?? 'label.task')}
            </Typography.Text>

            {taskColumnName}

            <Typography.Text
              className="break-all header-link text-sm"
              data-testid="entity-link">
              {getNameFromFQN(entityFQN)}
            </Typography.Text>

            <Typography.Text className="p-l-xss text-sm entity-type">{`(${entityType})`}</Typography.Text>
          </Button>
        </EntityPopOverCard>
      ) : null,
    [
      entityFQN,
      entityType,
      handleTaskLinkClick,
      isEntityDetailsAvailable,
      t,
      task.type,
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

  const getTransitionId = (resolutionType: TaskResolutionType) =>
    task.availableTransitions?.find(
      (transition) => transition.resolutionType === resolutionType
    )?.id ??
    task.availableTransitions?.find((transition) =>
      resolutionType === TaskResolutionType.Rejected
        ? transition.id === 'reject'
        : transition.id === 'approve'
    )?.id;

  const updateTaskData = async (
    newValue: string,
    resolutionType: TaskResolutionType = TaskResolutionType.Approved
  ) => {
    if (!task?.id) {
      return;
    }
    try {
      const updatedTask = await resolveTaskAPI(task.id, {
        transitionId: getTransitionId(resolutionType),
        resolutionType,
        newValue,
      });
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

  const commentsCount = task.comments?.length ?? 0;

  // Kept as a closure so the footer's own branching (reply count, edit
  // access, per-status action buttons) stays out of the component's own
  // cyclomatic complexity.
  const renderTaskFooter = () => (
    <div
      className={classNames(
        'task-feed-card-footer d-flex flex-wrap align-center justify-between',
        FULL_ROW_COL_CLASS_NAME
      )}>
      <div className={classNames('d-flex', COL_CLASS_NAME)}>
        <div className={classNames('d-flex flex-center', COL_CLASS_NAME)}>
          <ReplyIcon
            className="m-r-xs"
            height={20}
            width={20}
            onClick={showReplies}
          />
          {commentsCount > 0 ? (
            <CoreButton
              className="posts-length m-r-xss"
              color="link-gray"
              data-testid="replies-count"
              onPress={showReplies}>
              {t(getReplyCountLabelKey(commentsCount), {
                number: commentsCount,
              })}
            </CoreButton>
          ) : null}
        </div>

        <div
          className={classNames(
            'flex items-center gap-2 text-grey-muted',
            COL_CLASS_NAME,
            { 'task-card-assignee': commentsCount > 0 }
          )}>
          <Owner
            isCompactView={false}
            owners={task.assignees ?? []}
            showLabel={false}
          />
        </div>
      </div>

      {!isTaskTestCaseResult && hasEditAccess && !isSuggestionEmpty && (
        <div className={classNames('d-flex gap-2', COL_CLASS_NAME)}>
          {task.status === TaskEntityStatus.Open && (
            <CoreButton
              noTextPadding
              className="task-card-approve-btn tw:h-8 tw:gap-2"
              color="tertiary"
              data-testid="approve-button"
              iconLeading={<CheckCircleFilled />}
              onPress={onTaskResolve}>
              {t('label.approve')}
            </CoreButton>
          )}
          {task.status === TaskEntityStatus.Open && (
            <CoreButton
              noTextPadding
              className="task-card-reject-btn tw:h-8 tw:gap-2"
              color="tertiary"
              data-testid="reject-button"
              iconLeading={<CloseCircleFilled />}
              onPress={onTaskReject}>
              {t('label.reject')}
            </CoreButton>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      aria-label={`#${taskDisplayId} ${t(
        TASK_ENTITY_TYPES[task.type] ?? 'label.task'
      )}`}
      className={CARD_CONTAINER_CLASS_NAME}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardContainerKeyDown(handleCardClick)}>
      <div
        className={classNames(className, 'task-feed-card-v1-new', {
          active: isActive,
        })}
        data-testid="task-feed-card">
        <div
          className={classNames(
            'tw:flex tw:min-w-0 tw:flex-wrap',
            getTaskRowGapClassName(
              isTaskTestCaseResult,
              isTaskApprovalRequest,
              isTaskDescription
            )
          )}>
          <div
            className={classNames(
              'd-flex flex-col align-start',
              COL_CLASS_NAME
            )}>
            <div className={COL_CLASS_NAME}>
              <Icon
                className="m-r-xss m-t-xss text-md"
                component={getTaskStatusIcon(task.status)}
                data-testid={`task-status-icon-${task.status?.toLowerCase()}`}
              />
              {taskLinkTitleElement}
            </div>
            <div className={classNames('tw:-mt-2', COL_CLASS_NAME)}>
              <span className="tw:text-primary">
                <UserPopOverCard
                  key={task.createdBy?.name}
                  userName={task.createdBy?.name ?? ''}>
                  <span
                    className="task-created-by-text p-r-xss"
                    data-testid="task-created-by">
                    {getEntityName(user)}
                  </span>
                </UserPopOverCard>
                <span className="task-timestamp-text">
                  {t('message.created-this-task-lowercase')}
                </span>
                {task.createdAt && (
                  <Tooltip
                    excludeTriggerFromTabOrder
                    title={formatDateTime(task.createdAt)}>
                    <span
                      className="p-l-xss task-timestamp-text"
                      data-testid="timestamp">
                      {getRelativeTime(task.createdAt)}
                    </span>
                  </Tooltip>
                )}
              </span>
            </div>
          </div>
          <div className={FULL_ROW_COL_CLASS_NAME}>
            {isTaskTags && (
              <Card
                bordered
                className="activity-feed-card-message tags-card-container">
                <TagsTaskFromTask hasEditAccess={false} task={task} />
              </Card>
            )}
          </div>
          {isTaskDescription && (
            <DescriptionTaskFromTask hasEditAccess={false} task={task} />
          )}
          {!isOpenInDrawer && renderTaskFooter()}
        </div>
      </div>
    </div>
  );
};

export default TaskFeedCardFromTask;
