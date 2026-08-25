/*
 *  Copyright 2024 Collate.
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

/**
 * Consumers of ActivityFeedProvider used only by ActivityFeedProvider.test.tsx.
 * They live here rather than under src/components so nothing in the component
 * tree looks like an application component when it is a test fixture.
 *
 * Each effect lists the provider method it calls: the provider memoises all of
 * them with useCallback, so the dependency is stable and the effect still runs
 * once per mount.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useActivityFeedProvider } from '../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { EntityType } from '../enums/entity.enum';
import { FeedFilter } from '../enums/mydata.enum';
import { ReactionOperation } from '../enums/reactions.enum';
import { ActivityEvent } from '../generated/entity/activity/activityEvent';
import { ThreadType } from '../generated/entity/feed/thread';
import { ReactionType } from '../generated/type/reaction';
import { TaskStatusGroup } from '../rest/tasksAPI';

const LOADING_LABEL = 'label.loading';
const CHILDREN_LABEL = 'label.children';
const ACTIVITY_ID = 'activity-123';

export const DummyChildrenComponent = () => {
  const { t } = useTranslation();
  const { postFeed, getTaskData, deleteFeed, loading } =
    useActivityFeedProvider();
  const handlePostFeed = () => {
    postFeed('New Post Feed added', '123');
  };

  const handleDeleteFeed = () => {
    deleteFeed('123', '456', true);
  };

  useEffect(() => {
    getTaskData(
      FeedFilter.OWNER_OR_FOLLOWS,
      undefined,
      EntityType.USER,
      'admin',
      TaskStatusGroup.Open
    );
  }, [getTaskData]);

  if (loading) {
    return <p data-testid="loading">{t(LOADING_LABEL)}</p>;
  }

  return (
    <div>
      <button data-testid="post-feed" onClick={handlePostFeed}>
        {t('label.post-feed-button')}
      </button>
      <button data-testid="delete-feed" onClick={handleDeleteFeed}>
        {t('label.delete-feed-button')}
      </button>
    </div>
  );
};

export const DummyChildrenTaskCloseComponent = () => {
  const { t } = useTranslation();
  const { getTaskData } = useActivityFeedProvider();

  useEffect(() => {
    getTaskData(
      FeedFilter.OWNER_OR_FOLLOWS,
      'after-234',
      EntityType.USER,
      'admin',
      TaskStatusGroup.Closed
    );
  }, [getTaskData]);

  return <p>{t(CHILDREN_LABEL)}</p>;
};

export const DummyChildrenEntityComponent = () => {
  const { t } = useTranslation();
  const { getFeedData } = useActivityFeedProvider();

  useEffect(() => {
    getFeedData(
      FeedFilter.ALL,
      undefined,
      ThreadType.Conversation,
      EntityType.TABLE,
      'admin',
      TaskStatusGroup.Open
    );
  }, [getFeedData]);

  return <p>{t(CHILDREN_LABEL)}</p>;
};

export const DummyChildrenMentionsComponent = () => {
  const { t } = useTranslation();
  const { getFeedData } = useActivityFeedProvider();

  useEffect(() => {
    getFeedData(
      FeedFilter.MENTIONS,
      undefined,
      ThreadType.Conversation,
      EntityType.USER,
      'admin'
    );
  }, [getFeedData]);

  return <p>{t(CHILDREN_LABEL)}</p>;
};

/**
 * Exposes the task list and the paging cursor so a test can observe what the
 * provider holds *between* a filter switch and the response landing.
 */
export const DummyTaskListStateComponent = () => {
  const { getTaskData, tasks, entityPaging } = useActivityFeedProvider();

  const fetchTasks = (statusGroup: TaskStatusGroup) => {
    getTaskData(
      FeedFilter.OWNER_OR_FOLLOWS,
      undefined,
      EntityType.TABLE,
      'db.schema.tbl',
      statusGroup
    );
  };

  return (
    <div>
      <button
        aria-label="fetch open tasks"
        data-testid="fetch-open"
        onClick={() => fetchTasks(TaskStatusGroup.Open)}
      />
      <button
        aria-label="fetch closed tasks"
        data-testid="fetch-closed"
        onClick={() => fetchTasks(TaskStatusGroup.Closed)}
      />
      <span data-testid="task-ids">
        {tasks.map((task) => task.id).join(',')}
      </span>
      <span data-testid="paging-after">{entityPaging.after ?? 'none'}</span>
    </div>
  );
};

export const DummyChildrenDeletePostComponent = () => {
  const { t } = useTranslation();
  const { deleteFeed } = useActivityFeedProvider();

  const handleDeleteFeed = () => {
    deleteFeed('123', '456', false);
  };

  return (
    <button data-testid="delete-feed" onClick={handleDeleteFeed}>
      {t('delete-feed-button')}
    </button>
  );
};

