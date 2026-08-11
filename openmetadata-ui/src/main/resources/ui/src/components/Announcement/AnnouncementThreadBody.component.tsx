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
import {
  AnnouncementEntity,
  listAnnouncements,
} from '../../rest/announcementsAPI';
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
  deleteAnnouncementHandler,
  updateAnnouncementHandler,
}: AnnouncementThreadBodyProp) => {
  const { t } = useTranslation();
  const [announcements, setAnnouncements] = useState<AnnouncementEntity[]>([]);
  const [confirmationState, setConfirmationState] = useState<ConfirmState>(
    confirmStateInitialValue
  );
  const [isThreadLoading, setIsThreadLoading] = useState(true);

  const getThreads = async (after?: string) => {
    setIsThreadLoading(true);

    try {
      const res = await listAnnouncements({
        entityLink: threadLink,
        limit: 100,
        after,
      });

      setAnnouncements(res.data ?? []);
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
    if (confirmationState.threadId) {
      await deleteAnnouncementHandler?.(confirmationState.threadId);
    }
    onDiscard();
    loadNewThreads();
  };

  const onConfirmation = (data: ConfirmState) => {
    setConfirmationState(data);
  };

  const onUpdateAnnouncement = async (
    announcementId: string,
    data: Operation[]
  ): Promise<void> => {
    await updateAnnouncementHandler(announcementId, data);
    loadNewThreads();
  };

  useEffect(() => {
    getThreads();
  }, [threadLink, refetchThread]);

  if (isEmpty(announcements) && !isThreadLoading) {
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
        announcements={announcements}
        editPermission={editPermission}
        updateAnnouncementHandler={onUpdateAnnouncement}
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
