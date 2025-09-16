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
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { POST_FEED_PAGE_COUNT } from '../../../constants/Feeds.constants';
import { EntityType } from '../../../enums/entity.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import { ReactionOperation } from '../../../enums/reactions.enum';
import {
  Post,
  TaskType,
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { TestCaseResolutionStatus } from '../../../generated/tests/testCaseResolutionStatus';
import { Paging } from '../../../generated/type/paging';
import { Reaction, ReactionType } from '../../../generated/type/reaction';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  deletePostById,
  deleteThread,
  getAllFeeds,
  getFeedById,
  getPostsFeedById,
  postFeedById,
  updatePost,
  updateThread,
} from '../../../rest/feedsAPI';
import { getListTestCaseIncidentByStateId } from '../../../rest/incidentManagerAPI';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import { getUpdatedThread } from '../../../utils/FeedUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ActivityFeedDrawer from '../ActivityFeedDrawer/ActivityFeedDrawer';
import { ActivityFeedProviderContextType } from './ActivityFeedProviderContext.interface';

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
  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [entityPaging, setEntityPaging] = useState<Paging>({} as Paging);
  const [focusReplyEditor, setFocusReplyEditor] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [isPostsLoading, setIsPostsLoading] = useState(false);
  const [isTestCaseResolutionLoading, setIsTestCaseResolutionLoading] =
    useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Thread>();
  const [testCaseResolutionStatus, setTestCaseResolutionStatus] = useState<
    TestCaseResolutionStatus[]
  >([]);

  const { currentUser } = useApplicationStore();

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

    if (
      active &&
      active.task?.type === TaskType.RequestTestCaseFailureResolution &&
      active.task?.testCaseResolutionStatusId
    ) {
      fetchTestCaseResolution(active.task.testCaseResolutionStatusId);
    }
  }, []);

  const fetchUpdatedThread = useCallback(
    async (id: string) => {
      try {
        const res = await getFeedById(id);
        setSelectedThread(res.data);
        setEntityThread((prev) => {
          return prev.map((thread) => {
            if (thread.id === id) {
              return res.data;
            } else {
              return thread;
            }
          });
        });
      } catch {
        // no need to show error toast
      }
    },
    [setEntityThread]
  );

  const getFeedData = useCallback(
    async (
      filterType?: FeedFilter,
      after?: string,
      type?: ThreadType,
      entityType?: EntityType,
      fqn?: string,
      taskStatus?: ThreadTaskStatus,
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
          type === ThreadType.Task ? taskStatus : undefined,
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
    [currentUser, user]
  );

  // Here value is the post message and id can be thread id or post id.
  const postFeed = useCallback(async (value: string, id: string) => {
    if (!currentUser) {
      return;
    }

    const data = {
      message: value,
      from: currentUser.name,
    } as Post;

    try {
      const res = await postFeedById(id, data);
      setActiveThread(res);
      const { id: responseId, posts } = res;
      setEntityThread((pre) => {
        return pre.map((thread) => {
          if (thread.id === responseId) {
            return { ...res, posts: posts?.slice(-3) };
          } else {
            return thread;
          }
        });
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.add-entity-error', {
          entity: t('label.feed-plural'),
        })
      );
    }
  }, []);

  const refreshActivityFeed = useCallback((threads: Thread[]) => {
    setEntityThread([...threads]);
  }, []);

  const updateEntityThread = useCallback(
    (thread: Thread) => {
      setEntityThread((prev) => {
        return prev.map((threadItem) => {
          if (threadItem.id === thread.id) {
            return thread;
          } else {
            return threadItem;
          }
        });
      });
    },
    [setEntityThread]
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
          setEntityThread((pre) => {
            return pre.map((thread) => {
              if (thread.id === data.id) {
                return {
                  ...thread,
                  posts: data.posts?.slice(-3),
                  postsCount: data.postsCount,
                };
              } else {
                return thread;
              }
            });
          });
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
        setEntityThread((prevData) => {
          return prevData.map((thread) => {
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
          });
        });
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
        setEntityThread((prevData) => {
          return prevData.map((thread) => {
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
          });
        });
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

  const updateEditorFocus = (isFocused: boolean) => {
    setFocusReplyEditor(isFocused);
  };

  const showDrawer = useCallback((thread: Thread) => {
    setIsDrawerOpen(true);
    setActiveThread(thread);
  }, []);

  const hideDrawer = useCallback(() => {
    setFocusReplyEditor(false);
    setIsDrawerOpen(false);
  }, []);

  const updateTestCaseIncidentStatus = useCallback(
    (status: TestCaseResolutionStatus[]) => {
      setTestCaseResolutionStatus(status);
    },
    [setTestCaseResolutionStatus]
  );

  const activityFeedContextValues = useMemo(() => {
    return {
      entityThread,
      selectedThread,
      isDrawerOpen,
      loading,
      isPostsLoading,
      isTestCaseResolutionLoading,
      focusReplyEditor,
      refreshActivityFeed,
      deleteFeed,
      postFeed,
      updateFeed,
      updateReactions,
      getFeedData,
      showDrawer,
      hideDrawer,
      updateEditorFocus,
      setActiveThread,
      updateEntityThread,
      entityPaging,
      userId: user ?? currentUser?.id ?? '',
      testCaseResolutionStatus,
      fetchUpdatedThread,
      updateTestCaseIncidentStatus,
    };
  }, [
    entityThread,
    selectedThread,
    isDrawerOpen,
    loading,
    isPostsLoading,
    isTestCaseResolutionLoading,
    focusReplyEditor,
    refreshActivityFeed,
    deleteFeed,
    postFeed,
    updateFeed,
    updateReactions,
    getFeedData,
    showDrawer,
    hideDrawer,
    updateEditorFocus,
    setActiveThread,
    updateEntityThread,
    entityPaging,
    user,
    currentUser,
    testCaseResolutionStatus,
    fetchUpdatedThread,
    updateTestCaseIncidentStatus,
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
