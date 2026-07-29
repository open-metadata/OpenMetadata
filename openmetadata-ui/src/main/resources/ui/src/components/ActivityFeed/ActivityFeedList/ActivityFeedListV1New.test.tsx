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

import { render, screen } from '@testing-library/react';
import {
  ActivityEvent,
  ActivityEventType,
} from '../../../generated/entity/activity/activityEvent';
import { GeneratedBy, Thread } from '../../../generated/entity/feed/thread';
import ActivityFeedListV1New from './ActivityFeedListV1New.component';

jest.mock('../ActivityFeedPanel/FeedPanelBodyV1New', () =>
  jest
    .fn()
    .mockImplementation(({ feed, activity }) => (
      <div data-testid={`card-${feed?.id ?? activity?.id}`} />
    ))
);

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew', () =>
  jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="error-placeholder">{children}</div>
    ))
);

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader" />)
);

const buildActivity = (id: string, timestamp: number): ActivityEvent => ({
  id,
  timestamp,
  eventType: ActivityEventType.DescriptionUpdated,
  entity: { id: 'entity-id', type: 'table' },
});

const buildThread = (
  id: string,
  updatedAt: number,
  generatedBy = GeneratedBy.User
): Thread =>
  ({
    id,
    updatedAt,
    threadTs: updatedAt - 1000,
    generatedBy,
    about: '<#E::table::sample.table>',
    message: `message for ${id}`,
  } as Thread);

const renderList = (props: Record<string, unknown> = {}) =>
  render(
    <ActivityFeedListV1New
      emptyPlaceholderText="No activity"
      hidePopover={false}
      isLoading={false}
      {...props}
    />
  );

describe('ActivityFeedListV1New', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render activity events and user conversations together', () => {
    renderList({
      activityList: [buildActivity('activity-1', 3000)],
      feedList: [buildThread('thread-1', 2000)],
    });

    expect(screen.getByTestId('card-activity-1')).toBeInTheDocument();
    expect(screen.getByTestId('card-thread-1')).toBeInTheDocument();
  });

  it('should not render system generated threads duplicated into the activity stream', () => {
    renderList({
      activityList: [buildActivity('activity-1', 3000)],
      feedList: [
        buildThread('thread-1', 2000),
        buildThread('system-thread-1', 2500, GeneratedBy.System),
      ],
    });

    expect(screen.getByTestId('card-thread-1')).toBeInTheDocument();
    expect(screen.queryByTestId('card-system-thread-1')).toBeNull();
  });

  it('should order both sources by descending timestamp', () => {
    renderList({
      activityList: [buildActivity('activity-old', 1000)],
      feedList: [
        buildThread('thread-new', 5000),
        buildThread('thread-old', 500),
      ],
    });

    const renderedIds = screen
      .getAllByTestId(/^card-/)
      .map((node) => node.getAttribute('data-testid'));

    expect(renderedIds).toEqual([
      'card-thread-new',
      'card-activity-old',
      'card-thread-old',
    ]);
  });

  it('should show the empty placeholder when only system threads are available', () => {
    renderList({
      activityList: [],
      feedList: [buildThread('system-thread-1', 2500, GeneratedBy.System)],
    });

    expect(
      screen.getByTestId('no-data-placeholder-container')
    ).toBeInTheDocument();
  });

  it('should auto select the newest item when it is a conversation', () => {
    const onFeedClick = jest.fn();
    const onActivityClick = jest.fn();

    renderList({
      activityList: [buildActivity('activity-1', 1000)],
      feedList: [buildThread('thread-1', 5000)],
      onActivityClick,
      onFeedClick,
    });

    expect(onFeedClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'thread-1' })
    );
    expect(onActivityClick).not.toHaveBeenCalled();
  });

  it('should auto select the newest item when it is an activity event', () => {
    const onFeedClick = jest.fn();
    const onActivityClick = jest.fn();

    renderList({
      activityList: [buildActivity('activity-1', 5000)],
      feedList: [buildThread('thread-1', 1000)],
      onActivityClick,
      onFeedClick,
    });

    expect(onActivityClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'activity-1' })
    );
    expect(onFeedClick).not.toHaveBeenCalled();
  });

  it('should keep a selected conversation instead of falling back to the first activity', () => {
    const onFeedClick = jest.fn();
    const onActivityClick = jest.fn();
    const selectedThread = buildThread('thread-1', 1000);

    renderList({
      activityList: [
        buildActivity('activity-1', 5000),
        buildActivity('activity-2', 4000),
      ],
      feedList: [selectedThread],
      onActivityClick,
      onFeedClick,
      selectedThread,
    });

    expect(onActivityClick).not.toHaveBeenCalled();
    expect(onFeedClick).not.toHaveBeenCalled();
  });

  it('should not auto select while the sources are still loading', () => {
    const onActivityClick = jest.fn();

    renderList({
      activityList: [buildActivity('activity-1', 5000)],
      isLoading: true,
      onActivityClick,
    });

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(onActivityClick).not.toHaveBeenCalled();
  });
});
