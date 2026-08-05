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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { FeedCounts } from '../../../interface/feed.interface';
import {
  getAllFeeds,
  getEntityActivityByFqn,
  getFeedCount,
  postFeedById,
  postThread,
} from '../../../rest/feedsAPI';
import {
  addTaskComment,
  closeTask,
  createTask,
  CreateTask,
  getTaskCounts,
  listTasks,
  resolveTask,
  TaskStatusGroup,
} from '../../../rest/tasksAPI';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import {
  MetricActivityTabKey,
  MetricTaskStatusFilter,
} from './MetricActivity.types';
import {
  createMetricFeedCounts,
  mergeMetricActivity,
} from './MetricActivity.utils';

export const metricActivityQueryKey = (
  metricFqn: string,
  tab: MetricActivityTabKey
) => ['metric-activity', metricFqn, tab];

export const metricTasksQueryKey = (
  metricFqn: string,
  status: MetricTaskStatusFilter
) => ['metric-activity-tasks', metricFqn, status];

export const metricActivityCountsQueryKey = (metricFqn: string) => [
  'metric-activity-counts',
  metricFqn,
];

export interface UseMetricActivityParams {
  currentUserId?: string;
  currentUserName?: string;
  metricFqn: string;
  status: MetricTaskStatusFilter;
  tab: MetricActivityTabKey;
  onUpdateFeedCount?: (counts: FeedCounts) => void;
}