export const DummyActivityFeedComponent = () => {
  const { t } = useTranslation();
  const { fetchMyActivityFeed, activityEvents, isActivityLoading } =
    useActivityFeedProvider();

  useEffect(() => {
    fetchMyActivityFeed({ days: 7, limit: 20 });
  }, [fetchMyActivityFeed]);

  if (isActivityLoading) {
    return <p data-testid="activity-loading">{t(LOADING_LABEL)}</p>;
  }

  return (
    <div data-testid="activity-feed">
      <span data-testid="activity-count">{activityEvents.length}</span>
    </div>
  );
};

export const DummyEntityActivityFeedComponent = () => {
  const { t } = useTranslation();
  const { fetchEntityActivity, activityEvents, isActivityLoading } =
    useActivityFeedProvider();

  useEffect(() => {
    fetchEntityActivity(EntityType.TABLE, 'service.db.schema.table', {
      days: 7,
      limit: 20,
    });
  }, [fetchEntityActivity]);

  if (isActivityLoading) {
    return <p data-testid="entity-activity-loading">{t(LOADING_LABEL)}</p>;
  }

  return (
    <div data-testid="entity-activity-feed">
      <span data-testid="entity-activity-count">{activityEvents.length}</span>
    </div>
  );
};

export const DummyFollowingActivityComponent = () => {
  const { t } = useTranslation();
  const { fetchFollowingActivity, activityEvents, isActivityLoading } =
    useActivityFeedProvider();

  useEffect(() => {
    fetchFollowingActivity({ days: 7, limit: 20 });
  }, [fetchFollowingActivity]);

  if (isActivityLoading) {
    return <p data-testid="following-activity-loading">{t(LOADING_LABEL)}</p>;
  }

  return (
    <div data-testid="following-activity-feed">
      <span data-testid="following-activity-count">
        {activityEvents.length}
      </span>
      {activityEvents.map((activity) => (
        <span data-testid="following-activity-summary" key={activity.id}>
          {activity.summary}
        </span>
      ))}
    </div>
  );
};

/**
 * Drives the widget's filter switch from a test: the three activity fetchers
 * share one sequence counter, so this is how a superseded response is exercised.
 */
export const DummyActivityFilterSwitchComponent = () => {
  const { t } = useTranslation();
  const {
    fetchActivityEvents,
    fetchMyActivityFeed,
    fetchFollowingActivity,
    activityEvents,
  } = useActivityFeedProvider();

  return (
    <div>
      <button
        data-testid="fetch-all"
        onClick={() => fetchActivityEvents({ limit: 20 })}>
        {t('label.all')}
      </button>
      <button
        data-testid="fetch-owner"
        onClick={() => fetchMyActivityFeed({ limit: 20 })}>
        {t('label.my-data')}
      </button>
      <button
        data-testid="fetch-following"
        onClick={() => fetchFollowingActivity({ limit: 20 })}>
        {t('label.following')}
      </button>
      <span data-testid="activity-summaries">
        {activityEvents.map((activity) => activity.summary).join(',')}
      </span>
    </div>
  );
};

export const DummyActivityReactionComponent = () => {
  const { t } = useTranslation();
  const { updateActivityReaction } = useActivityFeedProvider();

  const handleAddReaction = () => {
    updateActivityReaction(
      ACTIVITY_ID,
      ReactionType.ThumbsUp,
      ReactionOperation.ADD
    );
  };

  const handleRemoveReaction = () => {
    updateActivityReaction(
      ACTIVITY_ID,
      ReactionType.ThumbsUp,
      ReactionOperation.REMOVE
    );
  };

  return (
    <div>
      <button data-testid="add-reaction" onClick={handleAddReaction}>
        {t('label.add-reaction')}
      </button>
      <button data-testid="remove-reaction" onClick={handleRemoveReaction}>
        {t('label.remove-reaction')}
      </button>
    </div>
  );
};

export const DummyActivityReactionSyncComponent = () => {
  const { t } = useTranslation();
  const {
    activityEvents,
    selectedActivity,
    setActiveActivity,
    updateActivityReaction,
    fetchMyActivityFeed,
  } = useActivityFeedProvider();

  useEffect(() => {
    fetchMyActivityFeed({ days: 7, limit: 20 });
  }, [fetchMyActivityFeed]);

  return (
    <div>
      <button
        data-testid="select-activity"
        onClick={() => setActiveActivity(activityEvents[0])}>
        {t('label.set-active')}
      </button>
      <button
        data-testid="react"
        onClick={() =>
          updateActivityReaction(
            ACTIVITY_ID,
            ReactionType.ThumbsUp,
            ReactionOperation.ADD
          )
        }>
        {t('label.add-reaction')}
      </button>
      <span data-testid="selected-activity-reactions">
        {selectedActivity?.reactions?.length ?? -1}
      </span>
    </div>
  );
};

export const DummySetActiveActivityComponent = ({
  activity,
}: {
  activity?: ActivityEvent;
}) => {
  const { t } = useTranslation();
  const { setActiveActivity, selectedActivity } = useActivityFeedProvider();

  const handleSetActive = () => {
    setActiveActivity(activity);
  };

  return (
    <div>
      <button data-testid="set-active" onClick={handleSetActive}>
        {t('label.set-active')}
      </button>
      <span data-testid="selected-activity-id">
        {selectedActivity?.id ?? 'none'}
      </span>
    </div>
  );
};
