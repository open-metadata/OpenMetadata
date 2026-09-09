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

import { render, screen, waitFor } from '@testing-library/react';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import { Conversation } from '../../../generated/entity/feed/conversation';
import ActivityFeedListV1New from './ActivityFeedListV1New.component';

jest.mock('../ActivityFeedPanel/FeedPanelBodyV1New', () =>
  jest.fn(
    ({
      activity,
      feed,
      isActive,
    }: {
      activity?: ActivityEvent;
      feed?: Conversation;
      isActive?: boolean;
    }) => {
      const item = activity ?? feed;

      return (
        <div
          data-active={String(isActive)}
          data-kind={activity ? 'activity' : 'conversation'}
          data-testid={`feed-item-${item?.id}`}
        />
      );
    }
  )
);

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew', () =>
  jest.fn(() => <div data-testid="empty-feed" />)
);

jest.mock('../../common/Loader/Loader', () =>
  jest.fn(() => <div data-testid="feed-loader" />)
);

const createActivity = (id: string, timestamp: number) =>
  ({
    id,
    timestamp,
    about: `<#E::table::${id}>`,
  } as ActivityEvent);

const createConversation = (id: string, updatedAt: number) =>
  ({
    id,
    updatedAt,
    about: `<#E::table::${id}>`,
  } as Conversation);

describe('ActivityFeedListV1New', () => {
  it('renders activities and conversations together in timestamp order', () => {
    render(
      <ActivityFeedListV1New
        activityList={[
          createActivity('old-activity', 100),
          createActivity('new-activity', 300),
        ]}
        emptyPlaceholderText="No activity"
        feedList={[createConversation('middle-conversation', 200)]}
        hidePopover={false}
        isLoading={false}
      />
    );

    expect(
      screen
        .getAllByTestId(/^feed-item-/)
        .map((item) => item.getAttribute('data-testid'))
    ).toEqual([
      'feed-item-new-activity',
      'feed-item-middle-conversation',
      'feed-item-old-activity',
    ]);
  });

  it('selects the newest item using the matching source callback', async () => {
    const onActivityClick = jest.fn();
    const onFeedClick = jest.fn();
    const newestConversation = createConversation('new-conversation', 400);

    render(
      <ActivityFeedListV1New
        activityList={[createActivity('activity', 300)]}
        emptyPlaceholderText="No activity"
        feedList={[newestConversation]}
        hidePopover={false}
        isLoading={false}
        onActivityClick={onActivityClick}
        onFeedClick={onFeedClick}
      />
    );

    await waitFor(() =>
      expect(onFeedClick).toHaveBeenCalledWith(newestConversation)
    );

    expect(onActivityClick).not.toHaveBeenCalled();
  });

  it('does not auto-select an activity in the landing-page widget', async () => {
    const onActivityClick = jest.fn();

    render(
      <ActivityFeedListV1New
        isFeedWidget
        activityList={[createActivity('activity', 300)]}
        emptyPlaceholderText="No activity"
        hidePopover={false}
        isLoading={false}
        onActivityClick={onActivityClick}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('feed-item-activity')).toBeInTheDocument()
    );

    expect(onActivityClick).not.toHaveBeenCalled();
  });

  it('does not replace a selected item that remains in the mixed feed', async () => {
    const onActivityClick = jest.fn();
    const onFeedClick = jest.fn();
    const selectedConversation = createConversation('conversation', 200);

    render(
      <ActivityFeedListV1New
        activityList={[createActivity('activity', 300)]}
        emptyPlaceholderText="No activity"
        feedList={[selectedConversation]}
        hidePopover={false}
        isLoading={false}
        selectedThread={selectedConversation}
        onActivityClick={onActivityClick}
        onFeedClick={onFeedClick}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('feed-item-conversation')).toBeInTheDocument()
    );

    expect(onActivityClick).not.toHaveBeenCalled();
    expect(onFeedClick).not.toHaveBeenCalled();
  });

  it('selects a newer activity after the conversations load first', async () => {
    const onActivityClick = jest.fn();
    const onFeedClick = jest.fn();
    const conversation = createConversation('conversation', 200);
    const { rerender } = render(
      <ActivityFeedListV1New
        activityList={[]}
        emptyPlaceholderText="No activity"
        feedList={[conversation]}
        hidePopover={false}
        isLoading={false}
        onActivityClick={onActivityClick}
        onFeedClick={onFeedClick}
      />
    );

    await waitFor(() => expect(onFeedClick).toHaveBeenCalledWith(conversation));

    const activity = createActivity('activity', 300);
    rerender(
      <ActivityFeedListV1New
        activityList={[activity]}
        emptyPlaceholderText="No activity"
        feedList={[conversation]}
        hidePopover={false}
        isLoading={false}
        selectedThread={conversation}
        onActivityClick={onActivityClick}
        onFeedClick={onFeedClick}
      />
    );

    await waitFor(() => expect(onActivityClick).toHaveBeenCalledWith(activity));
  });
});
