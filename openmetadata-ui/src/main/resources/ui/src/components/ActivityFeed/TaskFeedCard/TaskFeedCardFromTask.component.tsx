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
import { Button, Card, Col, Row, Tooltip, Typography } from 'antd';
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
import { TagLabel } from '../../../generated/type/tagLabel';
import { useAuth } from '../../../hooks/authHooks';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import DescriptionTaskFromTask from '../../../pages/TasksPage/shared/DescriptionTaskFromTask';
import TagsTaskFromTask from '../../../pages/TasksPage/shared/TagsTaskFromTask';
import {
  closeTask as closeTaskAPI,
  resolveTask as resolveTaskAPI,
  Task,
  TaskEntityStatus,
  TaskEntityType,
  TaskResolutionType,
} from '../../../rest/tasksAPI';
import { getNameFromFQN } from '../../../utils/CommonUtils';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import EntityLink from '../../../utils/EntityLink';
import { getEntityName } from '../../../utils/EntityUtils';
import { getErrorText } from '../../../utils/StringsUtils';
import {
  getTaskDetailPathFromTask,
  isDescriptionTaskType,
  isTagsTaskType,
} from '../../../utils/TasksUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './task-feed-card.less';

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
  const payload = task.payload;
  const isTaskTags = isTagsTaskType(task.type);
  const isTaskDescription = isDescriptionTaskType(task.type);

  // Compute suggestedValue from new payload format (tagsToAdd, currentTags) or use old format
  const computedSuggestedValue = useMemo(() => {
    if (!isTaskTags) {
      return payload?.suggestedValue as string | undefined;
    }
    // For tags: support new format (tagsToAdd, currentTags, tagsToRemove)
    if (payload?.tagsToAdd || payload?.tagsToRemove || payload?.currentTags) {
      const tagsToAdd = (payload.tagsToAdd as TagLabel[]) ?? [];
      const tagsToRemove = (payload.tagsToRemove as TagLabel[]) ?? [];
      const currentTags = (payload.currentTags as TagLabel[]) ?? [];

      const removeFQNs = new Set(tagsToRemove.map((t: TagLabel) => t.tagFQN));
      const result = currentTags.filter(
        (t: TagLabel) => !removeFQNs.has(t.tagFQN)
      );
      const suggestedTags = [...result, ...tagsToAdd];

      return suggestedTags.length > 0
        ? JSON.stringify(suggestedTags)
        : undefined;
    }

    return payload?.suggestedValue as string | undefined;
  }, [payload, isTaskTags]);
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
    const columnName = task.about?.name
      ? EntityLink.getTableColumnName(
          `<#E::${entityType}::${entityFQN}::columns::${task.about.name}>`
        )
      : '';

    if (columnName) {
      return (
        <Typography.Text className="p-r-xss column-name">
          {columnName} {t('label.in-lowercase')}
        </Typography.Text>
      );
    }

    return null;
  }, [task, entityType, entityFQN]);

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
            <Typography.Text className="m-r-xss task-details-id">{`#${task.taskId} `}</Typography.Text>

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
    [isEntityDetailsAvailable, entityFQN, entityType, task]
  );

  const isTaskTestCaseResult = task.type === TaskEntityType.TestCaseResolution;
  const isTaskGlossaryApproval = task.type === TaskEntityType.GlossaryApproval;

  const updateTaskData = async (newValue: string) => {
    if (!task?.id) {
      return;
    }
    try {
      await resolveTaskAPI(task.id, {
        resolutionType: TaskResolutionType.Approved,
        newValue,
      });
      showSuccessToast(t('server.task-resolved-successfully'));
      onAfterClose?.();
      onUpdateEntityDetails?.();
    } catch (err) {
      showErrorToast(
        getErrorText(err as AxiosError, t('server.unexpected-error'))
      );
    }
  };

  const onTaskResolve = () => {
    if (!isTaskGlossaryApproval && isEmpty(computedSuggestedValue)) {
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
      updateTaskData(computedSuggestedValue || '[]');
    } else {
      const newValue = isTaskGlossaryApproval
        ? 'approved'
        : computedSuggestedValue ?? '';
      updateTaskData(newValue);
    }
  };

  const onTaskReject = async () => {
    const updatedComment = 'Rejected';
    if (isTaskGlossaryApproval) {
      updateTaskData('Rejected');

      return;
    }

    if (!task?.id) {
      return;
    }

    try {
      await closeTaskAPI(task.id, updatedComment);
      showSuccessToast(t('server.task-closed-successfully'));
      onAfterClose?.();
      onUpdateEntityDetails?.();
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
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
  const hasEditAccess =
    (isAdminUser && !isTaskGlossaryApproval) ||
    isAssignee ||
    (Boolean(isPartOfAssigneeTeam) && !isCreator);

  const isSuggestionEmpty =
    (isEqual(payload?.suggestedValue, '[]') &&
      task.type === TaskEntityType.TagUpdate) ||
    (!payload?.suggestedValue &&
      task.type === TaskEntityType.DescriptionUpdate);

  const showReplies = useCallback(() => {
    showTaskDrawer?.(task);
  }, [showTaskDrawer, task]);

  const commentsCount = task.comments?.length ?? 0;

  return (
    <Button
      block
      className="remove-button-default-styling"
      type="text"
      onClick={handleCardClick}>
      <div
        className={classNames(className, 'task-feed-card-v1-new', {
          active: isActive,
        })}
        data-testid="task-feed-card">
        <Row
          gutter={
            isTaskTestCaseResult || isTaskGlossaryApproval
              ? [0, 6]
              : isTaskDescription
              ? undefined
              : [0, 14]
          }>
          <Col className="d-flex flex-col align-start">
            <Col>
              <Icon
                className="m-r-xss m-t-xss text-md"
                component={
                  task.status === TaskEntityStatus.Open
                    ? TaskOpenIcon
                    : TaskCloseIcon
                }
                data-testid={`task-status-icon-${task.status?.toLowerCase()}`}
              />
              {taskLinkTitleElement}
            </Col>
            <Col style={{ marginTop: '-8px' }}>
              <Typography.Text>
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
                  <Tooltip title={formatDateTime(task.createdAt)}>
                    <span
                      className="p-l-xss task-timestamp-text"
                      data-testid="timestamp">
                      {getRelativeTime(task.createdAt)}
                    </span>
                  </Tooltip>
                )}
              </Typography.Text>
            </Col>
          </Col>
          <Col span={24}>
            {isTaskTags && (
              <Card
                bordered
                className="activity-feed-card-message tags-card-container">
                <TagsTaskFromTask hasEditAccess={false} task={task} />
              </Card>
            )}
          </Col>
          {isTaskDescription && (
            <DescriptionTaskFromTask hasEditAccess={false} task={task} />
          )}
          {!isOpenInDrawer && (
            <Col
              className="task-feed-card-footer  d-flex flex-wrap align-center justify-between"
              span={24}>
              <Col className="d-flex">
                <Col className="d-flex flex-center">
                  <ReplyIcon
                    className="m-r-xs"
                    height={20}
                    width={20}
                    onClick={showReplies}
                  />
                  {commentsCount > 0 ? (
                    <Button
                      className="posts-length m-r-xss p-0 remove-button-default-styling"
                      data-testid="replies-count"
                      type="link"
                      onClick={showReplies}>
                      {t(
                        commentsCount === 1
                          ? 'label.one-reply'
                          : 'label.number-reply-plural',
                        { number: commentsCount }
                      )}
                    </Button>
                  ) : null}
                </Col>

                <Col
                  className={`flex items-center gap-2 text-grey-muted ${
                    commentsCount > 0 ? 'task-card-assignee' : ''
                  }`}>
                  <OwnerLabel
                    isCompactView={false}
                    owners={task.assignees}
                    showLabel={false}
                  />
                </Col>
              </Col>

              {!isTaskTestCaseResult && hasEditAccess && !isSuggestionEmpty && (
                <Col className="d-flex gap-2">
                  {task.status === TaskEntityStatus.Open && (
                    <Button
                      className="task-card-approve-btn d-flex items-center"
                      data-testid="approve-button"
                      icon={<CheckCircleFilled />}
                      onClick={onTaskResolve}>
                      {t('label.approve')}
                    </Button>
                  )}
                  {task.status === TaskEntityStatus.Open && (
                    <Button
                      className="task-card-reject-btn d-flex items-center"
                      data-testid="reject-button"
                      icon={<CloseCircleFilled />}
                      type="default"
                      onClick={onTaskReject}>
                      {t('label.reject')}
                    </Button>
                  )}
                </Col>
              )}
            </Col>
          )}
        </Row>
      </div>
    </Button>
  );
};

export default TaskFeedCardFromTask;
