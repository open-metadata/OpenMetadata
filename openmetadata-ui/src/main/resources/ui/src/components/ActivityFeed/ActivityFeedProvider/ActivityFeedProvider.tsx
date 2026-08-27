/*
 *  Copyright 2023 Collate.
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

import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { isEqual, orderBy } from 'lodash';
import { PagingResponse } from 'Models';
import {
  createContext,
  lazy,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_DOMAIN_VALUE,
  PAGE_SIZE_LARGE,
} from '../../../constants/constants';
import { POST_FEED_PAGE_COUNT } from '../../../constants/Feeds.constants';
import { EntityType } from '../../../enums/entity.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import { ReactionOperation } from '../../../enums/reactions.enum';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import {
  Conversation,
  ConversationReply,
} from '../../../generated/entity/feed/conversation';
import { TestCaseResolutionStatus } from '../../../generated/tests/testCaseResolutionStatus';
import { ConversationFilterType } from '../../../generated/type/conversationFilterType';
import { Paging } from '../../../generated/type/paging';
import { ReactionType } from '../../../generated/type/reaction';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useDomainStore } from '../../../hooks/useDomainStore';
import {
  addActivityReaction,
  createActivityReply,
  getActivityEvents,
  getEntityActivityByFqn,
  getFollowingActivityFeed,
  getMyActivityFeed,
  getUserActivity,
  ListActivityParams,
  listActivityReplies,
  removeActivityReaction,
} from '../../../rest/activityAPI';
import {
  addConversationReaction,
  addConversationReplyReaction,
  createConversationReply,
  deleteConversation,
  deleteConversationReply,
  getConversation,
  listConversationReplies,
  listConversations,
  patchConversation,
  patchConversationReply,
  removeConversationReaction,
  removeConversationReplyReaction,
} from '../../../rest/conversationsAPI';
import { getListTestCaseIncidentByStateId } from '../../../rest/incidentManagerAPI';
import {
  addTaskComment,
  getTaskById,
  listMyAssignedTasks,
  listMyCreatedTasks,
  listMyVisibleTasks,
  listTasks,
  Task,
  TaskEntityType,
  TaskStatusGroup,
} from '../../../rest/tasksAPI';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { ActivityFeedProviderContextType } from './ActivityFeedProviderContext.interface';
const ActivityFeedDrawer = withSuspenseFallback(
  lazy(() => import('../ActivityFeedDrawer/ActivityFeedDrawer'))
);

interface Props {
  children: ReactNode;
  // To override current userId in case of User profile page
  // Will update logic to ser userID from props later
  user?: string;
}

export const ActivityFeedContext = createContext(
  {} as ActivityFeedProviderContextType
);

const getConversationFilterType = (filter?: FeedFilter) => {
  switch (filter) {
    case FeedFilter.OWNER:
      return ConversationFilterType.Owner;
    case FeedFilter.FOLLOWS:
      return ConversationFilterType.Follows;
    case FeedFilter.MENTIONS:
      return ConversationFilterType.Mentions;
    case FeedFilter.OWNER_OR_FOLLOWS:
      return ConversationFilterType.OwnerOrFollows;
    default:
      return undefined;
  }
};

const withReply = (
  conversation: Conversation,
  reply: ConversationReply,
  replyLimit?: number
) => {
  const replies = [
    ...(conversation.replies ?? []).filter((item) => item.id !== reply.id),
    reply,
  ];

  return {
    ...conversation,
    replies: replyLimit ? replies.slice(-replyLimit) : replies,
    replyCount: conversation.replyCount + 1,
    updatedAt: reply.createdAt,
  };
};

const TASK_LIST_FIELDS = 'assignees,createdBy,about,comments,payload';

type TaskListUser = { fullyQualifiedName?: string; name?: string } | undefined;

interface TaskListScope {
  feedFilterType: FeedFilter;
  entityType?: EntityType;
  fqn?: string;
  currentUser: TaskListUser;
  taskStatusGroup?: TaskStatusGroup;
}

/** The "my tasks" endpoints differ only by which side of the task the filter names. */
const myTasksEndpointFor = (feedFilterType: FeedFilter) => {
  if (feedFilterType === FeedFilter.ASSIGNED_BY) {
    return listMyCreatedTasks;
  }

  return feedFilterType === FeedFilter.ASSIGNED_TO
    ? listMyAssignedTasks
    : listMyVisibleTasks;
};

