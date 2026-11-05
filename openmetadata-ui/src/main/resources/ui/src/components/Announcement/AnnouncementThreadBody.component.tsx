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
import { Announcement02 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { confirmStateInitialValue } from '../../constants/Feeds.constants';
import {
  AnnouncementEntity,
  listAnnouncements,
} from '../../rest/announcementsAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import NoDataPlaceholder from '../common/EmptyPlaceholder/NoDataPlaceholder';
import {
  AnnouncementThreadBodyProp,
  ConfirmState,
} from './Announcement.interface';
import AnnouncementDeleteDialog from './AnnouncementDeleteDialog';
import AnnouncementThreads from './AnnouncementThreads';

const PAGE_SIZE = 100;

const AnnouncementThreadBody = ({
  threadLink,
  refetchThread,
  editPermission,
  statusFilter,
  deleteAnnouncementHandler,
  updateAnnouncementHandler,
}: AnnouncementThreadBodyProp) => {
  const { t } = useTranslation();
  const [announcements, setAnnouncements] = useState<AnnouncementEntity[]>([]);
  const [confirmationState, setConfirmationState] = useState<ConfirmState>(
    confirmStateInitialValue
  );
  const [isThreadLoading, setIsThreadLoading] = useState(true);
  // Switching tabs fires overlapping list requests and an earlier one can land
  // after a later one, repainting the drawer with a deselected tab's rows. Only
  // the newest request is allowed to write state.
  const latestRequestId = useRef(0);
  const reloadTimeout = useRef<ReturnType<typeof setTimeout>>();

  const getThreads = async () => {
    const requestId = ++latestRequestId.current;
    setIsThreadLoading(true);

    try {
      // Status is filtered server-side, where it is derived from the
      // announcement's window rather than the stored snapshot. Filtering a
      // fetched page here would drop matches sitting on later pages.
      const res = await listAnnouncements({
        entityLink: threadLink,
        limit: PAGE_SIZE,
        status: statusFilter,
      });

      if (requestId === latestRequestId.current) {
        setAnnouncements(res.data ?? []);
      }
    } catch (error) {
      if (requestId === latestRequestId.current) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.thread-plural-lowercase'),
          })
        );
      }
    } finally {
      if (requestId === latestRequestId.current) {
        setIsThreadLoading(false);
      }
    }
  };

  const loadNewThreads = () => {
    reloadTimeout.current = setTimeout(() => {
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
  }, [threadLink, refetchThread, statusFilter]);

  useEffect(
    () => () => {
      // Retires any in-flight request and the pending post-write reload, so
      // neither can call setState once the drawer has closed.
      latestRequestId.current = -1;
      if (reloadTimeout.current) {
        clearTimeout(reloadTimeout.current);
      }
    },
    []
  );

  if (isEmpty(announcements) && !isThreadLoading) {
    return (
      <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
        <NoDataPlaceholder
          data-testid="no-data-placeholder"
          description={
            <span data-testid="announcement-error">
              {t('message.no-announcement-message')}
            </span>
          }
          icon={<Announcement02 />}
        />
      </div>
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

      <AnnouncementDeleteDialog
        isOpen={confirmationState.state}
        onCancel={onDiscard}
        onConfirm={onPostDelete}
      />
    </div>
  );
};

export default AnnouncementThreadBody;
