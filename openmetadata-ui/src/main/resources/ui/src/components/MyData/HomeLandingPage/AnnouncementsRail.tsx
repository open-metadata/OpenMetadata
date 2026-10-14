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
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronLeft,
  ChevronRight,
} from '@openmetadata/ui-core-components/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  AnnouncementEntity,
  listAnnouncements,
} from '../../../rest/announcementsAPI';
import { invalidateQueriesWithoutInitialRace } from '../../../utils/queryCacheUtils';
import { useRouteActivation } from '../../platform/ai-shell/context/useRouteActivation';
import AllAnnouncementsDialog from './AllAnnouncementsDialog';
import AnnouncementCard from './AnnouncementCard';
import { useDismissedAnnouncements } from './useDismissedAnnouncements';

export const ACTIVE_ANNOUNCEMENTS_QUERY_KEY = [
  'landingPage',
  'announcements',
  'active',
] as const;
const ACTIVE_ANNOUNCEMENTS_TTL_MS = 60_000;
const ACTIVE_ANNOUNCEMENTS_GC_TIME_MS =
  ACTIVE_ANNOUNCEMENTS_TTL_MS + 5 * 60 * 1000;

// Fraction of the rail's visible width a pager click travels. Under 1 so the
// card at the edge stays partly visible and the scroll reads as continuous.
const RAIL_PAGE_FRACTION = 0.9;
// Pager circle, matching the mock: a 28px button with a 10px glyph.
const PAGER_BUTTON_CLASSES = 'tw:rounded-full';
// Sub-pixel slack: fractional card widths leave a fraction of a pixel of scroll
// left at either end, which would otherwise keep a pager button enabled forever.
const RAIL_SCROLL_EPSILON = 1;

// Asset announcements only: system ones reach users through the critical
// banner above the rail, never here.
const fetchActiveAnnouncements = async (): Promise<AnnouncementEntity[]> => {
  const response = await listAnnouncements({
    active: true,
    limit: 100,
    system: false,
  });

  return response.data ?? [];
};

const getActiveAnnouncementsQueryOptions = () => ({
  gcTime: ACTIVE_ANNOUNCEMENTS_GC_TIME_MS,
  queryFn: fetchActiveAnnouncements,
  queryKey: ACTIVE_ANNOUNCEMENTS_QUERY_KEY,
  staleTime: ACTIVE_ANNOUNCEMENTS_TTL_MS,
});

interface AnnouncementsHeaderProps {
  count: number;
  pager?: React.ReactNode;
  onViewAll: () => void;
}

const AnnouncementsHeader = ({
  count,
  pager,
  onViewAll,
}: AnnouncementsHeaderProps) => {
  const { t } = useTranslation();

  return (
    <div className="tw:flex tw:items-center tw:gap-2">
      <Typography size="text-sm" weight="semibold">
        {t('label.announcement-plural')}
      </Typography>
      <Badge className="tw:rounded-md" color="gray-blue" size="sm" type="color">
        {count}
      </Badge>

      <div className="tw:ml-auto tw:flex tw:items-center tw:gap-4">
        {pager}
        <Button
          color="link-color"
          data-testid="announcement-view-all"
          size="xs"
          onPress={onViewAll}>
          {t('label.view-all')}
        </Button>
      </div>
    </div>
  );
};