/** True when the profile being viewed is the logged-in user's own. */
const isOwnProfile = ({ entityType, fqn, currentUser }: TaskListScope) =>
  entityType === EntityType.USER &&
  Boolean(fqn) &&
  [currentUser?.fullyQualifiedName, currentUser?.name].includes(fqn);

const mentionedTaskParams = ({
  entityType,
  fqn,
  currentUser,
}: TaskListScope) => ({
  mentionedUser: currentUser?.fullyQualifiedName ?? currentUser?.name,
  // Scope to the entity only on an entity page; a user page wants every mention.
  aboutEntity: entityType !== EntityType.USER && fqn ? fqn : undefined,
});

const otherUserTaskParams = ({
  feedFilterType,
  fqn,
  currentUser,
  taskStatusGroup,
}: TaskListScope) => {
  const assigneeFqn =
    fqn || currentUser?.fullyQualifiedName || currentUser?.name;
  const isCreatedByFilter = feedFilterType === FeedFilter.ASSIGNED_BY;

  return {
    statusGroup: taskStatusGroup,
    assignee: isCreatedByFilter ? undefined : assigneeFqn,
    createdBy: isCreatedByFilter ? assigneeFqn : undefined,
  };
};

/**
 * Picks the task endpoint the current scope calls for. Extracted from getTaskData
 * so the fetcher keeps only its loading/sequence orchestration.
 */
const fetchTaskList = (
  scope: TaskListScope,
  page: { after?: string; limit?: number; domain?: string }
): Promise<PagingResponse<Task[]>> => {
  const common = { ...page, fields: TASK_LIST_FIELDS };
  const { feedFilterType, entityType, fqn, taskStatusGroup } = scope;
  const scoped = { statusGroup: taskStatusGroup, ...common };

  if (feedFilterType === FeedFilter.MENTIONS) {
    return listTasks({ ...mentionedTaskParams(scope), ...common });
  }

  if (isOwnProfile(scope)) {
    return myTasksEndpointFor(feedFilterType)(scoped);
  }

  if (entityType === EntityType.USER) {
    return listTasks({ ...otherUserTaskParams(scope), ...common });
  }

  if (entityType && fqn) {
    return listTasks({ aboutEntity: fqn, ...scoped });
  }

  return myTasksEndpointFor(feedFilterType)(scoped);
};

/** Replaces one post inside a thread's post list, leaving the rest untouched. */
/** Swaps a refreshed task into the list by id. */
const replaceTaskById = (tasks: Task[], fresh: Task) =>
  tasks.map((task) => (task.id === fresh.id ? fresh : task));

