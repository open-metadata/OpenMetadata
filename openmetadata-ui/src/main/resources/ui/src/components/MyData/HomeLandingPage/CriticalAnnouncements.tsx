/*
 *  Copyright 2026 Collate.
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
import { Box, PaginationDot } from '@openmetadata/ui-core-components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useRailPager } from '../../../hooks/useRailPager';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';
import {
  CRITICAL_ANNOUNCEMENTS_QUERY_KEY,
  getCriticalAnnouncementsQueryOptions,
} from '../../../rest/queries/criticalAnnouncementsQuery';
import { invalidateQueriesWithoutInitialRace } from '../../../utils/queryCacheUtils';
import { useRouteActivation } from '../../platform/ai-shell/context/useRouteActivation';
import CriticalAnnouncementBanner from './CriticalAnnouncementBanner';
import RailPager from './RailPager';
import {
  DismissedAnnouncementsScope,
  useDismissedAnnouncements,
} from './useDismissedAnnouncements';

export interface CriticalAnnouncementsProps {
  /** What holds the top slot while no critical announcement is live. */
  fallback?: ReactNode;
}

/**
 * The Home page's top banner: the live critical system announcements, one
 * full-width banner at a time. Several make a rail that pages exactly like the
 * announcements rail below it — the same pager, the same slide — moved only by
 * the user, so an outage notice never slides away mid-read.
 *
 * The rail below lists every other live announcement, system ones included,
 * and leaves these out so none appears twice.
 *
 * The banner takes the page's top slot, so whatever normally sits there is
 * passed as `fallback` and shown whenever no critical announcement is live.
 */
const CriticalAnnouncements = ({
  fallback = null,
}: CriticalAnnouncementsProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { currentUser } = useApplicationStore();
  const { data: announcements } = useQuery<AnnouncementEntity[]>(
    getCriticalAnnouncementsQueryOptions()
  );
  const { dismissedIds, dismiss, prune } = useDismissedAnnouncements(
    currentUser?.id,
    DismissedAnnouncementsScope.CriticalBanner
  );

  // An id no longer returned has expired or been deleted, and cannot return.
  useEffect(() => {
    if (announcements) {
      prune(announcements.map(({ id }) => id));
    }
  }, [announcements, prune]);

  // Same freshness contract as the rail: revisits and refocus revalidate
  // within the TTL; a websocket-dirtied or aged-out cache refetches.
  useRouteActivation((reason) => {
    if (reason === 'dirty' || reason === 'maxAge') {
      void invalidateQueriesWithoutInitialRace(queryClient, {
        queryKey: CRITICAL_ANNOUNCEMENTS_QUERY_KEY,
      });

      return;
    }

    void queryClient.prefetchQuery(getCriticalAnnouncementsQueryOptions());
  });

  const visible = useMemo(
    () => (announcements ?? []).filter(({ id }) => !dismissedIds.has(id)),
    [announcements, dismissedIds]
  );
  const count = visible.length;
  const {
    railRef,
    canScroll,
    pageIndex,
    syncScrollState,
    goToPrevious,
    goToNext,
    goToPage,
  } = useRailPager(count);
  // One banner fills the rail, so its page is the banner's position. Clamped:
  // a dismissal can shorten the rail before it re-measures.
  const position = Math.min(pageIndex, count - 1);

  if (count === 0) {
    return <>{fallback}</>;
  }

  return (
    <section
      aria-label={t('label.critical-announcement-plural')}
      className="tw:relative"
      data-testid="critical-announcements">
      {/* No heading: the banner names itself Critical. The pager keeps the
      rail's place, right-aligned above it, so the two carousels page alike. */}
      {count > 1 && (
        <>
          <div className="tw:mr-2 tw:mb-3 tw:flex tw:justify-end">
            <RailPager
              canScroll={canScroll}
              testIdPrefix="critical-announcement"
              onNext={goToNext}
              onPrevious={goToPrevious}
            />
          </div>
          <span
            aria-live="polite"
            className="tw:sr-only"
            data-testid="critical-announcement-position">
            {t('label.current-of-total', {
              current: position + 1,
              total: count,
            })}
          </span>
        </>
      )}

      <ul
        aria-label={t('label.critical-announcement-plural')}
        className="tw:flex tw:snap-x tw:snap-mandatory tw:gap-3.5 tw:overflow-x-auto tw:overscroll-x-contain tw:scrollbar-hide"
        data-testid="critical-announcement-rail"
        ref={railRef}
        onScroll={syncScrollState}>
        {visible.map((announcement) => (
          <li
            className="tw:flex tw:shrink-0 tw:basis-full tw:snap-start"
            key={announcement.id}>
            <CriticalAnnouncementBanner
              announcement={announcement}
              className="tw:w-full"
              onDismiss={() => dismiss(announcement.id)}
            />
          </li>
        ))}
      </ul>

      {count > 1 && (
        <Box
          className="tw:mt-3"
          data-testid="critical-announcement-dots"
          justify="center">
          <PaginationDot
            page={position + 1}
            size="sm"
            total={count}
            onPageChange={(page) => goToPage(page - 1)}
          />
        </Box>
      )}
    </section>
  );
};

export default CriticalAnnouncements;
