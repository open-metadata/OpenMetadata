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
import { Operation } from 'fast-json-patch';
import { isEqual, isUndefined } from 'lodash';
import React, { FC, Fragment, RefObject, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { confirmStateInitialValue } from '../../../constants/Feeds.constants';
import { observerOptions } from '../../../constants/Mydata.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import {
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { Paging } from '../../../generated/type/paging';
import { useElementInView } from '../../../hooks/useElementInView';
import { getAllFeeds } from '../../../rest/feedsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useAuthContext } from '../../Auth/AuthProviders/AuthProvider';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import ConfirmationModal from '../../Modals/ConfirmationModal/ConfirmationModal';
import { ConfirmState } from '../ActivityFeedCard/ActivityFeedCard.interface';
import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditor';
import FeedPanelHeader from '../ActivityFeedPanel/FeedPanelHeader';
import ActivityThread from './ActivityThread';
import ActivityThreadList from './ActivityThreadList';
import { ActivityThreadPanelBodyProp } from './ActivityThreadPanel.interface';
import AnnouncementThreads from './AnnouncementThreads';

const ActivityThreadPanelBody: FC<ActivityThreadPanelBodyProp> = ({
  threadLink,
  editAnnouncementPermission,
  onCancel,
  postFeedHandler,
  createThread,
  deletePostHandler,
  updateThreadHandler,
  className,
  showHeader = true,
  threadType,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuthContext();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread>();
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [showNewConversation, setShowNewConversation] =
    useState<boolean>(false);

  const [confirmationState, setConfirmationState] = useState<ConfirmState>(
    confirmStateInitialValue
  );

  const [elementRef, isInView] = useElementInView(observerOptions);

  const [paging, setPaging] = useState<Paging>({} as Paging);

  const [isThreadLoading, setIsThreadLoading] = useState(false);

  const [taskStatus, setTaskStatus] = useState<ThreadTaskStatus>(
    ThreadTaskStatus.Open
  );

  const isTaskType = isEqual(threadType, ThreadType.Task);

  const isConversationType = isEqual(threadType, ThreadType.Conversation);

  const isTaskClosed = isEqual(taskStatus, ThreadTaskStatus.Closed);

  const isAnnouncementType = threadType === ThreadType.Announcement;

  const getThreads = (after?: string) => {
    const status = isTaskType ? taskStatus : undefined;
    setIsThreadLoading(true);
    getAllFeeds(threadLink, after, threadType, FeedFilter.ALL, status)
      .then((res) => {
        const { data, paging: pagingObj } = res;
        setThreads((prevData) => {
          if (after) {
            return [...prevData, ...data];
          } else {
            return [...data];
          }
        });
        setPaging(pagingObj);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.entity-fetch-error', {
            entity: t('label.thread-plural-lowercase'),
          })
        );
      })
      .finally(() => {
        setIsThreadLoading(false);
      });
  };

  const onDiscard = () => {
    setConfirmationState(confirmStateInitialValue);
  };

  const loadNewThreads = () => {
    setTimeout(() => {
      getThreads();
    }, 500);
  };

  const onPostDelete = () => {
    if (confirmationState.postId && confirmationState.threadId) {
      deletePostHandler?.(
        confirmationState.threadId,
        confirmationState.postId,
        confirmationState.isThread
      );
    }
    onDiscard();
    loadNewThreads();
  };

  const onConfirmation = (data: ConfirmState) => {
    setConfirmationState(data);
  };

  const onShowNewConversation = (value: boolean) => {
    setShowNewConversation(value);
  };

  const postFeed = (value: string) => {
    postFeedHandler?.(value, selectedThread?.id ?? selectedThreadId);
    loadNewThreads();
  };

  const onThreadIdSelect = (id: string) => {
    setSelectedThreadId(id);
  };

  const onThreadSelect = (id: string) => {
    const thread = threads.find((f) => f.id === id);
    if (thread) {
      setSelectedThread(thread);
    }
  };

  const onBack = () => {
    setSelectedThread(undefined);
  };

  const onPostThread = async (value: string) => {
    const data = {
      message: value,
      from: currentUser?.name ?? '',
      about: threadLink,
    };
    await createThread(data);
    loadNewThreads();
  };

  const onUpdateThread = (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => {
    updateThreadHandler(threadId, postId, isThread, data);
    loadNewThreads();
  };

  const getLoader = () => {
    return isThreadLoading ? <Loader /> : null;
  };

  const fetchMoreThread = (
    isElementInView: boolean,
    pagingObj: Paging,
    isLoading: boolean
  ) => {
    if (isElementInView && pagingObj?.after && !isLoading) {
      getThreads(pagingObj.after);
    }
  };

  const onSwitchChange = (checked: boolean) => {
    if (checked) {
      setTaskStatus(ThreadTaskStatus.Closed);
    } else {
      setTaskStatus(ThreadTaskStatus.Open);
    }
  };

  useEffect(() => {
    const escapeKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel?.();
      }
    };
    document.addEventListener('keydown', escapeKeyHandler);

    return () => {
      document.removeEventListener('keydown', escapeKeyHandler);
    };
  }, []);

  useEffect(() => {
    onThreadSelect(selectedThread?.id as string);
  }, [threads]);

  useEffect(() => {
    getThreads();
  }, [threadLink, threadType, taskStatus]);

  useEffect(() => {
    fetchMoreThread(isInView, paging, isThreadLoading);
  }, [paging, isThreadLoading, isInView]);

  return (
    <Fragment>
      <div id="thread-panel-body">
        {showHeader && isConversationType && (
          <FeedPanelHeader
            entityLink={selectedThread?.about ?? threadLink}
            noun={
              isConversationType
                ? t('label.conversation-plural')
                : t('label.task-plural')
            }
            onCancel={() => onCancel?.()}
            onShowNewConversation={
              threads.length > 0 && isUndefined(selectedThread)
                ? onShowNewConversation
                : undefined
            }
          />
        )}
        {isTaskType && (
          <Space
            align="center"
            className="w-full justify-end p-r-xs m-t-xs"
            size={4}>
            <Switch size="small" onChange={onSwitchChange} />
            <span>{t('label.closed-task-plural')}</span>
          </Space>
        )}

        {/* When user selects a thread will show that particular thread from here */}
        {!isUndefined(selectedThread) ? (
          <Fragment>
            <Button
              className="m-b-sm p-0"
              size="small"
              type="link"
              onClick={onBack}>
              {t('label.back')}
            </Button>
            <ActivityThread
              postFeed={postFeed}
              selectedThread={selectedThread}
              updateThreadHandler={onUpdateThread}
              onConfirmation={onConfirmation}
            />
          </Fragment>
        ) : (
          <Fragment>
            {showNewConversation ||
            (isEqual(threads.length, 0) && !isThreadLoading) ? (
              <>
                {isConversationType && (
                  <Space className="w-full" direction="vertical">
                    <Typography.Paragraph>
                      {t('message.new-conversation')}
                    </Typography.Paragraph>
                    <ActivityFeedEditor
                      placeHolder={t('message.enter-a-field', {
                        field: t('label.message-lowercase'),
                      })}
                      onSave={onPostThread}
                    />
                  </Space>
                )}
                {(isAnnouncementType || isTaskType) && !isThreadLoading && (
                  <ErrorPlaceHolder
                    className="mt-24"
                    type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
                    {isTaskType ? (
                      <Typography.Paragraph>
                        {isTaskClosed
                          ? t('message.no-closed-task')
                          : t('message.no-open-task')}
                      </Typography.Paragraph>
                    ) : (
                      <Typography.Paragraph data-testid="announcement-error">
                        {t('message.no-announcement-message')}
                      </Typography.Paragraph>
                    )}
                  </ErrorPlaceHolder>
                )}
              </>
            ) : null}
            {isAnnouncementType ? (
              <AnnouncementThreads
                className={classNames(className)}
                editAnnouncementPermission={editAnnouncementPermission}
                postFeed={postFeed}
                selectedThreadId={selectedThreadId}
                threads={threads}
                updateThreadHandler={onUpdateThread}
                onConfirmation={onConfirmation}
                onThreadIdSelect={onThreadIdSelect}
                onThreadSelect={onThreadSelect}
              />
            ) : (
              <ActivityThreadList
                className={classNames(className)}
                postFeed={postFeed}
                selectedThreadId={selectedThreadId}
                threads={threads}
                updateThreadHandler={onUpdateThread}
                onConfirmation={onConfirmation}
                onThreadIdSelect={onThreadIdSelect}
                onThreadSelect={onThreadSelect}
              />
            )}
            <div
              data-testid="observer-element"
              id="observer-element"
              ref={elementRef as RefObject<HTMLDivElement>}>
              {getLoader()}
            </div>
          </Fragment>
        )}
      </div>
      <ConfirmationModal
        bodyText={t('message.confirm-delete-message')}
        cancelText={t('label.cancel')}
        confirmText={t('label.delete')}
        header={t('message.delete-message-question-mark')}
        visible={confirmationState.state}
        onCancel={onDiscard}
        onConfirm={onPostDelete}
      />
    </Fragment>
  );
};

export default ActivityThreadPanelBody;