const ActivityFeedProvider = ({ children, user }: Props) => {
  const { t } = useTranslation();
  // For activity events (entity changes)
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityEvent>();
  const [activityReplies, setActivityReplies] = useState<ConversationReply[]>(
    []
  );
  const activityReplyRequest = useRef(0);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const activityRequestSeq = useRef(0);
  // getTaskData and getFeedData write the same `loading` and `entityPaging`, so a
  // single sequence guards both: an older request must not commit its rows, its
  // paging cursor, or clear the loader after a newer one has started.
  const listRequestSeq = useRef(0);
  // Conversations have their own API and model. Announcements are not mixed into this state.
  const [entityThread, setEntityThread] = useState<Conversation[]>([]);
  const [selectedThread, setSelectedThread] = useState<Conversation>();
  // For tasks - using Task type directly
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task>();

  const [entityPaging, setEntityPaging] = useState<Paging>({} as Paging);
  const [focusReplyEditor, setFocusReplyEditor] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [isPostsLoading, setIsPostsLoading] = useState(false);
  const [isTestCaseResolutionLoading, setIsTestCaseResolutionLoading] =
    useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [testCaseResolutionStatus, setTestCaseResolutionStatus] = useState<
    TestCaseResolutionStatus[]
  >([]);

  const { currentUser } = useApplicationStore();
  const activeDomain = useDomainStore((state) => state.activeDomain);

  const fetchTestCaseResolution = useCallback(async (id: string) => {
    setIsTestCaseResolutionLoading(true);
    try {
      const { data } = await getListTestCaseIncidentByStateId(id, {
        limit: PAGE_SIZE_LARGE,
      });

      setTestCaseResolutionStatus(
        orderBy(data, (item) => item.timestamp, ['asc'])
      );
    } catch {
      setTestCaseResolutionStatus([]);
    } finally {
      setIsTestCaseResolutionLoading(false);
    }
  }, []);

  const fetchPostsFeed = useCallback(async (active: Conversation) => {
    if (
      active.replyCount > POST_FEED_PAGE_COUNT &&
      active.replies?.length !== active.replyCount
    ) {
      setIsPostsLoading(true);
      try {
        const { data } = await listConversationReplies(active.id, {
          limit: 100,
        });
        setSelectedThread((pre) =>
          pre?.id === active.id ? { ...active, replies: data } : pre
        );
      } finally {
        setIsPostsLoading(false);
      }
    }
  }, []);

  const setActiveThread = useCallback(
    (active?: Conversation) => {
      setSelectedThread(active);
      active && fetchPostsFeed(active);
    },
    [fetchPostsFeed]
  );

  const setActiveTask = useCallback(
    (active?: Task) => {
      setSelectedTask(active);

      // Fetch TCRS records for this incident task to populate the timeline.
      // In task-first mode the task UUID equals the TCRS stateId (see
      // IncidentTcrsSyncHandler). The pre-task-first code read from
      // payload.testCaseResolutionStatusId, but that field doesn't exist in the
      // new task system, so we fall back to active.id.
      if (active && active.type === TaskEntityType.TestCaseResolution) {
        const stateId =
          active.payload &&
          typeof active.payload === 'object' &&
          'testCaseResolutionStatusId' in active.payload
            ? (active.payload.testCaseResolutionStatusId as string)
            : active.id;
        if (stateId) {
          fetchTestCaseResolution(stateId);
        }
      }
    },
    [fetchTestCaseResolution]
  );

  const fetchUpdatedThread = useCallback(
    async (id: string, isTask?: boolean) => {
      try {
        if (isTask) {
          const res = await getTaskById(id, {
            fields: 'assignees,createdBy,about,comments,payload',
          });
          const task = res.data;
          setSelectedTask(task);
          setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
        } else {
          const conversation = await getConversation(id);
          setSelectedThread(conversation);
          setEntityThread((prev) =>
            prev.map((item) => (item.id === id ? conversation : item))
          );
        }
      } catch {
        // no need to show error toast
      }
    },
    []
  );

  const getTaskData = useCallback(
    async (
      filterType?: FeedFilter,
      after?: string,
      entityType?: EntityType,
      fqn?: string,
      taskStatusGroup?: TaskStatusGroup,
      limit?: number
    ) => {
      const requestId = ++listRequestSeq.current;
      try {
        setLoading(true);
        if (!after) {
          // A first-page fetch replaces the result set. Dropping the rows and the
          // paging cursor now is what stops the previous query's list staying on
          // screen, and stops the infinite-scroll effect appending this query's
          // next page onto it using the old cursor.
          setTasks([]);
          setEntityPaging({} as Paging);
        }
        const domain =
          activeDomain !== DEFAULT_DOMAIN_VALUE ? activeDomain : undefined;
        const taskResponse = await fetchTaskList(
          {
            feedFilterType: filterType ?? FeedFilter.ALL,
            entityType,
            fqn,
            currentUser,
            taskStatusGroup,
          },
          { after, limit, domain }
        );

        if (listRequestSeq.current !== requestId) {
          return;
        }

        const sortedTasks = orderBy(taskResponse.data, ['createdAt'], ['desc']);

        setTasks((prev) => (after ? [...prev, ...sortedTasks] : sortedTasks));
        setEntityPaging(taskResponse.paging);
      } catch (err) {
        if (listRequestSeq.current !== requestId) {
          return;
        }

        showErrorToast(
          err as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.task-plural'),
          })
        );
      } finally {
        if (listRequestSeq.current === requestId) {
          setLoading(false);
        }
      }
    },
    [currentUser, activeDomain, t]
  );

  const getFeedData = useCallback(
    async (
      filterType?: FeedFilter,
      after?: string,
      entityType?: EntityType,
      fqn?: string,
      limit?: number
    ) => {
      const requestId = ++listRequestSeq.current;
      try {
        setLoading(true);
        if (!after) {
          setEntityThread([]);
          setEntityPaging({} as Paging);
        }
        const feedFilterType = filterType ?? FeedFilter.ALL;
        let userId = undefined;

        if (entityType === EntityType.USER) {
          userId = user;
        } else if (feedFilterType !== FeedFilter.ALL) {
          userId = currentUser?.id;
        }

        const { data, paging } = await listConversations({
          entityLink:
            entityType !== EntityType.USER && fqn
              ? getEntityFeedLink(entityType, fqn)
              : undefined,
          after,
          filterType:
            getConversationFilterType(feedFilterType) ??
            (userId ? ConversationFilterType.OwnerOrFollows : undefined),
          userId,
          limit,
        });
        if (listRequestSeq.current !== requestId) {
          return;
        }

        setEntityThread((prev) => (after ? [...prev, ...data] : [...data]));
        setEntityPaging(paging);
      } catch (err) {
        if (listRequestSeq.current !== requestId) {
          return;
        }

        showErrorToast(
          err as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.activity-feed'),
          })
        );
      } finally {
        if (listRequestSeq.current === requestId) {
          setLoading(false);
        }
      }
    },
    [currentUser, user, t]
  );

  // Here value is the post message and id can be thread id or post id.
  const postFeed = useCallback(
    async (value: string, id: string, isTask?: boolean) => {
      if (!currentUser) {
        return;
      }

      try {
        if (isTask) {
          const updatedTask = await addTaskComment(id, value);
          setActiveTask(updatedTask);
          setTasks((prev) =>
            prev.map((task) => (task.id === id ? updatedTask : task))
          );
        } else {
          const reply = await createConversationReply(id, { message: value });
          setSelectedThread((current) =>
            current?.id === id ? withReply(current, reply) : current
          );
          setEntityThread((current) =>
            current.map((conversation) =>
              conversation.id === id
                ? withReply(conversation, reply, POST_FEED_PAGE_COUNT)
                : conversation
            )
          );
        }
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.add-entity-error', {
            entity: t('label.conversation'),
          })
        );
      }
    },
    [currentUser, setActiveTask, setActiveThread, t]
  );

  const refreshActivityFeed = useCallback((threads: Conversation[]) => {
    setEntityThread([...threads]);
  }, []);

  const updateEntityThread = useCallback((thread: Conversation) => {
    setEntityThread((prev) =>
      prev.map((threadItem) =>
        threadItem.id === thread.id ? thread : threadItem
      )
    );
  }, []);

  const updateTask = useCallback((task: Task) => {
    setTasks((prev) =>
      prev.map((taskItem) => (taskItem.id === task.id ? task : taskItem))
    );
  }, []);

  const deleteFeed = useCallback(
    async (threadId: string, postId: string, isThread: boolean) => {
      if (isThread) {
        const data = await deleteConversation(threadId);
        setEntityThread((prev) =>
          prev.filter((thread) => thread.id !== data.id)
        );
        setSelectedThread((current) =>
          current?.id === data.id ? undefined : current
        );
      } else {
        await deleteConversationReply(threadId, postId);
        const withoutReply = (conversation: Conversation) => ({
          ...conversation,
          replies: (conversation.replies ?? []).filter(
            (reply) => reply.id !== postId
          ),
          replyCount: Math.max(0, conversation.replyCount - 1),
        });
        setEntityThread((current) =>
          current.map((conversation) =>
            conversation.id === threadId
              ? withoutReply(conversation)
              : conversation
          )
        );
        setSelectedThread((current) =>
          current?.id === threadId ? withoutReply(current) : current
        );
        setActivityReplies((current) =>
          current.filter((reply) => reply.id !== postId)
        );
      }
    },
    [setActiveThread]
  );

  const updateThreadHandler = useCallback(
    async (threadId: string, data: Operation[]) => {
      try {
        const res = await patchConversation(threadId, data);
        setEntityThread((prevData) =>
          prevData.map((thread) => {
            if (isEqual(threadId, thread.id)) {
              return res;
            } else {
              return thread;
            }
          })
        );
        setSelectedThread((current) =>
          current?.id === threadId ? res : current
        );
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    []
  );

  const updatePostHandler = useCallback(
    async (threadId: string, postId: string, data: Operation[]) => {
      try {
        const res = await patchConversationReply(threadId, postId, data);
        const updateReplies = (replies?: ConversationReply[]) =>
          (replies ?? []).map((reply) => (reply.id === postId ? res : reply));
        setEntityThread((prevData) =>
          prevData.map((thread) => {
            if (isEqual(threadId, thread.id)) {
              return { ...thread, replies: updateReplies(thread.replies) };
            } else {
              return thread;
            }
          })
        );
        setSelectedThread((current) =>
          current?.id === threadId
            ? { ...current, replies: updateReplies(current.replies) }
            : current
        );
        setActivityReplies(updateReplies);
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    []
  );

  const updateFeed = useCallback(
    async (
      threadId: string,
      postId: string,
      isThread: boolean,
      data: Operation[]
    ) => {
      if (isThread) {
        await updateThreadHandler(threadId, data).catch(() => {
          // ignore since error is displayed in toast in the parent promise.
        });
      } else {
        await updatePostHandler(threadId, postId, data).catch(() => {
          // ignore since error is displayed in toast in the parent promise.
        });
      }
    },
    [updatePostHandler, updateThreadHandler]
  );

  const updateReactions = useCallback(
    async (
      post: Conversation | ConversationReply,
      feedId: string,
      isThread: boolean,
      reactionType: ReactionType,
      reactionOperation: ReactionOperation
    ) => {
      if (isThread) {
        const conversation =
          reactionOperation === ReactionOperation.ADD
            ? await addConversationReaction(feedId, reactionType)
            : await removeConversationReaction(feedId, reactionType);
        setEntityThread((current) =>
          current.map((item) => (item.id === feedId ? conversation : item))
        );
        setSelectedThread((current) =>
          current?.id === feedId ? conversation : current
        );

        return;
      }

      const reply =
        reactionOperation === ReactionOperation.ADD
          ? await addConversationReplyReaction(feedId, post.id, reactionType)
          : await removeConversationReplyReaction(
              feedId,
              post.id,
              reactionType
            );
      const updateReplies = (replies?: ConversationReply[]) =>
        (replies ?? []).map((item) => (item.id === reply.id ? reply : item));
      setEntityThread((current) =>
        current.map((conversation) =>
          conversation.id === feedId
            ? { ...conversation, replies: updateReplies(conversation.replies) }
            : conversation
        )
      );
      setSelectedThread((current) =>
        current?.id === feedId
          ? { ...current, replies: updateReplies(current.replies) }
          : current
      );
      setActivityReplies(updateReplies);
    },
    []
  );

  const updateActivityReaction = useCallback(
    async (
      activityId: string,
      reactionType: ReactionType,
      reactionOperation: ReactionOperation
    ) => {
      try {
        let updatedActivity: ActivityEvent;
        if (reactionOperation === ReactionOperation.ADD) {
          updatedActivity = await addActivityReaction(activityId, reactionType);
        } else {
          await removeActivityReaction(activityId, reactionType);
          const currentActivity = activityEvents.find(
            (a) => a.id === activityId
          );
          updatedActivity = {
            ...currentActivity,
            reactions: (currentActivity?.reactions ?? []).filter(
              (r) =>
                !(
                  r.reactionType === reactionType &&
                  r.user?.id === currentUser?.id
                )
            ),
          } as ActivityEvent;
        }

        setActivityEvents((prev) =>
          prev.map((a) => (a.id === activityId ? updatedActivity : a))
        );
        // Keep the right-panel copy in sync, else its reactions go stale when
        // toggled from either the list card or the panel itself.
        setSelectedActivity((prev) =>
          prev?.id === activityId ? updatedActivity : prev
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [activityEvents, currentUser?.id]
  );

  const updateEditorFocus = useCallback((isFocused: boolean) => {
    setFocusReplyEditor(isFocused);
  }, []);

  const showDrawer = useCallback(
    (thread: Conversation) => {
      setIsDrawerOpen(true);
      setActiveThread(thread);
      setSelectedTask(undefined);
    },
    [setActiveThread]
  );

  const showTaskDrawer = useCallback(
    (task: Task) => {
      setIsDrawerOpen(true);
      setActiveTask(task);
      setSelectedThread(undefined);
      setSelectedActivity(undefined);
    },
    [setActiveTask]
  );

  const setActiveActivity = useCallback(async (activity?: ActivityEvent) => {
    const requestId = activityReplyRequest.current + 1;
    activityReplyRequest.current = requestId;
    setSelectedActivity(activity);
    setActivityReplies([]);

    if (!activity) {
      setIsPostsLoading(false);

      return;
    }

    setIsPostsLoading(true);
    try {
      const response = await listActivityReplies(activity.id, { limit: 100 });
      if (activityReplyRequest.current === requestId) {
        setActivityReplies((current) => {
          const currentIds = new Set(current.map((reply) => reply.id));

          return [
            ...response.data.filter((reply) => !currentIds.has(reply.id)),
            ...current,
          ];
        });
      }
    } catch {
      // The request starts from an empty list; retain replies posted while it was pending.
    } finally {
      if (activityReplyRequest.current === requestId) {
        setIsPostsLoading(false);
      }
    }
  }, []);

  const showActivityDrawer = useCallback(
    (activity: ActivityEvent) => {
      setIsDrawerOpen(true);
      setSelectedThread(undefined);
      setSelectedTask(undefined);
      setActiveActivity(activity);
    },
    [setActiveActivity]
  );

  const postActivityComment = useCallback(
    async (message: string, activity: ActivityEvent) => {
      try {
        const reply = await createActivityReply(activity.id, { message });
        setActivityReplies((current) => [
          ...current.filter((item) => item.id !== reply.id),
          reply,
        ]);
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    []
  );
  const hideDrawer = useCallback(() => {
    setFocusReplyEditor(false);
    setIsDrawerOpen(false);
    setSelectedActivity(undefined);
    setActivityReplies([]);
  }, []);

  const updateTestCaseIncidentStatus = useCallback(
    (status: TestCaseResolutionStatus[]) => {
      setTestCaseResolutionStatus(status);

      // After a header-driven transition the selected task's status/stage is
      // stale. Re-fetch it so the left-panel task card reflects the new state
      // without a full page reload.
      if (selectedTask?.id) {
        getTaskById(selectedTask.id, { fields: 'assignees,about' })
          .then((res) => {
            const fresh = res.data;
            setSelectedTask(fresh);
            setTasks((prev) => replaceTaskById(prev, fresh));
          })
          .catch(() => {});
      }
    },
    [selectedTask?.id]
  );

  // Activity Events fetch methods.
  // Every activity fetcher shares this runner so the sequence guard and the
  // loading flag stay identical across all of them — a request that has been
  // superseded must not commit its result, toast, or clear a loading flag that
  // now belongs to a newer request.
  //
  // Domain scoping is deliberately absent: the `withDomainFilter` interceptor
  // registered in AuthProvider appends `domain` to every GET, so resolving it
  // here would duplicate that.
  const runActivityRequest = useCallback(
    async (request: () => Promise<{ data: ActivityEvent[] }>) => {
      const seq = ++activityRequestSeq.current;
      setIsActivityLoading(true);
      try {
        const { data } = await request();
        if (seq !== activityRequestSeq.current) {
          return;
        }
        setActivityEvents(data);
      } catch (err) {
        if (seq === activityRequestSeq.current) {
          showErrorToast(err as AxiosError);
        }
      } finally {
        if (seq === activityRequestSeq.current) {
          setIsActivityLoading(false);
        }
      }
    },
    []
  );

  const fetchActivityEventsHandler = useCallback(
    async (params?: ListActivityParams) => {
      await runActivityRequest(() => getActivityEvents({ ...params }));
    },
    [runActivityRequest]
  );

  const fetchMyActivityFeedHandler = useCallback(
    async (params?: { days?: number; limit?: number }) => {
      await runActivityRequest(() => getMyActivityFeed({ ...params }));
    },
    [runActivityRequest]
  );

  const fetchFollowingActivityHandler = useCallback(
    async (params?: { days?: number; limit?: number }) => {
      await runActivityRequest(() => getFollowingActivityFeed({ ...params }));
    },
    [runActivityRequest]
  );

  const fetchEntityActivityHandler = useCallback(
    async (
      entityType: string,
      fqn: string,
      params?: { days?: number; limit?: number }
    ) => {
      setIsActivityLoading(true);
      try {
        const domain =
          activeDomain !== DEFAULT_DOMAIN_VALUE ? activeDomain : undefined;
        const { data } = await getEntityActivityByFqn(entityType, fqn, {
          ...params,
          domain,
        });
        setActivityEvents(data);
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsActivityLoading(false);
      }
    },
    [activeDomain]
  );

  const fetchUserActivityHandler = useCallback(
    async (userId: string, params?: { days?: number; limit?: number }) => {
      setIsActivityLoading(true);
      try {
        const domain =
          activeDomain !== DEFAULT_DOMAIN_VALUE ? activeDomain : undefined;
        const { data } = await getUserActivity(userId, { ...params, domain });
        setActivityEvents(data);
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsActivityLoading(false);
      }
    },
    [activeDomain]
  );

  const activityFeedContextValues = useMemo(() => {
    return {
      entityThread,
      selectedThread,
      tasks,
      selectedTask,
      isDrawerOpen,
      loading,
      isActivityLoading,
      isPostsLoading,
      isTestCaseResolutionLoading,
      focusReplyEditor,
      refreshActivityFeed,
      deleteFeed,
      postFeed,
      postActivityComment,
      updateFeed,
      updateReactions,
      getFeedData,
      getTaskData,
      showDrawer,
      showTaskDrawer,
      showActivityDrawer,
      hideDrawer,
      updateEditorFocus,
      setActiveThread,
      setActiveTask,
      setActiveActivity,
      updateEntityThread,
      updateTask,
      entityPaging,
      userId: user ?? currentUser?.id ?? '',
      testCaseResolutionStatus,
      fetchUpdatedThread,
      updateTestCaseIncidentStatus,
      activityEvents,
      selectedActivity,
      activityReplies,
      fetchActivityEvents: fetchActivityEventsHandler,
      fetchMyActivityFeed: fetchMyActivityFeedHandler,
      fetchFollowingActivity: fetchFollowingActivityHandler,
      fetchEntityActivity: fetchEntityActivityHandler,
      fetchUserActivity: fetchUserActivityHandler,
      updateActivityReaction,
    };
  }, [
    entityThread,
    selectedThread,
    tasks,
    selectedTask,
    isDrawerOpen,
    loading,
    isActivityLoading,
    isPostsLoading,
    isTestCaseResolutionLoading,
    focusReplyEditor,
    refreshActivityFeed,
    deleteFeed,
    postFeed,
    postActivityComment,
    updateFeed,
    updateReactions,
    getFeedData,
    getTaskData,
    showDrawer,
    showTaskDrawer,
    showActivityDrawer,
    hideDrawer,
    updateEditorFocus,
    setActiveThread,
    setActiveTask,
    setActiveActivity,
    updateEntityThread,
    updateTask,
    entityPaging,
    user,
    currentUser,
    testCaseResolutionStatus,
    fetchUpdatedThread,
    updateTestCaseIncidentStatus,
    activityEvents,
    selectedActivity,
    activityReplies,
    fetchActivityEventsHandler,
    fetchMyActivityFeedHandler,
    fetchFollowingActivityHandler,
    fetchEntityActivityHandler,
    fetchUserActivityHandler,
    updateActivityReaction,
  ]);

  return (
    <ActivityFeedContext.Provider value={activityFeedContextValues}>
      {children}
      {isDrawerOpen && <ActivityFeedDrawer open={isDrawerOpen} />}
    </ActivityFeedContext.Provider>
  );
};

export const useActivityFeedProvider = () => useContext(ActivityFeedContext);

export default ActivityFeedProvider;
