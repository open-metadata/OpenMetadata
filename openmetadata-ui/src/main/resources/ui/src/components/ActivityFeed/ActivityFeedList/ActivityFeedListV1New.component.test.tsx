/*
 *  Copyright 2025 Collate.
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
import { render, screen } from '@testing-library/react';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import { Thread } from '../../../generated/entity/feed/thread';
import ActivityFeedListV1New from './ActivityFeedListV1New.component';

jest.mock('../ActivityFeedPanel/FeedPanelBodyV1New', () => ({
  __esModule: true,
  default: ({ feed, activity }: { feed?: Thread; activity?: ActivityEvent }) =>
    activity ? (
      <div data-testid={`activity-${activity.id}`}>activity</div>
    ) : (
      <div data-testid={`feed-${feed?.id}`}>feed</div>
    ),
}));

jest.mock('../../common/Loader/Loader', () => () => <div>Loader</div>);

const feedList = [
  { id: 'feed-old', updatedAt: 100 },
  { id: 'feed-new', updatedAt: 400 },
] as Thread[];

const activityList = [{ id: 'activity-mid', timestamp: 200 } as ActivityEvent];

const baseProps = {
  isLoading: false,
  hidePopover: false,
  emptyPlaceholderText: 'No data',
};

describe('ActivityFeedListV1New — merged activity + conversations', () => {
  it('renders BOTH activity events and conversation threads in one list', () => {
    render(
      <ActivityFeedListV1New
        {...baseProps}
        activityList={activityList}
        feedList={feedList}
      />
    );

    expect(screen.getByTestId('feed-feed-new')).toBeInTheDocument();
    expect(screen.getByTestId('feed-feed-old')).toBeInTheDocument();
    expect(screen.getByTestId('activity-activity-mid')).toBeInTheDocument();
  });

  it('orders the merged list by timestamp, newest first', () => {
    render(
      <ActivityFeedListV1New
        {...baseProps}
        activityList={activityList}
        feedList={feedList}
      />
    );

    const rendered = screen
      .getAllByTestId(/^(feed|activity)-/)
      .map((el) => el.getAttribute('data-testid'));

    // feed-new (400) > activity-mid (200) > feed-old (100)
    expect(rendered).toEqual([
      'feed-feed-new',
      'activity-activity-mid',
      'feed-feed-old',
    ]);
  });

  it('renders conversations even when there are no activity events', () => {
    render(<ActivityFeedListV1New {...baseProps} feedList={feedList} />);

    expect(screen.getByTestId('feed-feed-new')).toBeInTheDocument();
    expect(screen.getByTestId('feed-feed-old')).toBeInTheDocument();
  });

  it('renders activity events even when there are no conversations', () => {
    render(
      <ActivityFeedListV1New {...baseProps} activityList={activityList} />
    );

    expect(screen.getByTestId('activity-activity-mid')).toBeInTheDocument();
  });

  it('shows the empty placeholder when both lists are empty', () => {
    render(
      <ActivityFeedListV1New {...baseProps} activityList={[]} feedList={[]} />
    );

    expect(
      screen.getByTestId('no-data-placeholder-container')
    ).toBeInTheDocument();
  });

  describe('auto-select first item', () => {
    it('auto-selects the first item (newest) when nothing is selected', () => {
      const onFeedClick = jest.fn();
      const onActivityClick = jest.fn();

      render(
        <ActivityFeedListV1New
          {...baseProps}
          activityList={activityList}
          feedList={feedList}
          onActivityClick={onActivityClick}
          onFeedClick={onFeedClick}
        />
      );

      // feed-new (400) is newest → auto-selected as a feed.
      expect(onFeedClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'feed-new' })
      );
      expect(onActivityClick).not.toHaveBeenCalled();
    });

    it('does NOT snap back to the first item when an activity is selected', () => {
      const onFeedClick = jest.fn();
      const onActivityClick = jest.fn();

      render(
        <ActivityFeedListV1New
          {...baseProps}
          activityList={activityList}
          feedList={feedList}
          selectedActivity={{ id: 'activity-mid' } as ActivityEvent}
          onActivityClick={onActivityClick}
          onFeedClick={onFeedClick}
        />
      );

      // A valid activity selection must be respected — no forced re-select.
      expect(onFeedClick).not.toHaveBeenCalled();
      expect(onActivityClick).not.toHaveBeenCalled();
    });

    it('moves the auto-selection to the newest item when a later source resolves', () => {
      const onFeedClick = jest.fn();
      const onActivityClick = jest.fn();

      // First render: only the older conversation has resolved.
      const { rerender } = render(
        <ActivityFeedListV1New
          {...baseProps}
          feedList={[{ id: 'feed-old', updatedAt: 100 } as Thread]}
          onActivityClick={onActivityClick}
          onFeedClick={onFeedClick}
        />
      );

      expect(onFeedClick).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 'feed-old' })
      );

      // A newer activity resolves afterwards; the parent still has feed-old
      // selected from the auto-pick above. The selection must move to the
      // newest item (deterministic regardless of resolution order).
      rerender(
        <ActivityFeedListV1New
          {...baseProps}
          activityList={[
            { id: 'activity-new', timestamp: 999 } as ActivityEvent,
          ]}
          feedList={[{ id: 'feed-old', updatedAt: 100 } as Thread]}
          selectedThread={{ id: 'feed-old' } as Thread}
          onActivityClick={onActivityClick}
          onFeedClick={onFeedClick}
        />
      );

      expect(onActivityClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'activity-new' })
      );
    });

    it('does NOT override an existing thread selection', () => {
      const onFeedClick = jest.fn();
      const onActivityClick = jest.fn();

      render(
        <ActivityFeedListV1New
          {...baseProps}
          activityList={activityList}
          feedList={feedList}
          selectedThread={{ id: 'feed-old' } as Thread}
          onActivityClick={onActivityClick}
          onFeedClick={onFeedClick}
        />
      );

      expect(onFeedClick).not.toHaveBeenCalled();
      expect(onActivityClick).not.toHaveBeenCalled();
    });
  });
});
