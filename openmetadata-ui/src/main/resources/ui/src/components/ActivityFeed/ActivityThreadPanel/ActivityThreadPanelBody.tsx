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

import { Space, Switch, Typography } from 'antd';
import classNames from 'classnames';
import { isEqual, isUndefined } from 'lodash';
import React, {
  FC,
  Fragment,
  RefObject,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { observerOptions } from '../../../constants/Mydata.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import {
  ThreadTaskStatus,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { useElementInView } from '../../../hooks/useElementInView';
import { getEntityFQN, getEntityType } from '../../../utils/FeedUtils';
import { useAuthContext } from '../../Auth/AuthProviders/AuthProvider';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../Loader/Loader';
import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditor';
import FeedPanelHeader from '../ActivityFeedPanel/FeedPanelHeader';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import ActivityThreadList from './ActivityThreadList';
import { ActivityThreadPanelBodyProp } from './ActivityThreadPanel.interface';
import AnnouncementThreads from './AnnouncementThreads';

const ActivityThreadPanelBody: FC<ActivityThreadPanelBodyProp> = ({
  threadLink,
  onCancel,
  className,
  showHeader = true,
  threadType,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuthContext();
  const {
    getFeedData,
    createThread,
    selectedThread,
    entityThread,
    entityPaging: paging,
    loading: isThreadLoading,
  } = useActivityFeedProvider();
  const [showNewConversation, setShowNewConversation] =
    useState<boolean>(false);

  const [elementRef, isInView] = useElementInView(observerOptions);

  const [taskStatus, setTaskStatus] = useState<ThreadTaskStatus>(
    ThreadTaskStatus.Open
  );

  const { isTaskType, isConversationType, isAnnouncementType } = useMemo(
    () => ({
      isTaskType: isEqual(threadType, ThreadType.Task),
      isConversationType: isEqual(threadType, ThreadType.Conversation),
      isAnnouncementType: isEqual(threadType, ThreadType.Announcement),
    }),
    [threadType]
  );

  const isTaskClosed = isEqual(taskStatus, ThreadTaskStatus.Closed);

  const getThreads = () => {
    const entityType = getEntityType(threadLink) ?? '';
    const entityFQN = getEntityFQN(threadLink) ?? '';

    getFeedData(
      undefined,
      undefined,
      threadType,
      entityType,
      entityFQN,
      isTaskType ? taskStatus : undefined
    );
  };

  useEffect(getThreads, [threadLink, threadType, taskStatus]);

  const loadNewThreads = () => {
    setTimeout(() => {
      getThreads();
    }, 500);
  };

  const onShowNewConversation = (value: boolean) => {
    setShowNewConversation(value);
  };

  const onPostThread = (value: string) => {
    const data = {
      message: value,
      from: currentUser?.name ?? '',
      about: threadLink,
    };
    createThread(data);
    loadNewThreads();
  };

  const getLoader = () => {
    return isThreadLoading ? <Loader /> : null;
  };

  //   const fetchMoreThread = (
  //     isElementInView: boolean,
  //     pagingObj: Paging,
  //     isLoading: boolean
  //   ) => {
  //     if (isElementInView && pagingObj?.after && !isLoading) {
  //       getThreads(pagingObj.after);
  //     }
  //   };

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

  //   useEffect(() => {
  //     fetchMoreThread(isInView, paging, isThreadLoading);
  //   }, [paging, isThreadLoading, isInView]);

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
              entityThread.length > 0 && isUndefined(selectedThread)
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

        <Fragment>
          {showNewConversation || isEqual(entityThread.length, 0) ? (
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
              threads={entityThread}
            />
          ) : (
            <ActivityThreadList
              className={classNames(className)}
              threads={entityThread}
            />
          )}
          <div
            data-testid="observer-element"
            id="observer-element"
            ref={elementRef as RefObject<HTMLDivElement>}>
            {getLoader()}
          </div>
        </Fragment>
      </div>
    </Fragment>
  );
};

export default ActivityThreadPanelBody;
