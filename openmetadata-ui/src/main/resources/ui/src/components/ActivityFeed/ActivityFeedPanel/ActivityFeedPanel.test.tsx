/*
 *  Copyright 2021 Collate
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

import { findByText, queryByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ActivityFeedPanel from './ActivityFeedPanel';

const mockThreadData = {
  id: '35442ff6-ad28-4725-9fa0-3eab9078c3a6',
  href: 'http://localhost:8585/api/v1/feed/35442ff6-ad28-4725-9fa0-3eab9078c3a6',
  threadTs: 1647838571960,
  about: '<#E/table/bigquery_gcp.shopify.raw_product_catalog/description>',
  entityId: 'cb7944d3-f5fe-4289-8672-f8ba6036d551',
  createdBy: 'anonymous',
  updatedAt: 1647852740613,
  updatedBy: 'anonymous',
  resolved: false,
  message:
    'Updated **description** : This is a raw product catalog table contains the product listing, price, seller etc.. represented in our online DB<span class="diff-removed">.</span>',
  postsCount: 2,
  posts: [
    {
      id: '4452fd7c-0e7d-435c-823c-c668de0a2940',
      message: 'reply1',
      postTs: 1647852726255,
      from: 'aaron_johnson0',
    },
    {
      id: '061dfeb2-378c-4078-8b37-0ba3f36beb97',
      message: 'reply2',
      postTs: 1647852740607,
      from: 'aaron_johnson0',
    },
  ],
};

const mockFeedPanelProp = {
  open: true,
  selectedThread: mockThreadData,
  onCancel: jest.fn(),

  postFeed: jest.fn(),
  deletePostHandler: jest.fn(),
};

jest.mock('../../../utils/FeedUtils', () => ({
  getEntityField: jest.fn(),
}));

jest.mock('../ActivityFeedEditor/ActivityFeedEditor', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedEditor</p>);
});

jest.mock('../DeleteConfirmationModal/DeleteConfirmationModal', () => {
  return jest.fn().mockReturnValue(<p>DeleteConfirmationModal</p>);
});

jest.mock('./FeedPanelBody', () => {
  return jest.fn().mockReturnValue(<p>FeedPanelBody</p>);
});

jest.mock('./FeedPanelHeader', () => {
  return jest.fn().mockReturnValue(<p>FeedPanelHeader</p>);
});
jest.mock('./FeedPanelOverlay', () => {
  return jest.fn().mockReturnValue(<p>FeedPanelOverlay</p>);
});

describe('Test FeedPanel Component', () => {
  it('Check if Feedpanel has all child elements', async () => {
    const { container } = render(<ActivityFeedPanel {...mockFeedPanelProp} />, {
      wrapper: MemoryRouter,
    });

    const FeedPanelOverlay = await findByText(container, /FeedPanelOverlay/i);
    const FeedPanelHeader = await findByText(container, /FeedPanelHeader/i);
    const FeedPanelBody = await findByText(container, /FeedPanelBody/i);
    const FeedPanelEditor = await findByText(container, /ActivityFeedEditor/i);
    const deleteConfirmationModal = queryByText(
      container,
      /DeleteConfirmationModal/i
    );

    expect(FeedPanelOverlay).toBeInTheDocument();
    expect(FeedPanelHeader).toBeInTheDocument();
    expect(FeedPanelBody).toBeInTheDocument();
    expect(FeedPanelEditor).toBeInTheDocument();
    expect(deleteConfirmationModal).not.toBeInTheDocument();
  });
});
