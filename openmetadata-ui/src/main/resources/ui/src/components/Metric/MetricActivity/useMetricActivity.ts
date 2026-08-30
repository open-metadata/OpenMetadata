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
import { ConversationFilterType } from '../../../generated/type/conversationFilterType';
import { FeedCounts } from '../../../interface/feed.interface';
import { getEntityActivityByFqn } from '../../../rest/activityAPI';
import {
  createConversation,
  createConversationReply,
  listConversations,
} from '../../../rest/conversationsAPI';
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

export const metricActivityCountsQueryKey = (
  metricFqn: string,
  currentUserId?: string
) => ['metric-activity-counts', metricFqn, currentUserId];

export interface UseMetricActivityParams {
  currentUserId?: string;
  metricFqn: string;
  status: MetricTaskStatusFilter;
  tab: MetricActivityTabKey;
  onUpdateFeedCount?: (counts: FeedCounts) => void;
}

export const useMetricActivity = ({
  currentUserId,
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
    queryKey: [
      ...metricActivityQueryKey(metricFqn, tab),
      currentUserId,
      activityLimit,
    ],
    queryFn: async () => {
      const isMentions = tab === 'mentions';
      if (isMentions && !currentUserId) {
        return { data: [], hasMore: false };
      }

      const [events, conversations] = await Promise.all([
        isMentions
          ? Promise.resolve({ data: [], paging: { total: 0 } })
          : getEntityActivityByFqn(EntityType.METRIC, metricFqn, {
              days: 30,
              limit: activityLimit,
            }),
        listConversations({
          entityLink,
          filterType: isMentions ? ConversationFilterType.Mentions : undefined,
          limit: activityLimit,
          userId: isMentions ? currentUserId : undefined,
        }),
      ]);

      return {
        data: mergeMetricActivity(events.data, conversations.data),
        hasMore:
          events.paging.total > events.data.length ||
          conversations.paging.total > conversations.data.length,
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
    queryKey: metricActivityCountsQueryKey(metricFqn, currentUserId),
    queryFn: async () => {
      const [conversations, mentions, taskCounts, activity] = await Promise.all(
        [
          listConversations({ entityLink, limit: 1 }),
          currentUserId
            ? listConversations({
                entityLink,
                filterType: ConversationFilterType.Mentions,
                limit: 1,
                userId: currentUserId,
              })
            : Promise.resolve({ data: [], paging: { total: 0 } }),
          getTaskCounts({ aboutEntity: metricFqn }),
          getEntityActivityByFqn(EntityType.METRIC, metricFqn, {
            days: 30,
            limit: 100,
          }),
        ]
      );

      return createMetricFeedCounts({
        activityEventCount: activity.paging.total,
        closedTaskCount: taskCounts.completed ?? 0,
        conversationThreadCount: conversations.paging.total,
        mentionCount: mentions.paging.total,
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
      queryKey: metricActivityCountsQueryKey(metricFqn, currentUserId),
    });
  };

  const createThreadMutation = useMutation({
    mutationFn: ({ about, message }: { about?: string; message: string }) =>
      createConversation({
        about: about || entityLink,
        message,
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
    }) => createConversationReply(threadId, { message }),
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
