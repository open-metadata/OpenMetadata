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

import {
  findAllByText,
  findByTestId,
  findByText,
  queryByTestId,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import FeedPanelBody from './FeedPanelBody';

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

const mockFeedPanelBodyProp = {
  threadData: mockThreadData,
  isLoading: false,
  onConfirmation: jest.fn(),
};

jest.mock('../ActivityFeedCard/ActivityFeedCard', () => {
  return jest.fn().mockReturnValue(<p>FeedCard</p>);
});

jest.mock('../../Loader/Loader', () => {
  return jest.fn().mockReturnValue(<p>Loader</p>);
});

describe('Test FeedPanelBody Component', () => {
  it('Check if FeedPanelBody has all child elements', async () => {
    const { container } = render(<FeedPanelBody {...mockFeedPanelBodyProp} />, {
      wrapper: MemoryRouter,
    });

    const mainMessage = await findByTestId(container, 'main-message');
    const repliesContainer = await findByTestId(container, 'replies');

    expect(mainMessage).toBeInTheDocument();
    expect(repliesContainer).toBeInTheDocument();
  });

  it('Check if FeedPanelBody has proper reply count', async () => {
    const { container } = render(<FeedPanelBody {...mockFeedPanelBodyProp} />, {
      wrapper: MemoryRouter,
    });

    const repliesContainer = await findByTestId(container, 'replies');
    const replies = await findAllByText(repliesContainer, /FeedCard/i);
    const repliesCount = await findByTestId(repliesContainer, 'replies-count');

    expect(repliesContainer).toBeInTheDocument();
    expect(replies).toHaveLength(2);
    expect(repliesCount).toHaveTextContent('2 replies');
  });

  it('Check if FeedPanelBody has isLoading as true', async () => {
    const { container } = render(
      <FeedPanelBody {...mockFeedPanelBodyProp} isLoading />,
      {
        wrapper: MemoryRouter,
      }
    );

    const panelBody = queryByTestId(container, 'panel-body');
    const loader = await findByText(container, /Loader/i);

    expect(panelBody).not.toBeInTheDocument();
    expect(loader).toBeInTheDocument();
  });

  it('Check if FeedPanelBody has 0 posts', async () => {
    const { container } = render(
      <FeedPanelBody
        {...mockFeedPanelBodyProp}
        threadData={{ ...mockThreadData, postsCount: 0, posts: [] }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const mainMessage = await findByTestId(container, 'main-message');
    const repliesContainer = queryByTestId(container, 'replies');

    expect(mainMessage).toBeInTheDocument();
    expect(repliesContainer).not.toBeInTheDocument();
  });
});
