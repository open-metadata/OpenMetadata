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
import { AnnouncementType } from '../../generated/entity/feed/announcement';
import { AnnouncementEntity, listAnnouncements } from '../announcementsAPI';

/**
 * The prefix every Home announcement query shares — the critical banner, the
 * rail and its "View all" dialog — so a change made in Settings can refresh
 * all of them at once.
 */
export const HOME_ANNOUNCEMENTS_QUERY_KEY = [
  'landingPage',
  'announcements',
] as const;

export const CRITICAL_ANNOUNCEMENTS_QUERY_KEY = [
  ...HOME_ANNOUNCEMENTS_QUERY_KEY,
  'critical',
] as const;

export const CRITICAL_ANNOUNCEMENTS_TTL_MS = 60_000;

export const CRITICAL_ANNOUNCEMENTS_GC_TIME_MS =
  CRITICAL_ANNOUNCEMENTS_TTL_MS + 5 * 60 * 1000;

// A page size, not a cap: the banner pages until the cursor runs out, so no
// live critical is ever left behind. Live criticals are a handful, so this is
// one request in practice.
export const CRITICAL_ANNOUNCEMENTS_PAGE_SIZE = 25;

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

/**
 * The live critical system announcements the Home banner shows. Shared with
 * the "View all" dialog, which leaves these out and needs their count to keep
 * its badge exact, so both read one cached request.
 */
export const getCriticalAnnouncementsQueryOptions = () => ({
  gcTime: CRITICAL_ANNOUNCEMENTS_GC_TIME_MS,
  queryFn: fetchCriticalAnnouncements,
  queryKey: CRITICAL_ANNOUNCEMENTS_QUERY_KEY,
  staleTime: CRITICAL_ANNOUNCEMENTS_TTL_MS,
});
