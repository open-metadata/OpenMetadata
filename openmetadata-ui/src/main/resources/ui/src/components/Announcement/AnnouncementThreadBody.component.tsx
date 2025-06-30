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
import { Typography } from 'antd';
import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { confirmStateInitialValue } from '../../constants/Feeds.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { FeedFilter } from '../../enums/mydata.enum';
import { Thread, ThreadType } from '../../generated/entity/feed/thread';
import { getAllFeeds } from '../../rest/feedsAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { ConfirmState } from '../ActivityFeed/ActivityFeedCard/ActivityFeedCard.interface';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { AnnouncementThreadBodyProp } from './Announcement.interface';
import AnnouncementThreads from './AnnouncementThreads';

const AnnouncementThreadBody = ({
  threadLink,
  refetchThread,
  editPermission,
  postFeedHandler,
  deletePostHandler,
  updateThreadHandler,
}: AnnouncementThreadBodyProp) => {
  const { t } = useTranslation();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [confirmationState, setConfirmationState] = useState<ConfirmState>(
    confirmStateInitialValue
  );
  const [isThreadLoading, setIsThreadLoading] = useState(true);

  const getThreads = async (after?: string) => {
    setIsThreadLoading(true);

    try {
      const res = await getAllFeeds(
        threadLink,
        after,
        ThreadType.Announcement,
        FeedFilter.ALL
      );

      setThreads(res.data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.thread-plural-lowercase'),
        })
      );
    } finally {
      setIsThreadLoading(false);
    }
  };

  const loadNewThreads = () => {
    setTimeout(() => {
      getThreads();
    }, 500);
  };

  const onDiscard = () => {
    setConfirmationState(confirmStateInitialValue);
  };

  const onPostDelete = async (): Promise<void> => {
    if (confirmationState.postId && confirmationState.threadId) {
      await deletePostHandler?.(
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

  const postFeed = async (value: string, id: string): Promise<void> => {
    await postFeedHandler?.(value, id);
    loadNewThreads();
  };

  const onUpdateThread = async (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ): Promise<void> => {
    await updateThreadHandler(threadId, postId, isThread, data);
    loadNewThreads();
  };

  useEffect(() => {
    getThreads();
  }, [threadLink, refetchThread]);

  if (isEmpty(threads) && !isThreadLoading) {
    return (
      <ErrorPlaceHolder
        className="h-auto mt-24"
        type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        <Typography.Paragraph data-testid="announcement-error">
          {t('message.no-announcement-message')}
        </Typography.Paragraph>
      </ErrorPlaceHolder>
    );
  }

  return (
    <div
      className="announcement-thread-body"
      data-testid="announcement-thread-body">
      <AnnouncementThreads
        editPermission={editPermission}
        postFeed={postFeed}
        threads={threads}
        updateThreadHandler={onUpdateThread}
        onConfirmation={onConfirmation}
      />

      <ConfirmationModal
        bodyText={t('message.confirm-delete-message')}
        cancelText={t('label.cancel')}
        confirmText={t('label.delete')}
        header={t('message.delete-message-question-mark')}
        visible={confirmationState.state}
        onCancel={onDiscard}
        onConfirm={onPostDelete}
      />
    </div>
  );
};

export default AnnouncementThreadBody;
