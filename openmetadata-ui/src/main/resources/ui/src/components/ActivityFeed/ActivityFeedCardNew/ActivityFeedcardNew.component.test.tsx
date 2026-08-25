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
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import { Thread } from '../../../generated/entity/feed/thread';
import ActivityFeedCardNew from './ActivityFeedcardNew.component';

jest.mock('../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: () => ({
    selectedThread: undefined,
    postFeed: jest.fn(),
    updateFeed: jest.fn(),
    isPostsLoading: false,
  }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { name: 'admin' } }),
}));

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => [undefined, false, undefined],
}));

// Render-heavy children are irrelevant to the read-only gate under test.
jest.mock('../ActivityFeedCard/FeedCardBody/FeedCardBodyNew', () => () => (
  <div data-testid="feed-body" />
));
jest.mock(
  '../ActivityFeedCardV2/FeedCardFooter/FeedCardFooterNew',
  () => () => <div data-testid="feed-footer" />
);
jest.mock(
  '../ActivityFeedCardV2/FeedCardFooter/ActivityEventFooter',
  () => () => <div data-testid="activity-footer" />
);
jest.mock('./CommentCard.component', () => () => <div data-testid="comment" />);
jest.mock('../../common/PopOverCard/EntityPopOverCard', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
jest.mock('../../common/PopOverCard/UserPopOverCard', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
jest.mock('../../common/ProfilePicture/ProfilePicture', () => () => (
  <div data-testid="pfp" />
));

const feed = {
  id: 'thread-1',
  message: 'hello convo',
  about: '<#E::table::db.s.t>',
  threadTs: 100,
  posts: [],
  createdBy: 'admin',
} as Thread;

const activity = {
  id: 'activity-1',
  about: '<#E::table::db.s.t>',
  timestamp: 100,
  eventType: 'entityCreated' as ActivityEvent['eventType'],
  entity: { id: 'e1', type: 'table', name: 't' },
  actor: { id: 'u1', type: 'user', name: 'admin' },
  summary: 'Created table',
} as ActivityEvent;

const renderCard = (props: Record<string, unknown>) =>
  render(
    <MemoryRouter>
      <ActivityFeedCardNew showThread {...props} />
    </MemoryRouter>
  );

describe('ActivityFeedCardNew — activities are read-only', () => {
  it('renders the comment editor for a conversation feed', () => {
    renderCard({ feed });

    expect(screen.getByTestId('comments-input-field')).toBeInTheDocument();
  });

  it('does NOT render the comment editor for a change-event activity', () => {
    renderCard({ activity });

    expect(
      screen.queryByTestId('comments-input-field')
    ).not.toBeInTheDocument();
    // The activity change-detail footer still renders.
    expect(screen.getByTestId('activity-footer')).toBeInTheDocument();
  });
});
