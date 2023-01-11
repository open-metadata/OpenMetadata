/*
 *  Copyright 2022 Collate.
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

import { findAllByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import FeedListBody from './FeedListBody';

jest.mock('../ActivityFeedCard/ActivityFeedCard', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedCard</p>);
});

jest.mock('../ActivityFeedEditor/ActivityFeedEditor', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedEditor</p>);
});

jest.mock('../ActivityFeedCard/FeedCardFooter/FeedCardFooter', () => {
  return jest.fn().mockReturnValue(<p>FeedCardFooter</p>);
});

const mockThreads = [
  {
    id: '465b2dfb-300e-45f5-a1a6-e19c6225e9e7',
    href: 'http://localhost:8585/api/v1/feed/465b2dfb-300e-45f5-a1a6-e19c6225e9e7',
    threadTs: 1647434125848,
    about: '<#E::table::bigquery_gcp.shopify.raw_product_catalog::description>',
    entityId: 'f1ebcfdf-d4b8-43bd-add2-1789e25ddde3',
    createdBy: 'aaron_johnson0',
    updatedAt: 1647434125848,
    updatedBy: 'anonymous',
    resolved: false,
    message: 'New thread.',
    postsCount: 0,
    posts: [],
    relativeDay: 'Today',
  },
  {
    id: '40c2faec-0159-4d86-9b15-c17f3e1c081b',
    href: 'http://localhost:8585/api/v1/feed/40c2faec-0159-4d86-9b15-c17f3e1c081b',
    threadTs: 1647411418056,
    about: '<#E::table::bigquery_gcp.shopify.raw_product_catalog::description>',
    entityId: 'f1ebcfdf-d4b8-43bd-add2-1789e25ddde3',
    createdBy: 'sachin.c',
    updatedAt: 1647434031435,
    updatedBy: 'anonymous',
    resolved: false,
    message: 'New thread.',
    postsCount: 3,
    posts: [
      {
        id: 'afc5648f-9f30-4588-bd26-319c66af7c46',
        message: 'reply2',
        postTs: 1647434021493,
        from: 'aaron_johnson0',
      },
      {
        id: '8ec9283f-a671-48d6-8328-f537dadd9fc7',
        message: 'reply3',
        postTs: 1647434025868,
        from: 'aaron_johnson0',
      },
      {
        id: 'a8559fd6-940c-4f14-9808-6c376b6f872c',
        message: 'reply4',
        postTs: 1647434031430,
        from: 'aaron_johnson0',
      },
    ],
    relativeDay: 'Today',
  },
];

const onThreadIdSelect = jest.fn();

const mockFeedListBodyProp = {
  updatedFeedList: mockThreads,
  relativeDay: 'Today',
  isEntityFeed: false,
  onThreadSelect: jest.fn(),
  onThreadIdSelect,
  postFeed: jest.fn(),
  onViewMore: jest.fn(),
  selectedThreadId: '',
  onConfirmation: jest.fn(),
  onThreadIdDeselect: jest.fn(),
  updateThreadHandler: jest.fn(),
};

describe('Test FeedListBody Component', () => {
  it('Check if FeedListBody has all the child elements', async () => {
    const { container } = render(<FeedListBody {...mockFeedListBodyProp} />, {
      wrapper: MemoryRouter,
    });

    const messages = await findAllByTestId(container, 'message-container');

    expect(messages).toHaveLength(2);
  });
});
