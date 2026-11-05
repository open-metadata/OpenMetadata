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
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { TaskType } from '../../../generated/api/tasks/createTask';
import { Task, TaskStatus } from '../../../generated/entity/tasks/task';
import { listMyAssignedTasks, listTasks } from '../../../rest/tasksAPI';
import { CONTEXT_CENTER_MEMORY_REVIEWS_QUERY_KEY } from '../../../utils/ContextCenterQueryKeys';

const REVIEW_PAGE_SIZE = 20;

const OPEN_REVIEWS = {
  type: TaskType.MemoryConflictReview,
  status: TaskStatus.Open,
};

export interface MemoryConflictReviews {
  reviews: Task[];
  total: number;
  isCountLoading: boolean;
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

const listReviews = (isAdmin: boolean) =>
  isAdmin ? listTasks : listMyAssignedTasks;

/**
 * Open memory conflict reviews: every one for an admin, otherwise the ones
 * assigned to the user or their teams. The count is always read; the reviews
 * themselves only while they are listed, a page at a time.
 */
export const useMemoryConflictReviews = (
  isAdmin: boolean,
  isListing: boolean
): MemoryConflictReviews => {
  const count = useQuery({
    queryKey: [...CONTEXT_CENTER_MEMORY_REVIEWS_QUERY_KEY, 'count', isAdmin],
    queryFn: () =>
      listReviews(isAdmin)({ ...OPEN_REVIEWS, limit: 1 }).then(
        (response) => response.paging?.total ?? 0
      ),
  });
  const list = useInfiniteQuery({
    queryKey: [...CONTEXT_CENTER_MEMORY_REVIEWS_QUERY_KEY, 'list', isAdmin],
    queryFn: ({ pageParam }) =>
      listReviews(isAdmin)({
        ...OPEN_REVIEWS,
        fields: 'about,createdBy,payload',
        limit: REVIEW_PAGE_SIZE,
        after: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.paging?.after,
    enabled: isListing,
  });
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } =
    list;

  const reviews = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data]
  );

  return {
    reviews,
    total: count.data ?? 0,
    isCountLoading: count.isLoading,
    isLoading: list.isLoading,
    isError: list.isError,
    hasMore: Boolean(hasNextPage),
    isLoadingMore: isFetchingNextPage,
    loadMore: () => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    retry: () => {
      refetch();
    },
  };
};
