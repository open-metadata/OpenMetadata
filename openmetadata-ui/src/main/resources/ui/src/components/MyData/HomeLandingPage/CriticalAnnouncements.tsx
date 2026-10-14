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
import { ButtonUtility } from '@openmetadata/ui-core-components';
import {
  ChevronLeft,
  ChevronRight,
} from '@openmetadata/ui-core-components/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnnouncementType } from '../../../generated/entity/feed/announcement';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  AnnouncementEntity,
  listAnnouncements,
} from '../../../rest/announcementsAPI';
import { invalidateQueriesWithoutInitialRace } from '../../../utils/queryCacheUtils';
import { useRouteActivation } from '../../platform/ai-shell/context/useRouteActivation';
import CriticalAnnouncementBanner from './CriticalAnnouncementBanner';
import {
  CRITICAL_ANNOUNCEMENTS_GC_TIME_MS,
  CRITICAL_ANNOUNCEMENTS_PAGE_SIZE,
  CRITICAL_ANNOUNCEMENTS_QUERY_KEY,
  CRITICAL_ANNOUNCEMENTS_TTL_MS,
  CRITICAL_PAGER_BUTTON_CLASSES,
} from './CriticalAnnouncements.constants';
import {
  DismissedAnnouncementsScope,
  useDismissedAnnouncements,
} from './useDismissedAnnouncements';

// Every live critical, newest first. The server pages in its own order, not by
// start time, so the newest may sit on any page: sorting one page alone could
// leave it out of the banner without a trace.
const fetchCriticalAnnouncements = async (): Promise<AnnouncementEntity[]> => {
  const announcements: AnnouncementEntity[] = [];
  let after: string | undefined;

  do {
    // eslint-disable-next-line openmetadata-imports/no-api-calls-in-iteration -- sequential page walk
    const response = await listAnnouncements({
      active: true,
      after,
      limit: CRITICAL_ANNOUNCEMENTS_PAGE_SIZE,
      system: true,
      type: AnnouncementType.Critical,
    });
    announcements.push(...(response.data ?? []));
    after = response.paging?.after;
  } while (after);

  return announcements.sort((a, b) => b.startTime - a.startTime);
};

const getCriticalAnnouncementsQueryOptions = () => ({
  gcTime: CRITICAL_ANNOUNCEMENTS_GC_TIME_MS,
  queryFn: fetchCriticalAnnouncements,
  queryKey: CRITICAL_ANNOUNCEMENTS_QUERY_KEY,
  staleTime: CRITICAL_ANNOUNCEMENTS_TTL_MS,
});

/**
 * The Home page's top banner: the live critical system announcements, one at
 * a time. Several make a carousel in the same slot rather than a stack, moved
 * only by the user — an outage notice should not slide away mid-read. It wraps
 * at either end rather than disabling a pager button, which would drop the
 * keyboard focus resting on it.
 *
 * This is the only place users see system announcements; the rail below lists
 * asset announcements alone.
 */
const CriticalAnnouncements = () => {
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
  const [index, setIndex] = useState(0);

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

  if (visible.length === 0) {
    return null;
  }

  // Clamped rather than reset: dismissing the current banner shows the next
  // one in its place, and dismissing the last steps back to its neighbour.
  const current = Math.min(index, visible.length - 1);
  const announcement = visible[current];
  const total = visible.length;
  const step = (by: 1 | -1) => setIndex((current + by + total) % total);

  const hasPager = total > 1;

  // The arrows flank the banner, outside its dark surface, so they stay in the
  // page's own theme beside the rail's matching pager below.
  return (
    <section
      aria-label={t('label.critical-announcement-plural')}
      className="tw:flex tw:items-center tw:gap-3"
      data-testid="critical-announcements">
      {/* No tooltip — the arrows explain themselves — so the name the
          tooltip would carry is given as `aria-label` instead. */}
      {hasPager && (
        <ButtonUtility
          aria-label={t('label.previous')}
          className={CRITICAL_PAGER_BUTTON_CLASSES}
          color="secondary"
          data-testid="critical-announcement-previous"
          icon={ChevronLeft}
          size="xs"
          onClick={() => step(-1)}
        />
      )}

      <div className="tw:min-w-0 tw:flex-1">
        <CriticalAnnouncementBanner
          announcement={announcement}
          onDismiss={() => dismiss(announcement.id)}
        />
        {/* Not shown, but announced: with no visible counter, this is how a
            screen reader learns where it is in the carousel. */}
        {hasPager && (
          <span
            aria-live="polite"
            className="tw:sr-only"
            data-testid="critical-announcement-position">
            {t('label.current-of-total', { current: current + 1, total })}
          </span>
        )}
      </div>

      {hasPager && (
        <ButtonUtility
          aria-label={t('label.next')}
          className={CRITICAL_PAGER_BUTTON_CLASSES}
          color="secondary"
          data-testid="critical-announcement-next"
          icon={ChevronRight}
          size="xs"
          onClick={() => step(1)}
        />
      )}
    </section>
  );
};

export default CriticalAnnouncements;
