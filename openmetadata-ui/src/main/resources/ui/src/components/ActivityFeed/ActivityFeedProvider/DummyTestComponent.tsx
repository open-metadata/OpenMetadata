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
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import { ReactionOperation } from '../../../enums/reactions.enum';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { ReactionType } from '../../../generated/type/reaction';
import { useActivityFeedProvider } from './ActivityFeedProvider';

export const DummyChildrenComponent = () => {
  const { t } = useTranslation();
  const { postFeed, getFeedData, deleteFeed, loading } =
    useActivityFeedProvider();
  const handlePostFeed = () => {
    postFeed('New Post Feed added', '123');
  };

  const handleDeleteFeed = () => {
    deleteFeed('123', '456', true);
  };

  useEffect(() => {
    getFeedData(
      FeedFilter.OWNER_OR_FOLLOWS,
      undefined,
      ThreadType.Task,
      EntityType.USER,
      'admin',
      'open'
    );
  }, []);

  if (loading) {
    return <p data-testid="loading">{t('label.loading')}</p>;
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
  const { getFeedData } = useActivityFeedProvider();

  useEffect(() => {
    getFeedData(
      FeedFilter.OWNER_OR_FOLLOWS,
      'after-234',
      ThreadType.Task,
      EntityType.USER,
      'admin',
      'closed'
    );
  }, []);

  return <p>{t('label.children')}</p>;
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
      'open'
    );
  }, []);

  return <p>{t('label.children')}</p>;
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
  }, []);

  if (isActivityLoading) {
    return <p data-testid="activity-loading">{t('label.loading')}</p>;
  }

  return (
    <div data-testid="activity-feed">
      <span data-testid="activity-count">{activityEvents.length}</span>
    </div>
  );
};

export const DummyActivityReactionComponent = () => {
  const { t } = useTranslation();
  const { updateActivityReaction } = useActivityFeedProvider();

  const handleAddReaction = () => {
    updateActivityReaction(
      'activity-123',
      ReactionType.ThumbsUp,
      ReactionOperation.ADD
    );
  };

  const handleRemoveReaction = () => {
    updateActivityReaction(
      'activity-123',
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

export const DummyActivityCommentComponent = ({
  activity,
}: {
  activity: ActivityEvent;
}) => {
  const { t } = useTranslation();
  const { postActivityComment, activityThread } = useActivityFeedProvider();

  const handlePostComment = () => {
    postActivityComment('Test comment', activity);
  };

  return (
    <div>
      <button data-testid="post-comment" onClick={handlePostComment}>
        {t('label.post-comment')}
      </button>
      <span data-testid="thread-id">{activityThread?.id ?? 'no-thread'}</span>
    </div>
  );
};

export const DummySetActiveActivityComponent = ({
  activity,
}: {
  activity?: ActivityEvent;
}) => {
  const { t } = useTranslation();
  const { setActiveActivity, selectedActivity, activityThread } =
    useActivityFeedProvider();

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
      <span data-testid="activity-thread-id">
        {activityThread?.id ?? 'no-thread'}
      </span>
    </div>
  );
};
