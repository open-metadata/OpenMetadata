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
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SYSTEM_ANNOUNCEMENTS_QUERY_KEY,
  SYSTEM_ANNOUNCEMENT_FETCH_LIMIT,
  SYSTEM_ANNOUNCEMENT_PAGE_SIZES,
} from '../../constants/platform/systemAnnouncements.constants';
import {
  AnnouncementStatus,
  AnnouncementType,
} from '../../generated/entity/feed/announcement';
import {
  AnnouncementEntity,
  createAnnouncement,
  CreateAnnouncementRequest,
  deleteAnnouncement,
  getAnnouncementById,
  listAnnouncements,
  patchAnnouncement,
} from '../../rest/announcementsAPI';
import { searchSystemAnnouncements } from '../../utils/platform/systemAnnouncements.utils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

export interface SystemAnnouncementFilters {
  search: string;
  status?: AnnouncementStatus;
  type?: AnnouncementType;
}

const EMPTY_FILTERS: SystemAnnouncementFilters = { search: '' };

/**
 * State and data for the system-announcement list. Owned by whichever surface
 * shows the list — a route page, or the settings modal's section, which stays
 * mounted across its own sub-pages and so keeps the filters and page while the
 * admin edits a row and comes back.
 *
 * Status and type filter on the server. The title search, the newest-first
 * order and the paging run here, over every matching announcement fetched in
 * one request: they are written by admins alone, so the set stays small, and
 * searching one server page would miss matches on the others.
 */
export const useSystemAnnouncementsList = () => {
  const [filters, setFilters] =
    useState<SystemAnnouncementFilters>(EMPTY_FILTERS);
  const [pageSize, setPageSizeState] = useState(
    SYSTEM_ANNOUNCEMENT_PAGE_SIZES[0]
  );
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: [
      ...SYSTEM_ANNOUNCEMENTS_QUERY_KEY,
      'list',
      { status: filters.status, type: filters.type },
    ],
    queryFn: () =>
      listAnnouncements({
        system: true,
        status: filters.status,
        type: filters.type,
        limit: SYSTEM_ANNOUNCEMENT_FETCH_LIMIT,
      }),
    // Keeps the current rows on screen while a filter change loads, instead
    // of flashing the empty state between them.
    placeholderData: keepPreviousData,
    // The table offers its own Retry; silent background retries on a 5xx kept
    // the skeleton up for several seconds before the error state appeared.
    retry: false,
  });

  const matching = useMemo(
    () => searchSystemAnnouncements(query.data?.data ?? [], filters.search),
    [query.data, filters.search]
  );

  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  // A delete or a narrower search can leave the page past the end.
  const currentPage = Math.min(page, pageCount);

  // Any change to what is listed starts again from the first page.
  const updateFilters = useCallback(
    (patch: Partial<SystemAnnouncementFilters>) => {
      setFilters((prev) => ({ ...prev, ...patch }));
      setPage(1);
    },
    []
  );

  // Replaces the filters rather than merging: EMPTY_FILTERS carries no
  // `status` or `type` key, so a merge would keep the ones already picked.
  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }, []);

  const goToPage = useCallback(
    (next: number) => setPage(Math.min(Math.max(next, 1), pageCount)),
    [pageCount]
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  return {
    announcements: matching.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    ),
    filters,
    hasFilters: Boolean(
      filters.search.trim() || filters.status || filters.type
    ),
    isError: query.isError,
    isLoading: query.isLoading,
    page: currentPage,
    pageCount,
    pageSize,
    total: matching.length,
    clearFilters,
    goToPage,
    refetch: query.refetch,
    setPageSize,
    updateFilters,
  };
};

export type SystemAnnouncementsListState = ReturnType<
  typeof useSystemAnnouncementsList
>;

/** One announcement, for the edit and duplicate forms. */
export const useSystemAnnouncement = (id?: string) =>
  useQuery({
    queryKey: [...SYSTEM_ANNOUNCEMENTS_QUERY_KEY, 'detail', id],
    queryFn: () => getAnnouncementById(id ?? ''),
    enabled: Boolean(id),
  });

/** The fields the settings form edits; a patch diffs exactly these. */
const PATCHED_KEYS = [
  'displayName',
  'description',
  'startTime',
  'endTime',
  'type',
  'color',
  'customTypeName',
] as const;

type PatchedKey = (typeof PATCHED_KEYS)[number];

/**
 * The patched fields of the stored entity or of the create request — the two
 * generated types spell the same enums separately, so they meet as plain values.
 */
const pickPatched = (
  source: Partial<Record<PatchedKey, unknown>>
): Partial<Record<PatchedKey, unknown>> =>
  PATCHED_KEYS.reduce<Partial<Record<PatchedKey, unknown>>>(
    (acc, key) =>
      source[key] === undefined ? acc : { ...acc, [key]: source[key] },
    {}
  );

interface SaveVariables {
  /** The stored announcement when editing; absent for a create or duplicate. */
  original?: AnnouncementEntity;
  /** No `entityLink`: that is what makes the announcement system-wide. */
  request: Omit<CreateAnnouncementRequest, 'entityLink'>;
}

/** Create, or patch an existing announcement, then refresh every list. */
export const useSaveSystemAnnouncement = (
  onSaved: (announcement: AnnouncementEntity) => void
) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ original, request }: SaveVariables) =>
      original
        ? patchAnnouncement(
            original.id,
            compare(pickPatched(original), pickPatched(request))
          )
        : createAnnouncement(request),
    onSuccess: (announcement, { original }) => {
      queryClient.invalidateQueries({
        queryKey: SYSTEM_ANNOUNCEMENTS_QUERY_KEY,
      });
      showSuccessToast(
        t(
          original
            ? 'server.update-entity-success'
            : 'server.create-entity-success',
          { entity: t('label.announcement') }
        )
      );
      onSaved(announcement);
    },
    onError: (error) => showErrorToast(error as AxiosError),
  });
};

/** Hard delete: a system announcement has no entity page to restore it from. */
export const useDeleteSystemAnnouncement = (onDeleted: () => void) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id, true),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: SYSTEM_ANNOUNCEMENTS_QUERY_KEY,
      });
      showSuccessToast(
        t('server.entity-deleted-success', {
          entity: t('label.announcement'),
        })
      );
      onDeleted();
    },
    onError: (error) => showErrorToast(error as AxiosError),
  });
};
