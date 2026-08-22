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

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  Conversation,
  ConversationSource,
} from '../../../generated/entity/feed/conversation';
import ActivityFeedCardNew from './ActivityFeedcardNew.component';

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: { id: 'author-id', name: 'alice' },
  }),
}));

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => [false, undefined, { id: 'author-id', name: 'alice' }],
}));

jest.mock('../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: () => ({
    activityReplies: [],
    isPostsLoading: false,
    postActivityComment: jest.fn(),
    postFeed: jest.fn(),
    selectedThread: undefined,
    updateFeed: jest.fn(),
  }),
}));

jest.mock('../ActivityFeedCard/FeedCardBody/FeedCardBodyNew', () =>
  jest.fn(({ message }) => <div data-testid="feed-body">{message}</div>)
);

jest.mock('../ActivityFeedCardV2/FeedCardFooter/FeedCardFooterNew', () =>
  jest.fn(() => <div data-testid="conversation-reaction-footer" />)
);

jest.mock('../ActivityFeedCardV2/FeedCardFooter/ActivityEventFooter', () =>
  jest.fn(() => <div data-testid="activity-footer" />)
);

jest.mock('../Shared/ActivityFeedActions', () =>
  jest.fn(() => <div data-testid="conversation-root-actions" />)
);

jest.mock('../../common/PopOverCard/EntityPopOverCard', () =>
  jest.fn(({ children }) => <>{children}</>)
);

jest.mock('../../common/PopOverCard/UserPopOverCard', () =>
  jest.fn(({ children }) => <>{children}</>)
);

jest.mock('../../common/ProfilePicture/ProfilePicture', () =>
  jest.fn(() => <div data-testid="profile-picture" />)
);

jest.mock('../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: { getEntityIcon: jest.fn() },
}));

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: { getEntityLink: () => '/table/service.table' },
}));

const conversation: Conversation = {
  id: 'conversation-1',
  about: '<#E::table::service.table>',
  createdAt: 1,
  createdBy: { id: 'author-id', type: 'user', name: 'alice' },
  entityRef: {
    id: 'table-id',
    type: 'table',
    name: 'table',
    fullyQualifiedName: 'service.table',
  },
  message: 'Root message',
  replyCount: 0,
  resolved: false,
  source: ConversationSource.User,
  updatedAt: 1,
};

describe('ActivityFeedCardNew', () => {
  it('keeps root reactions and management actions available in the drawer', () => {
    render(
      <MemoryRouter>
        <ActivityFeedCardNew isOpenInDrawer showThread feed={conversation} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('conversation-reaction-footer')).toBeVisible();
    expect(screen.queryByTestId('conversation-root-actions')).toBeNull();

    fireEvent.mouseEnter(screen.getByTestId('feed-card-v2-sidebar'));

    expect(screen.getByTestId('conversation-root-actions')).toBeVisible();
  });
});
