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
import { compare, Operation } from 'fast-json-patch';
import { isEqual, orderBy } from 'lodash';
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
  Post,
  Thread,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { TestCaseResolutionStatus } from '../../../generated/tests/testCaseResolutionStatus';
import { Paging } from '../../../generated/type/paging';
import { Reaction, ReactionType } from '../../../generated/type/reaction';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useDomainStore } from '../../../hooks/useDomainStore';
import {
  addActivityReaction,
  deletePostById,
  deleteThread,
  getActivityEvents,
  getAllFeeds,
  getEntityActivityByFqn,
  getFeedById,
  getFollowingActivityFeed,
  getMyActivityFeed,
  getPostsFeedById,
  getUserActivity,
  ListActivityParams,
  postFeedById,
  removeActivityReaction,
  updatePost,
  updateThread,
} from '../../../rest/feedsAPI';
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
import { getUpdatedThread } from '../../../utils/FeedUtilsPure';
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

const ActivityFeedProvider = ({ children, user }: Props) => {
  const { t } = useTranslation();
  // For activity events (entity changes)
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityEvent>();
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  // The activity fetchers all write to the same activityEvents state. Switching the
  // home widget filter quickly can let a slower earlier request resolve last and
  // overwrite newer results, so each request claims a sequence number and only the
  // latest one is allowed to commit.
  const activityRequestSeq = useRef(0);
  // For regular feeds (conversations, announcements)
  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread>();
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

  const fetchPostsFeed = useCallback(async (active: Thread) => {
    // If the posts count is greater than the page count, fetch the posts
    if (
      active?.postsCount &&
      active?.postsCount > POST_FEED_PAGE_COUNT &&
      active?.posts?.length !== active?.postsCount
    ) {
      setIsPostsLoading(true);
      try {
        const { data } = await getPostsFeedById(active.id);
        setSelectedThread((pre) =>
          pre?.id === active?.id ? { ...active, posts: data } : pre
        );
      } finally {
        setIsPostsLoading(false);
      }
    }
  }, []);

  const setActiveThread = useCallback((active?: Thread) => {
    setSelectedThread(active);
    active && fetchPostsFeed(active);
  }, []);

  const setActiveTask = useCallback((active?: Task) => {
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
  }, []);

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
          const res = await getFeedById(id);
          setSelectedThread(res.data);
          setEntityThread((prev) =>
            prev.map((thread) => (thread.id === id ? res.data : thread))
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
      try {
        setLoading(true);
        const feedFilterType = filterType ?? FeedFilter.ALL;
        const domain =
          activeDomain !== DEFAULT_DOMAIN_VALUE ? activeDomain : undefined;
        const taskFields = 'assignees,createdBy,about,comments,payload';
        const isCurrentUserEntity =
          entityType === EntityType.USER &&
          Boolean(fqn) &&
          [currentUser?.fullyQualifiedName, currentUser?.name].includes(fqn);
        let taskResponse;

        if (feedFilterType === FeedFilter.MENTIONS) {
          const userFqn = currentUser?.fullyQualifiedName ?? currentUser?.name;
          taskResponse = await listTasks({
            mentionedUser: userFqn,
            aboutEntity:
              entityType !== EntityType.USER && fqn ? fqn : undefined,
            after,
            limit,
            domain,
            fields: taskFields,
          });
        } else if (isCurrentUserEntity) {
          if (feedFilterType === FeedFilter.ASSIGNED_BY) {
            taskResponse = await listMyCreatedTasks({
              statusGroup: taskStatusGroup,
              after,
              limit,
              domain,
              fields: taskFields,
            });
          } else if (feedFilterType === FeedFilter.ASSIGNED_TO) {
            taskResponse = await listMyAssignedTasks({
              statusGroup: taskStatusGroup,
              after,
              limit,
              domain,
              fields: taskFields,
            });
          } else {
            taskResponse = await listMyVisibleTasks({
              statusGroup: taskStatusGroup,
              after,
              limit,
              domain,
              fields: taskFields,
            });
          }
        } else if (entityType === EntityType.USER) {
          const assigneeFqn =
            fqn || currentUser?.fullyQualifiedName || currentUser?.name;
          taskResponse = await listTasks({
            statusGroup: taskStatusGroup,
            assignee:
              feedFilterType === FeedFilter.ASSIGNED_BY
                ? undefined
                : assigneeFqn,
            createdBy:
              feedFilterType === FeedFilter.ASSIGNED_BY
                ? assigneeFqn
                : undefined,
            after,
            limit,
            domain,
            fields: taskFields,
          });
        } else if (entityType && fqn) {
          taskResponse = await listTasks({
            statusGroup: taskStatusGroup,
            aboutEntity: fqn,
            after,
            limit,
            domain,
            fields: taskFields,
          });
        } else if (feedFilterType === FeedFilter.ASSIGNED_BY) {
          taskResponse = await listMyCreatedTasks({
            statusGroup: taskStatusGroup,
            after,
            limit,
            domain,
            fields: taskFields,
          });
        } else if (feedFilterType === FeedFilter.ASSIGNED_TO) {
          taskResponse = await listMyAssignedTasks({
            statusGroup: taskStatusGroup,
            after,
            limit,
            domain,
            fields: taskFields,
          });
        } else {
          taskResponse = await listMyVisibleTasks({
            statusGroup: taskStatusGroup,
            after,
            limit,
            domain,
            fields: taskFields,
          });
        }

        const sortedTasks = orderBy(taskResponse.data, ['createdAt'], ['desc']);

        setTasks((prev) => (after ? [...prev, ...sortedTasks] : sortedTasks));
        setEntityPaging(taskResponse.paging);
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.task-plural'),
          })
        );
      } finally {
        setLoading(false);
      }
    },
    [currentUser, activeDomain]
  );

  const getFeedData = useCallback(
    async (
      filterType?: FeedFilter,
      after?: string,
      type?: ThreadType,
      entityType?: EntityType,
      fqn?: string,
      taskStatusGroup?: TaskStatusGroup,
      limit?: number
    ) => {
      try {
        setLoading(true);
        const feedFilterType = filterType ?? FeedFilter.ALL;
        let userId = undefined;

        if (entityType === EntityType.USER) {
          userId = user;
        } else if (feedFilterType !== FeedFilter.ALL) {
          userId = currentUser?.id;
        }

        const { data, paging } = await getAllFeeds(
          entityType !== EntityType.USER && fqn
            ? getEntityFeedLink(entityType, fqn)
            : undefined,
          after,
          type,
          feedFilterType,
          undefined,
          userId,
          limit
        );
        setEntityThread((prev) => (after ? [...prev, ...data] : [...data]));
        setEntityPaging(paging);
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.activity-feed'),
          })
        );
      } finally {
        setLoading(false);
      }
    },
    [currentUser, user, getTaskData]
  );

  // Here value is the post message and id can be thread id or post id.
  const postFeed = useCallback(
    async (value: string, id: string, isTask?: boolean) => {
      if (!currentUser) {
        return;
      }

      try {
        if (isTask) {
          // Use tasksAPI for task comments
          const updatedTask = await addTaskComment(id, value);
          setActiveTask(updatedTask);
          setTasks((prev) =>
            prev.map((task) => (task.id === id ? updatedTask : task))
          );
        } else {
          const data = {
            message: value,
          } as Post;

          const res = await postFeedById(id, data);
          setActiveThread(res);
          const { id: responseId, posts } = res;
          setEntityThread((pre) =>
            pre.map((thread) => {
              if (thread.id === responseId) {
                return { ...res, posts: posts?.slice(-3) };
              }

              return thread;
            })
          );
        }
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.add-entity-error', {
            entity: t('label.feed-plural'),
          })
        );
      }
    },
    [currentUser]
  );

  const refreshActivityFeed = useCallback((threads: Thread[]) => {
    setEntityThread([...threads]);
  }, []);

  const updateEntityThread = useCallback(
    (thread: Thread) => {
      setEntityThread((prev) =>
        prev.map((threadItem) =>
          threadItem.id === thread.id ? thread : threadItem
        )
      );
    },
    [setEntityThread]
  );

  const updateTask = useCallback(
    (task: Task) => {
      setTasks((prev) =>
        prev.map((taskItem) => (taskItem.id === task.id ? task : taskItem))
      );
    },
    [setTasks]
  );

  const deleteFeed = useCallback(
    async (threadId: string, postId: string, isThread: boolean) => {
      if (isThread) {
        const data = await deleteThread(threadId);
        setEntityThread((prev) =>
          prev.filter((thread) => thread.id !== data.id)
        );
      } else {
        const deleteResponse = await deletePostById(threadId, postId);
        if (deleteResponse) {
          const data = await getUpdatedThread(threadId);
          setEntityThread((pre) =>
            pre.map((thread) => {
              if (thread.id === data.id) {
                return {
                  ...thread,
                  posts: data.posts?.slice(-3),
                  postsCount: data.postsCount,
                };
              } else {
                return thread;
              }
            })
          );
          setActiveThread(data);
        }
      }
    },
    []
  );

  const updateThreadHandler = useCallback(
    async (threadId: string, data: Operation[]) => {
      try {
        const res = await updateThread(threadId, data);
        setEntityThread((prevData) =>
          prevData.map((thread) => {
            if (isEqual(threadId, thread.id)) {
              return {
                ...thread,
                reactions: res.reactions,
                message: res.message,
                announcement: res?.announcement,
              };
            } else {
              return thread;
            }
          })
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
        const res = await updatePost(threadId, postId, data);
        const activeThreadData = await getFeedById(threadId);
        setEntityThread((prevData) =>
          prevData.map((thread) => {
            if (isEqual(threadId, thread.id)) {
              const updatedPosts = (thread.posts ?? []).map((post) => {
                if (isEqual(postId, post.id)) {
                  return {
                    ...post,
                    reactions: res.reactions,
                    message: res.message,
                  };
                } else {
                  return post;
                }
              });

              return { ...thread, posts: updatedPosts };
            } else {
              return thread;
            }
          })
        );
        setSelectedThread(activeThreadData.data);
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
    []
  );

  const updateReactions = async (
    post: Post,
    feedId: string,
    isThread: boolean,
    reactionType: ReactionType,
    reactionOperation: ReactionOperation
  ) => {
    let updatedReactions = post.reactions ?? [];
    if (reactionOperation === ReactionOperation.ADD) {
      const reactionObject = {
        reactionType,
        user: {
          id: currentUser?.id as string,
        },
      };

      updatedReactions = [...updatedReactions, reactionObject as Reaction];
    } else {
      updatedReactions = updatedReactions.filter(
        (reaction) =>
          !(
            reaction.reactionType === reactionType &&
            reaction.user.id === currentUser?.id
          )
      );
    }

    const patch = compare(
      { ...post, reactions: [...(post.reactions ?? [])] },
      {
        ...post,
        reactions: updatedReactions,
      }
    );

    await updateFeed(feedId, post.id, isThread, patch).catch(() => {
      // ignore since error is displayed in toast in the parent promise.
    });
  };

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

  const updateEditorFocus = (isFocused: boolean) => {
    setFocusReplyEditor(isFocused);
  };

  const showDrawer = useCallback((thread: Thread) => {
    setIsDrawerOpen(true);
    setActiveThread(thread);
    setSelectedTask(undefined);
  }, []);

  const showTaskDrawer = useCallback((task: Task) => {
    setIsDrawerOpen(true);
    setActiveTask(task);
    setSelectedThread(undefined);
    setSelectedActivity(undefined);
  }, []);

  // Change-event activities are read-only notifications with no discussion
  // thread of their own — selecting one just shows its change detail + reactions.
  const setActiveActivity = useCallback((activity?: ActivityEvent) => {
    setSelectedActivity(activity);
  }, []);

  const showActivityDrawer = useCallback((activity: ActivityEvent) => {
    setIsDrawerOpen(true);
    setSelectedActivity(activity);
    setSelectedThread(undefined);
    setSelectedTask(undefined);
  }, []);

  const hideDrawer = useCallback(() => {
    setFocusReplyEditor(false);
    setIsDrawerOpen(false);
    setSelectedActivity(undefined);
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
            setTasks((prev) =>
              prev.map((t) => (t.id === fresh.id ? fresh : t))
            );
          })
          .catch(() => {});
      }
    },
    [setTestCaseResolutionStatus, selectedTask?.id]
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
