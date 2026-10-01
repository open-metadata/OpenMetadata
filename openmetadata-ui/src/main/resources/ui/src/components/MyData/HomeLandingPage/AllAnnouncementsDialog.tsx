/*
 *  Copyright 2025 Collate.
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

import {
  Badge,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { Announcement02 } from '@openmetadata/ui-core-components/icons';
import Loader from '../../../components/common/Loader/Loader';
import {
  AnnouncementEntity,
  listAnnouncements,
} from '../../../rest/announcementsAPI';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AnnouncementCard from './AnnouncementCard';
import { compareAnnouncements } from './announcementLifecycle';

export const ALL_ANNOUNCEMENTS_QUERY_KEY = [
  'landingPage',
  'announcements',
  'all',
] as const;
const ALL_ANNOUNCEMENTS_TTL_MS = 60_000;
// The rail shows only live announcements, so this list is the one place expired
// and scheduled ones surface — fetch the whole window, not just the active slice.
const ALL_ANNOUNCEMENTS_LIMIT = 100;

const fetchAllAnnouncements = async (): Promise<AnnouncementEntity[]> => {
  const response = await listAnnouncements({ limit: ALL_ANNOUNCEMENTS_LIMIT });

  return response.data ?? [];
};

interface AllAnnouncementsDialogProps {
  open: boolean;
  /** Dismissals are session-local, so the dialog honours the rail's. */
  dismissedIds: Set<string>;
  onClose: () => void;
  onDismiss: (id: string) => void;
}

const AllAnnouncementsDialog: React.FC<AllAnnouncementsDialogProps> = ({
  open,
  dismissedIds,
  onClose,
  onDismiss,
}) => {
  const { t } = useTranslation();

  // Deferred until the dialog is opened — most sessions never open it, and the
  // rail's active-only query already covers the default view.
  const { data, isLoading } = useQuery<AnnouncementEntity[]>({
    enabled: open,
    queryFn: fetchAllAnnouncements,
    queryKey: ALL_ANNOUNCEMENTS_QUERY_KEY,
    staleTime: ALL_ANNOUNCEMENTS_TTL_MS,
  });

  const announcements = useMemo(
    () =>
      (data ?? [])
        .filter((a) => !dismissedIds.has(a.id))
        .sort(compareAnnouncements),
    [data, dismissedIds]
  );

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="tw:flex tw:items-center tw:justify-center tw:py-8">
          <Loader />
        </div>
      );
    }

    if (announcements.length === 0) {
      return (
        <div className="tw:flex tw:items-center tw:justify-center tw:py-8">
          <Typography className="tw:text-secondary">
            {t('message.no-active-announcements')}
          </Typography>
        </div>
      );
    }

    return (
      <ul
        className="tw:flex tw:flex-col tw:gap-3"
        data-testid="all-announcements-list">
        {announcements.map((announcement) => (
          <li className="tw:flex" key={announcement.id}>
            <AnnouncementCard
              announcement={announcement}
              className="tw:w-full"
              onDismiss={onDismiss}
            />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}>
      <Modal>
        <Dialog showCloseButton width={720} onClose={onClose}>
          <Dialog.Header>
            <div className="tw:flex tw:items-center tw:gap-3">
              <div className="tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-utility-blue-50 tw:text-utility-blue-700">
                <Announcement02 height={16} width={16} />
              </div>
              <Typography size="text-sm" weight="semibold">
                {t('label.all-entity', {
                  entity: t('label.announcement-plural'),
                })}
              </Typography>
              <Badge
                className="tw:rounded-md"
                color="gray-blue"
                data-testid="all-announcements-count"
                size="sm"
                type="color">
                {announcements.length}
              </Badge>
            </div>
          </Dialog.Header>

          <Dialog.Content className="tw:max-h-[60vh] tw:overflow-y-auto tw:overscroll-contain">
            {renderBody()}
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default AllAnnouncementsDialog;
