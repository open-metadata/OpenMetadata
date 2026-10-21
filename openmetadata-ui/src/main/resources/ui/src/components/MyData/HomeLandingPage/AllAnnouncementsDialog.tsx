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
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { Announcement02 } from '@openmetadata/ui-core-components/icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../../components/common/Loader/Loader';
import {
  AnnouncementEntity,
  listAnnouncements,
} from '../../../rest/announcementsAPI';
import AnnouncementCard from './AnnouncementCard';
import { compareAnnouncements } from './announcementLifecycle';

const ALL_ANNOUNCEMENTS_QUERY_KEY = [
  'landingPage',
  'announcements',
  'all',
  'active',
] as const;
const ALL_ANNOUNCEMENTS_TTL_MS = 60_000;

// Every live announcement — the full version of the rail, which shows two at a
// time. Expired and scheduled ones stay out: the section itself only appears
// while something is live, so it is no place for them; each asset's
// Announcements drawer lists those. Paged on the API's `after` cursor rather
// than capped at one fetch, so a busy estate never silently loses the rest.
export const ALL_ANNOUNCEMENTS_PAGE_SIZE = 50;

const fetchAnnouncementsPage = ({ pageParam }: { pageParam?: string }) =>
  listAnnouncements({
    active: true,
    limit: ALL_ANNOUNCEMENTS_PAGE_SIZE,
    after: pageParam,
    system: false,
  });

interface AllAnnouncementsDialogProps {
  open: boolean;
  /** The rail owns dismissals (see useDismissedAnnouncements); the dialog honours them. */
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
  // rail's own query already covers the first few.
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      enabled: open,
      getNextPageParam: (lastPage) => lastPage.paging?.after,
      initialPageParam: undefined as string | undefined,
      queryFn: fetchAnnouncementsPage,
      queryKey: ALL_ANNOUNCEMENTS_QUERY_KEY,
      staleTime: ALL_ANNOUNCEMENTS_TTL_MS,
    });

  const loaded = useMemo<AnnouncementEntity[]>(
    () => data?.pages.flatMap((page) => page.data ?? []) ?? [],
    [data]
  );

  // Sorted across every page loaded so far, so a later page can slot items in
  // above ones already shown; the API pages in its own order, not this one.
  const announcements = useMemo(
    () =>
      loaded.filter((a) => !dismissedIds.has(a.id)).sort(compareAnnouncements),
    [loaded, dismissedIds]
  );

  // The badge counts the whole list, not just the pages loaded: the server's
  // total, less what the user dismissed among the ones already here.
  const total = data?.pages[0]?.paging?.total;
  const count =
    total === undefined
      ? announcements.length
      : Math.max(total - (loaded.length - announcements.length), 0);

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="tw:flex tw:items-center tw:justify-center tw:py-8">
          <Loader />
        </div>
      );
    }

    if (announcements.length === 0 && !hasNextPage) {
      return (
        <div className="tw:flex tw:items-center tw:justify-center tw:py-8">
          <Typography className="tw:text-secondary">
            {t('message.no-active-announcements')}
          </Typography>
        </div>
      );
    }

    return (
      <>
        <ul
          className="tw:flex tw:flex-col tw:gap-3"
          data-testid="all-announcements-list">
          {announcements.map((announcement) => (
            <li className="tw:flex" key={announcement.id}>
              <AnnouncementCard
                announcement={announcement}
                className="tw:w-full"
                onDismiss={onDismiss}
                onNavigate={onClose}
              />
            </li>
          ))}
        </ul>
        {hasNextPage && (
          <div className="tw:mt-3 tw:flex tw:justify-center">
            <Button
              color="secondary"
              data-testid="all-announcements-load-more"
              isLoading={isFetchingNextPage}
              size="sm"
              onPress={() => fetchNextPage()}>
              {t('label.load-more')}
            </Button>
          </div>
        )}
      </>
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
        <Dialog showCloseButton dividers="scroll" width={720} onClose={onClose}>
          {/* Bottom padding keeps a gap under the heading while the list
            scrolls beneath it; the content's own bottom padding keeps the
            last card off the dialog's edge, since there is no footer. */}
          <Dialog.Header className="tw:pb-4">
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
                {count}
              </Badge>
            </div>
          </Dialog.Header>

          <Dialog.Content className="tw:max-h-[60vh] tw:overflow-y-auto tw:overscroll-contain tw:pb-6 tw:sm:pb-6">
            {renderBody()}
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default AllAnnouncementsDialog;
