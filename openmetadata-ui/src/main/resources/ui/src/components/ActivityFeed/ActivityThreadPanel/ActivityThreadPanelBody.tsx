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
import ConfirmationModal from 'components/Modals/ConfirmationModal/ConfirmationModal';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { Operation } from 'fast-json-patch';
import { isEqual, isUndefined } from 'lodash';
import React, { FC, Fragment, RefObject, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAllFeeds } from 'rest/feedsAPI';
import AppState from '../../../AppState';
import { confirmStateInitialValue } from '../../../constants/Feeds.constants';
import { observerOptions } from '../../../constants/Mydata.constants';
import { FeedFilter } from '../../../enums/mydata.enum';
import {
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { Paging } from '../../../generated/type/paging';
import { useElementInView } from '../../../hooks/useElementInView';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';
import Loader from '../../Loader/Loader';
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

  const onPostThread = (value: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;
    const data = {
      message: value,
      from: currentUser,
      about: threadLink,
    };
    createThread(data);
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
        onCancel && onCancel();
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
            className="tw-px-4 tw-shadow-sm"
            entityLink={selectedThread?.about ?? threadLink}
            noun={
              isConversationType
                ? t('label.conversation-plural')
                : t('label.task-plural')
            }
            onCancel={() => onCancel && onCancel()}
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
            <span className="tw-ml-1">{t('label.closed-task-plural')}</span>
          </Space>
        )}

        {!isUndefined(selectedThread) ? (
          <Fragment>
            <Button
              className="tw-mb-3 tw-ml-2"
              size="small"
              type="link"
              onClick={onBack}>
              {t('label.back')}
            </Button>
            <ActivityThread
              className="tw-pb-4 tw-pl-5 tw-pr-2"
              postFeed={postFeed}
              selectedThread={selectedThread}
              updateThreadHandler={onUpdateThread}
              onConfirmation={onConfirmation}
            />
          </Fragment>
        ) : (
          <Fragment>
            {showNewConversation || isEqual(threads.length, 0) ? (
              <Fragment>
                {isConversationType && (
                  <Fragment>
                    <p className="tw-ml-9 tw-mr-2 tw-mb-2 tw-mt-1">
                      {t('message.new-conversation')}
                    </p>
                    <ActivityFeedEditor
                      buttonClass="tw-mr-4"
                      className="tw-ml-5 tw-mr-2"
                      placeHolder={t('message.enter-a-field', {
                        field: t('label.message-lowercase'),
                      })}
                      onSave={onPostThread}
                    />
                  </Fragment>
                )}
                {isTaskType && (
                  <ErrorPlaceHolder
                    className="mt-24"
                    type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
                    <Typography.Paragraph>
                      {isTaskClosed
                        ? t('message.no-closed-task')
                        : t('message.no-open-task')}
                    </Typography.Paragraph>
                  </ErrorPlaceHolder>
                )}
                {isAnnouncementType && (
                  <ErrorPlaceHolder
                    className="mt-24"
                    type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
                    <Typography.Paragraph data-testid="announcement-error">
                      {t('message.no-announcement-message')}
                    </Typography.Paragraph>
                  </ErrorPlaceHolder>
                )}
              </Fragment>
            ) : null}
            {isAnnouncementType ? (
              <AnnouncementThreads
                className={classNames({ 'tw-p-4': !className }, className)}
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
                className={classNames({ 'tw-p-4': !className }, className)}
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
