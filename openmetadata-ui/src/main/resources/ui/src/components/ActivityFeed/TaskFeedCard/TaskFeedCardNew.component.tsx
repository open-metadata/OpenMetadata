/*
 *  Copyright 2023 Collate.
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

import classNames from 'classnames';
import { isEmpty, isEqual, isUndefined, lowerCase } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as TaskCloseIcon } from '../../../assets/svg/ic-close-task.svg';
import { ReactComponent as TaskOpenIcon } from '../../../assets/svg/ic-open-task.svg';
import { ReactComponent as ReplyIcon } from '../../../assets/svg/ic-reply-2.svg';
import EntityPopOverCard from '../../../components/common/PopOverCard/EntityPopOverCard';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import {
  TaskDetails,
  Thread,
  ThreadTaskStatus,
} from '../../../generated/entity/feed/thread';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import EntityLink from '../../../utils/EntityLink';
import { getEntityFQN, getEntityType } from '../../../utils/FeedUtils';

import { AxiosError } from 'axios';
import { TaskOperation } from '../../../constants/Feeds.constants';
import { TASK_TYPES } from '../../../constants/Task.constant';
import { TaskType } from '../../../generated/api/feed/createThread';
import { ResolveTask } from '../../../generated/api/feed/resolveTask';
import { useAuth } from '../../../hooks/authHooks';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import DescriptionTaskNew from '../../../pages/TasksPage/shared/DescriptionTaskNew';
import TagsTask from '../../../pages/TasksPage/shared/TagsTask';
import { updateTask } from '../../../rest/feedsAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { getErrorText } from '../../../utils/StringsUtils';
import {
  getTaskDetailPath,
  isDescriptionTask,
  isTagsTask,
} from '../../../utils/TasksUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './task-feed-card.less';
import { getNameFromFQN } from '../../../utils/CommonUtils';

interface TaskFeedCardProps {
  feed: Thread;
  className?: string;
  isActive?: boolean;
  onAfterClose?: () => void;
  onUpdateEntityDetails?: () => void;
  isForFeedTab?: boolean;
  isOpenInDrawer?: boolean;
  hideCardBorder?: boolean;
  isFeedWidget?: boolean;
}

const TaskFeedCard = ({
  feed,
  className = '',
  isActive,
  onAfterClose,
  onUpdateEntityDetails,
  isForFeedTab = false,
  isOpenInDrawer = false,
  hideCardBorder = false,
}: TaskFeedCardProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setActiveThread } = useActivityFeedProvider();
  const { currentUser } = useApplicationStore();
  const { isAdminUser } = useAuth();
  const { threadTs: timeStamp, task: taskDetails } = feed;
  const { showDrawer } = useActivityFeedProvider();
  const isTaskTags = isTagsTask(taskDetails?.type as TaskType);
  const isTaskDescription = isDescriptionTask(taskDetails?.type as TaskType);
  const [, , user] = useUserProfile({
    permission: true,
    name: feed.createdBy ?? '',
  });

  const { entityType, entityFQN } = useMemo(
    () => ({
      entityType: getEntityType(feed.about) ?? '',
      entityFQN: getEntityFQN(feed.about) ?? '',
    }),
    [feed.about]
  );

  const isEntityDetailsAvailable = useMemo(
    () => !isUndefined(entityFQN) && !isUndefined(entityType),
    [entityFQN, entityType]
  );

  const taskColumnName = useMemo(() => {
    const columnName = EntityLink.getTableColumnName(feed.about) ?? '';

    if (columnName) {
      return (
        <Typography.Text className="p-r-xss column-name">
          {columnName} {t('label.in-lowercase')}
        </Typography.Text>
      );
    }

    return null;
  }, [feed]);

  const handleTaskLinkClick = () => {
    navigate(getTaskDetailPath(feed));
    setActiveThread(feed);
  };

  const taskLinkTitleElement = useMemo(() => {
    const isRecognizerFeedback =
      taskDetails?.type === TaskType.RecognizerFeedbackApproval;
    const tagName = isRecognizerFeedback
      ? getNameFromFQN(taskDetails?.feedback?.tagFQN ?? '')
      : '';

    return isEntityDetailsAvailable && !isUndefined(taskDetails) ? (
      <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
        <Button
          className="p-0 task-feed-header"
          data-testid="redirect-task-button-link"
          type="link"
          onClick={handleTaskLinkClick}>
          <Typography.Text className="m-r-xss task-details-id">{`#${taskDetails.id} `}</Typography.Text>

          <Typography.Text className="m-r-xss  m-r-xss task-details-entity-link">
            {isRecognizerFeedback && tagName
              ? `${t(TASK_TYPES[taskDetails.type])}: ${tagName}`
              : t(TASK_TYPES[taskDetails.type])}
          </Typography.Text>

          {!isRecognizerFeedback && taskColumnName}

          {!isRecognizerFeedback && (
            <Typography.Text
              className="break-all header-link text-sm"
              data-testid="entity-link">
              {tagName}
            </Typography.Text>
          )}

          {!isRecognizerFeedback && (
            <Typography.Text className="p-l-xss text-sm entity-type">{`(${entityType})`}</Typography.Text>
          )}
        </Button>
      </EntityPopOverCard>
    ) : null;
  }, [isEntityDetailsAvailable, entityFQN, entityType, taskDetails, t]);

  const isTaskTestCaseResult =
    taskDetails?.type === TaskType.RequestTestCaseFailureResolution;
  const isTaskGlossaryApproval = taskDetails?.type === TaskType.RequestApproval;
  const isTaskRecognizerFeedbackApproval =
    taskDetails?.type === TaskType.RecognizerFeedbackApproval;

  const updateTaskData = (data: TaskDetails | ResolveTask) => {
    if (!taskDetails?.id) {
      return;
    }
    updateTask(TaskOperation.RESOLVE, taskDetails?.id + '', data)
      .then(() => {
        showSuccessToast(t('server.task-resolved-successfully'));
        onAfterClose?.();
        onUpdateEntityDetails?.();
      })
      .catch((err: AxiosError) =>
        showErrorToast(getErrorText(err, t('server.unexpected-error')))
      );
  };
  const onTaskResolve = () => {
    if (
      !isTaskGlossaryApproval &&
      !isTaskRecognizerFeedbackApproval &&
      isEmpty(taskDetails?.suggestion)
    ) {
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
      const tagsData = {
        newValue: taskDetails?.suggestion || '[]',
      };

      updateTaskData(tagsData as TaskDetails);
    } else {
      const newValue =
        isTaskGlossaryApproval || isTaskRecognizerFeedbackApproval
          ? 'approved'
          : taskDetails?.suggestion;
      const data = { newValue: newValue };
      updateTaskData(data as TaskDetails);
    }
  };
  const onTaskReject = () => {
    const updatedComment = 'Rejected';
    if (isTaskGlossaryApproval || isTaskRecognizerFeedbackApproval) {
      const data = { newValue: 'Rejected' };
      updateTaskData(data as TaskDetails);

      return;
    }
    updateTask(TaskOperation.REJECT, taskDetails?.id + '', {
      comment: updatedComment,
    } as unknown as TaskDetails)
      .then(() => {
        showSuccessToast(t('server.task-closed-successfully'));
        onAfterClose?.();
        onUpdateEntityDetails?.();
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };
  const isCreator = isEqual(feed.createdBy, currentUser?.name);
  const checkIfUserPartOfTeam = useCallback(
    (teamId: string): boolean => {
      return Boolean(currentUser?.teams?.find((team) => teamId === team.id));
    },
    [currentUser]
  );
  const isAssignee = taskDetails?.assignees?.some((assignee) =>
    isEqual(assignee.id, currentUser?.id)
  );
  const isPartOfAssigneeTeam = taskDetails?.assignees?.some((assignee) =>
    assignee.type === 'team' ? checkIfUserPartOfTeam(assignee.id) : false
  );
  const hasEditAccess =
    (isAdminUser && !isTaskGlossaryApproval && !isTaskRecognizerFeedbackApproval) ||
    isAssignee ||
    (Boolean(isPartOfAssigneeTeam) && !isCreator);

  const isSuggestionEmpty =
    (isEqual(taskDetails?.suggestion, '[]') &&
      taskDetails?.type === TaskType.RequestTag) ||
    (!taskDetails?.suggestion &&
      taskDetails?.type === TaskType.RequestDescription);

  const showReplies = useCallback(() => {
    showDrawer?.(feed);
  }, [showDrawer, feed]);

  return (
    <Button block className="remove-button-default-styling" type="text">
      <div
        className={classNames(className, 'task-feed-card-v1-new', {
          active: isActive,
          'no-bg-border': hideCardBorder,
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
                  taskDetails?.status === ThreadTaskStatus.Open
                    ? TaskOpenIcon
                    : TaskCloseIcon
                }
                data-testid={`task-status-icon-${lowerCase(
                  taskDetails?.status
                )}`}
              />
              {taskLinkTitleElement}
            </Col>
            <Col style={{ marginTop: '-8px' }}>
              <Typography.Text>
                <UserPopOverCard
                  key={feed.createdBy}
                  userName={feed.createdBy ?? ''}>
                  <span
                    className="task-created-by-text p-r-xss"
                    data-testid="task-created-by">
                    {getEntityName(user)}
                  </span>
                </UserPopOverCard>
                <span className="task-timestamp-text">
                  {t('message.created-this-task-lowercase')}
                </span>
                {timeStamp && (
                  <Tooltip title={formatDateTime(timeStamp)}>
                    <span
                      className="p-l-xss task-timestamp-text"
                      data-testid="timestamp">
                      {getRelativeTime(timeStamp)}
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
                <TagsTask
                  hasEditAccess={false}
                  isTaskActionEdit={false}
                  task={taskDetails}
                />
              </Card>
            )}
          </Col>
          {isTaskDescription && (
            <DescriptionTaskNew
              hasEditAccess={false}
              isTaskActionEdit={false}
              taskThread={feed}
            />
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
                    onClick={isForFeedTab ? showReplies : undefined}
                  />
                  {feed?.postsCount && feed?.postsCount > 0 ? (
                    <Button
                      className="posts-length m-r-xss p-0 remove-button-default-styling"
                      data-testid="replies-count"
                      type="link"
                      onClick={isForFeedTab ? showReplies : undefined}>
                      {t(
                        feed.postsCount === 1
                          ? 'label.one-reply'
                          : 'label.number-reply-plural',
                        { number: feed.postsCount }
                      )}
                    </Button>
                  ) : null}
                </Col>

                <Col
                  className={`flex items-center gap-2 text-grey-muted ${
                    feed?.posts && feed?.posts?.length > 0
                      ? 'task-card-assignee'
                      : ''
                  }`}>
                  <OwnerLabel
                    isCompactView={false}
                    owners={feed?.task?.assignees}
                    showLabel={false}
                  />
                </Col>
              </Col>

              {!isTaskTestCaseResult && hasEditAccess && !isSuggestionEmpty && (
                <Col className="d-flex gap-2">
                  {feed.task?.status === ThreadTaskStatus.Open && (
                    <Button
                      className="task-card-approve-btn d-flex items-center"
                      data-testid="approve-button"
                      icon={<CheckCircleFilled />}
                      onClick={onTaskResolve}>
                      {t('label.approve')}
                    </Button>
                  )}
                  {feed.task?.status === ThreadTaskStatus.Open && (
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

export default TaskFeedCard;
