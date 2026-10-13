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
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { TaskType } from '../../../generated/api/tasks/createTask';
import { Task, TaskStatus } from '../../../generated/entity/tasks/task';
import { listMyAssignedTasks, listTasks } from '../../../rest/tasksAPI';
import { CONTEXT_CENTER_MEMORY_REVIEWS_QUERY_KEY } from '../../../utils/ContextCenterQueryKeys';

const REVIEW_PAGE_SIZE = 50;

const REVIEW_QUERY = {
  type: TaskType.MemoryConflictReview,
  status: TaskStatus.Open,
  fields: 'about,assignees,payload',
  limit: REVIEW_PAGE_SIZE,
};

export interface MemoryConflictReviews {
  reviews: Task[];
  total: number;
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
}

/**
 * Open memory conflict reviews: every one for an admin, otherwise the ones
 * assigned to the user or their teams. Paged by cursor, a page at a time.
 */
export const useMemoryConflictReviews = (
  isAdmin: boolean
): MemoryConflictReviews => {
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: [...CONTEXT_CENTER_MEMORY_REVIEWS_QUERY_KEY, isAdmin],
      queryFn: ({ pageParam }) => {
        const page = { ...REVIEW_QUERY, after: pageParam };

        return isAdmin ? listTasks(page) : listMyAssignedTasks(page);
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.paging?.after,
    });

  const reviews = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data]
  );

  return {
    reviews,
    total: data?.pages[0]?.paging?.total ?? 0,
    isLoading,
    hasMore: Boolean(hasNextPage),
    isLoadingMore: isFetchingNextPage,
    loadMore: () => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
  };
};
