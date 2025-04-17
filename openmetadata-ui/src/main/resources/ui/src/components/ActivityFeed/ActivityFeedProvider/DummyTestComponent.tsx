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
import {
  ThreadTaskStatus,
  ThreadType,
} from '../../../generated/entity/feed/thread';
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
      ThreadTaskStatus.Open
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
      ThreadTaskStatus.Closed
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
      ThreadTaskStatus.Open
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