const AnnouncementsRail: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { currentUser } = useApplicationStore();
  const { data: announcements, isError } = useQuery<AnnouncementEntity[]>(
    getActiveAnnouncementsQueryOptions()
  );
  const {
    dismissedIds,
    dismiss: handleDismiss,
    prune: pruneDismissed,
  } = useDismissedAnnouncements(currentUser?.id);
  const [isAllOpen, setIsAllOpen] = useState(false);
  const railRef = useRef<HTMLUListElement>(null);
  const [canScroll, setCanScroll] = useState({ next: false, previous: false });

  // Only a live announcement can be dismissed, so an id the active list no
  // longer returns has expired or been deleted and will never show again.
  useEffect(() => {
    if (announcements) {
      pruneDismissed(announcements.map(({ id }) => id));
    }
  }, [announcements, pruneDismissed]);

  // Re-run the fetch effect when the Home page becomes visible again, the tab
  // refocuses, or a websocket invalidation marks it dirty. The 60s TTL keeps
  // activation/focus revalidations cheap (no-op while fresh); dirty/max-age force it.
  useRouteActivation((reason) => {
    if (reason === 'dirty' || reason === 'maxAge') {
      void invalidateQueriesWithoutInitialRace(queryClient, {
        queryKey: ACTIVE_ANNOUNCEMENTS_QUERY_KEY,
      });

      return;
    }

    void queryClient.prefetchQuery(getActiveAnnouncementsQueryOptions());
  });

  const activeAnnouncements = useMemo(
    () => (announcements ?? []).filter((a) => !dismissedIds.has(a.id)),
    [announcements, dismissedIds]
  );
  const count = activeAnnouncements.length;

  // Which pager buttons are live is a function of where the rail is scrolled —
  // read it off the element rather than tracking an index, so it stays correct
  // however many cards happen to fit at the current width.
  const syncScrollState = useCallback(() => {
    const rail = railRef.current;
    if (!rail) {
      return;
    }
    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
    const next = rail.scrollLeft < maxScrollLeft - RAIL_SCROLL_EPSILON;
    const previous = rail.scrollLeft > RAIL_SCROLL_EPSILON;
    // Smooth scrolling fires this every frame — hand back the same object when
    // nothing changed so React bails out instead of re-rendering the rail.
    setCanScroll((prev) =>
      prev.next === next && prev.previous === previous
        ? prev
        : { next, previous }
    );
  }, []);

  // Layout effect so the buttons are never painted in a stale enabled state
  // after the card list changes. ResizeObserver covers the grid resizing us.
  useLayoutEffect(() => {
    syncScrollState();
    const rail = railRef.current;
    if (!rail) {
      return;
    }
    const observer = new ResizeObserver(syncScrollState);
    observer.observe(rail);

    return () => observer.disconnect();
  }, [syncScrollState, count]);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const rail = railRef.current;
    rail?.scrollBy?.({
      behavior: 'smooth',
      left: direction * rail.clientWidth * RAIL_PAGE_FRACTION,
    });
  }, []);

  const goToPrevious = useCallback(() => scrollByPage(-1), [scrollByPage]);
  const goToNext = useCallback(() => scrollByPage(1), [scrollByPage]);
  const openAll = useCallback(() => setIsAllOpen(true), []);
  const closeAll = useCallback(() => setIsAllOpen(false), []);

  const hasLive = !isError && count > 0;

  // The dialog is mounted beside the section, not inside it: dismissing the
  // last live card from the open dialog empties the rail, and unmounting the
  // dialog with it would close it on the scheduled and expired ones it lists.
  const dialog = (
    <AllAnnouncementsDialog
      dismissedIds={dismissedIds}
      open={isAllOpen}
      onClose={closeAll}
      onDismiss={handleDismiss}
    />
  );

  // With nothing live the whole section stands down — no heading, no "View
  // all" into a list of only scheduled and expired ones.
  if (!hasLive) {
    return dialog;
  }

  return (
    <>
      <section data-testid="announcements-section">
        <AnnouncementsHeader
          count={count}
          pager={
            count > 1 && (
              // The pager reads as one control, so its buttons stay tight to
              // each other while the parent's gap holds "View all" clear of them.
              <div className="tw:flex tw:items-center tw:gap-2">
                {/* Icons are passed as components, not elements, so ButtonUtility
                tags them `data-icon` and its own xs sizing applies. */}
                <ButtonUtility
                  className={PAGER_BUTTON_CLASSES}
                  color="secondary"
                  data-testid="announcement-previous"
                  icon={ChevronLeft}
                  isDisabled={!canScroll.previous}
                  size="xs"
                  tooltip={t('label.previous')}
                  onClick={goToPrevious}
                />
                <ButtonUtility
                  className={PAGER_BUTTON_CLASSES}
                  color="secondary"
                  data-testid="announcement-next"
                  icon={ChevronRight}
                  isDisabled={!canScroll.next}
                  size="xs"
                  tooltip={t('label.next')}
                  onClick={goToNext}
                />
              </div>
            )
          }
          onViewAll={openAll}
        />

        {/* Container query, not a viewport breakpoint — the rail should size off
        the section's own width, which the sidebar and page padding shape. */}
        <div className="tw:@container tw:mt-3 tw:min-w-0">
          {/* overflow-x-auto clips vertically too, so -my-2/py-2 gives a
          card's hover shadow room without moving the cards. */}
          <ul
            aria-label={t('label.announcement-plural')}
            className="tw:-my-2 tw:flex tw:snap-x tw:snap-mandatory tw:items-stretch tw:gap-3.5 tw:overflow-x-auto tw:overscroll-x-contain tw:py-2 tw:scrollbar-hide"
            data-testid="announcement-rail"
            ref={railRef}
            onScroll={syncScrollState}>
            {activeAnnouncements.map((announcement) => (
              // A lone announcement takes the full width rather than half the
              // rail beside an empty column.
              <li
                className={classNames(
                  'tw:flex tw:shrink-0 tw:snap-start tw:basis-full',
                  count > 1 && 'tw:@2xl:basis-[calc(50%-0.4375rem)]'
                )}
                key={announcement.id}>
                <AnnouncementCard
                  announcement={announcement}
                  className="tw:w-full"
                  onDismiss={handleDismiss}
                />
              </li>
            ))}
          </ul>
        </div>
      </section>
      {dialog}
    </>
  );
};

export default AnnouncementsRail;
