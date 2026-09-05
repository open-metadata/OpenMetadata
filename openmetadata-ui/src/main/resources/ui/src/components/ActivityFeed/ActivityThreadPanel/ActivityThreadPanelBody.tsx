/*
 *  Copyright 2022 Collate.
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

import { Button, Space, Switch, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import {
  FC,
  Fragment,
  lazy,
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { observerOptions } from '../../../constants/Mydata.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import { Paging } from '../../../generated/type/paging';
import { useElementInView } from '../../../hooks/useElementInView';
import {
  createConversation,
  listConversations,
} from '../../../rest/conversationsAPI';
import { TaskStatusGroup } from '../../../rest/tasksAPI';
import { getEntityFQN, getEntityType } from '../../../utils/FeedUtilsPure';
import { showErrorToast } from '../../../utils/ToastUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import Loader from '../../common/Loader/Loader';
import ActivityFeedCardNew from '../ActivityFeedCardNew/ActivityFeedcardNew.component';
import FeedPanelBodyV1New from '../ActivityFeedPanel/FeedPanelBodyV1New';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import { ActivityThreadPanelBodyProp } from './ActivityThreadPanel.interface';

const TaskTabNew = withSuspenseFallback(
  lazy(() =>
    import('../../Entity/Task/TaskTab/TaskTabNew.component').then((module) => ({
      default: module.TaskTabNew,
    }))
  )
);

const ErrorPlaceHolder = withSuspenseFallback(
  lazy(() => import('../../common/ErrorWithPlaceholder/ErrorPlaceHolder'))
);

const FeedPanelHeader = withSuspenseFallback(
  lazy(() => import('../ActivityFeedPanel/FeedPanelHeader'))
);

const TaskFeedCardFromTask = withSuspenseFallback(
  lazy(() => import('../TaskFeedCard/TaskFeedCardFromTask.component'))
);

const ActivityFeedEditor = withSuspenseFallback(
  lazy(() => import('../ActivityFeedEditor/ActivityFeedEditor'))
);

const ActivityThreadPanelBody: FC<ActivityThreadPanelBodyProp> = ({
  threadLink,
  onCancel,
  className,
  showHeader = true,
  view,
}) => {
  const { t } = useTranslation();
  const {
    entityThread: conversations,
    entityPaging,
    getTaskData,
    loading,
    refreshActivityFeed,
    selectedTask,
    selectedThread: selectedConversation,
    setActiveTask,
    setActiveThread: setActiveConversation,
    tasks,
  } = useActivityFeedProvider();
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [isConversationLoading, setIsConversationLoading] = useState(false);
  const [taskStatusGroup, setTaskStatusGroup] = useState<TaskStatusGroup>(
    TaskStatusGroup.Open
  );
  const [elementRef, isInView] = useElementInView(observerOptions);
  const conversationsRef = useRef(conversations);

  const isTaskType = view === 'tasks';
  const isConversationType = view === 'conversations';
  const isTaskClosed = taskStatusGroup === TaskStatusGroup.Closed;

  const getPanelData = useCallback(
    async (after?: string) => {
      if (isTaskType) {
        await getTaskData?.(
          FeedFilter.ALL,
          after,
          (threadLink ? getEntityType(threadLink) : undefined) as EntityType,
          threadLink ? getEntityFQN(threadLink) : undefined,
          taskStatusGroup
        );

        return;
      }

      setIsConversationLoading(true);
      try {
        const response = await listConversations({
          after,
          entityLink: threadLink,
        });
        refreshActivityFeed(
          after
            ? [...conversationsRef.current, ...response.data]
            : response.data
        );
        setPaging(response.paging);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.conversation-plural-lowercase'),
          })
        );
      } finally {
        setIsConversationLoading(false);
      }
    },
    [
      getTaskData,
      isTaskType,
      refreshActivityFeed,
      taskStatusGroup,
      threadLink,
      t,
    ]
  );

  const onPostConversation = async (message: string) => {
    try {
      const conversation = await createConversation({
        about: threadLink,
        message,
      });
      refreshActivityFeed([conversation, ...conversations]);
      setShowNewConversation(false);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.conversation'),
        })
      );
    }
  };

  const onBack = () => {
    setActiveConversation(undefined);
    setActiveTask(undefined);
  };

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    const escapeKeyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel?.();
      }
    };
    document.addEventListener('keydown', escapeKeyHandler);

    return () => document.removeEventListener('keydown', escapeKeyHandler);
  }, [onCancel]);

  useEffect(() => {
    setActiveConversation(undefined);
    getPanelData();
  }, [getPanelData, setActiveConversation]);

  useEffect(() => {
    const currentPaging = isTaskType ? entityPaging : paging;
    const currentLoading = isTaskType ? loading : isConversationLoading;
    if (isInView && currentPaging?.after && !currentLoading) {
      getPanelData(currentPaging.after);
    }
  }, [
    entityPaging,
    getPanelData,
    isConversationLoading,
    isInView,
    isTaskType,
    loading,
    paging,
  ]);

  const isPanelLoading = isTaskType ? loading : isConversationLoading;
  const hasNoConversations =
    conversations.length === 0 && !isConversationLoading;

  const backButton = (
    <Button className="m-b-sm p-0" size="small" type="link" onClick={onBack}>
      {t('label.back')}
    </Button>
  );

  const taskListContent =
    tasks.length === 0 && !loading ? (
      <ErrorPlaceHolder className="mt-24" type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        <Typography.Paragraph>
          {isTaskClosed
            ? t('message.no-closed-task')
            : t('message.no-open-task')}
        </Typography.Paragraph>
      </ErrorPlaceHolder>
    ) : (
      <div className={classNames(className, 'd-flex flex-col gap-3')}>
        {tasks.map((task) => (
          <TaskFeedCardFromTask
            isOpenInDrawer
            isActive={selectedTask?.id === task.id}
            key={task.id}
            task={task}
            onAfterClose={() => getPanelData()}
            onTaskClick={setActiveTask}
          />
        ))}
      </div>
    );

  const listView = (
    <Fragment>
      {(showNewConversation || hasNoConversations) && isConversationType && (
        <Space className="w-full" direction="vertical">
          <Typography.Paragraph>
            {t('message.new-conversation')}
          </Typography.Paragraph>
          <ActivityFeedEditor
            placeHolder={t('message.enter-a-field', {
              field: t('label.message-lowercase'),
            })}
            onSave={onPostConversation}
          />
        </Space>
      )}

      {isTaskType ? (
        taskListContent
      ) : (
        <div className={classNames(className, 'd-flex flex-col gap-3')}>
          {conversations.map((conversation) => (
            <FeedPanelBodyV1New
              isForFeedTab
              feed={conversation}
              isActive={false}
              key={conversation.id}
              onFeedClick={setActiveConversation}
            />
          ))}
        </div>
      )}

      <div
        data-testid="observer-element"
        id="observer-element"
        ref={elementRef as RefObject<HTMLDivElement>}>
        {isPanelLoading ? <Loader /> : null}
      </div>
    </Fragment>
  );

  let panelContent: ReactNode;
  if (isTaskType && !isUndefined(selectedTask)) {
    panelContent = (
      <Fragment>
        {backButton}
        <TaskTabNew
          entityType={
            (selectedTask.about?.type as EntityType) ?? EntityType.TABLE
          }
          hasGlossaryReviewer={false}
          owners={[]}
          task={selectedTask}
        />
      </Fragment>
    );
  } else if (!isUndefined(selectedConversation)) {
    panelContent = (
      <Fragment>
        {backButton}
        <ActivityFeedCardNew
          isForFeedTab
          isOpenInDrawer
          showThread
          feed={selectedConversation}
        />
      </Fragment>
    );
  } else {
    panelContent = listView;
  }

  return (
    <Fragment>
      <div id="thread-panel-body">
        {showHeader && isConversationType && (
          <FeedPanelHeader
            entityLink={selectedConversation?.about ?? threadLink}
            noun={t('label.conversation-plural')}
            onCancel={() => onCancel?.()}
            onShowNewConversation={
              conversations.length > 0 && isUndefined(selectedConversation)
                ? setShowNewConversation
                : undefined
            }
          />
        )}
        {isTaskType && (
          <Space
            align="center"
            className="w-full justify-end p-r-xs m-t-xs"
            size={4}>
            <Switch
              size="small"
              onChange={(checked) =>
                setTaskStatusGroup(
                  checked ? TaskStatusGroup.Closed : TaskStatusGroup.Open
                )
              }
            />
            <span>{t('label.closed-task-plural')}</span>
          </Space>
        )}

        {panelContent}
      </div>
    </Fragment>
  );
};

export default ActivityThreadPanelBody;