export const useMetricActivity = ({
  currentUserId,
  currentUserName,
  metricFqn,
  status,
  tab,
  onUpdateFeedCount,
}: UseMetricActivityParams) => {
  const queryClient = useQueryClient();
  const [activityLimit, setActivityLimit] = useState(50);
  const [taskLimit, setTaskLimit] = useState(50);
  const entityLink = getEntityFeedLink(EntityType.METRIC, metricFqn);
  const activityQuery = useQuery({
    queryKey: [...metricActivityQueryKey(metricFqn, tab), activityLimit],
    queryFn: async () => {
      const isMentions = tab === 'mentions';
      const [events, threads] = await Promise.all([
        isMentions
          ? Promise.resolve({ data: [], paging: { total: 0 } })
          : getEntityActivityByFqn(EntityType.METRIC, metricFqn, {
              days: 30,
              limit: activityLimit,
            }),
        getAllFeeds(
          entityLink,
          undefined,
          ThreadType.Conversation,
          isMentions ? FeedFilter.MENTIONS : FeedFilter.ALL,
          undefined,
          isMentions ? currentUserId : undefined,
          activityLimit
        ),
      ]);

      return {
        data: mergeMetricActivity(events.data, threads.data),
        hasMore:
          events.paging.total > events.data.length ||
          threads.paging.total > threads.data.length,
      };
    },
    enabled: Boolean(metricFqn) && tab !== 'tasks',
  });

  const tasksQuery = useQuery({
    queryKey: [...metricTasksQueryKey(metricFqn, status), taskLimit],
    queryFn: () =>
      listTasks({
        aboutEntity: metricFqn,
        fields:
          'about,assignees,availableTransitions,comments,createdBy,resolution,reviewers',
        limit: taskLimit,
        statusGroup:
          status === 'open' ? TaskStatusGroup.Open : TaskStatusGroup.Closed,
      }),
    enabled: Boolean(metricFqn) && tab === 'tasks',
  });

  const countsQuery = useQuery({
    queryKey: metricActivityCountsQueryKey(metricFqn),
    queryFn: async () => {
      const [feedCounts, taskCounts, activity] = await Promise.all([
        getFeedCount(entityLink),
        getTaskCounts({ aboutEntity: metricFqn }),
        getEntityActivityByFqn(EntityType.METRIC, metricFqn, {
          days: 30,
          limit: 100,
        }),
      ]);
      const mentionCount = feedCounts.reduce(
        (total, count) => total + count.mentionCount,
        0
      );
      const conversationThreadCount = feedCounts.reduce(
        (total, count) => total + (count.conversationCount ?? 0),
        0
      );

      return createMetricFeedCounts({
        activityEventCount: activity.paging.total,
        closedTaskCount: taskCounts.completed ?? 0,
        conversationThreadCount,
        mentionCount,
        openTaskCount: taskCounts.open ?? 0,
        totalTaskCount: taskCounts.total ?? 0,
      });
    },
    enabled: Boolean(metricFqn),
  });

  useEffect(() => {
    if (countsQuery.data) {
      onUpdateFeedCount?.(countsQuery.data);
    }
  }, [countsQuery.data, onUpdateFeedCount]);

  useEffect(() => {
    setActivityLimit(50);
  }, [tab]);

  useEffect(() => {
    setTaskLimit(50);
  }, [status]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ['metric-activity', metricFqn],
    });
    queryClient.invalidateQueries({
      queryKey: ['metric-activity-tasks', metricFqn],
    });
    queryClient.invalidateQueries({
      queryKey: metricActivityCountsQueryKey(metricFqn),
    });
  };

  const createThreadMutation = useMutation({
    mutationFn: ({ about, message }: { about?: string; message: string }) =>
      postThread({
        about: about || entityLink,
        message,
        type: ThreadType.Conversation,
      }),
    onSuccess: invalidate,
  });
  const replyMutation = useMutation({
    mutationFn: ({
      message,
      threadId,
    }: {
      message: string;
      threadId: string;
    }) =>
      postFeedById(threadId, {
        from: currentUserName ?? '',
        id: '',
        message,
      } satisfies Parameters<typeof postFeedById>[1]),
    onSuccess: invalidate,
  });
  const taskCommentMutation = useMutation({
    mutationFn: ({ message, taskId }: { message: string; taskId: string }) =>
      addTaskComment(taskId, message),
    onSuccess: invalidate,
  });
  const taskTransitionMutation = useMutation({
    mutationFn: ({
      comment,
      taskId,
      transitionId,
    }: {
      comment?: string;
      taskId: string;
      transitionId?: string;
    }) =>
      transitionId
        ? resolveTask(taskId, { comment, transitionId })
        : closeTask(taskId, comment),
    onSuccess: invalidate,
  });
  const createTaskMutation = useMutation({
    mutationFn: (task: CreateTask) => createTask(task),
    onSuccess: invalidate,
  });

  return {
    activity: activityQuery.data?.data ?? [],
    activityError: activityQuery.error,
    counts: countsQuery.data,
    createTaskError: createTaskMutation.error,
    isActivityLoading: activityQuery.isPending,
    isCommenting:
      createThreadMutation.isPending ||
      replyMutation.isPending ||
      taskCommentMutation.isPending,
    isCreatingTask: createTaskMutation.isPending,
    isLoadingMoreActivity: activityQuery.isFetching && !activityQuery.isPending,
    isLoadingMoreTasks: tasksQuery.isFetching && !tasksQuery.isPending,
    isResolvingTask: taskTransitionMutation.isPending,
    isTasksLoading: tasksQuery.isPending,
    mutationError:
      createThreadMutation.error ??
      replyMutation.error ??
      taskCommentMutation.error ??
      taskTransitionMutation.error ??
      createTaskMutation.error,
    hasMoreActivity: activityQuery.data?.hasMore ?? false,
    hasMoreTasks:
      (tasksQuery.data?.paging.total ?? 0) >
      (tasksQuery.data?.data.length ?? 0),
    tasks: tasksQuery.data?.data ?? [],
    tasksError: tasksQuery.error,
    addTaskComment: (taskId: string, message: string) =>
      taskCommentMutation.mutateAsync({ message, taskId }),
    createComment: (about: string | undefined, message: string) =>
      createThreadMutation.mutateAsync({ about, message }),
    createTask: (task: CreateTask) => createTaskMutation.mutateAsync(task),
    loadMoreActivity: () => setActivityLimit((current) => current + 50),
    loadMoreTasks: () => setTaskLimit((current) => current + 50),
    refetchActivity: activityQuery.refetch,
    refetchTasks: tasksQuery.refetch,
    replyToThread: (threadId: string, message: string) =>
      replyMutation.mutateAsync({ message, threadId }),
    resolveTask: (taskId: string, transitionId?: string, comment?: string) =>
      taskTransitionMutation.mutateAsync({ comment, taskId, transitionId }),
  };
};
