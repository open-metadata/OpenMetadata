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

import { findByTestId, queryByTestId, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThreadType } from '../../../generated/entity/feed/thread';
import FeedPanelHeader from './FeedPanelHeader';

const mockFeedPanelHeaderProp = {
  onCancel: jest.fn(),
  noun: 'Conversations',
  onShowNewConversation: jest.fn(),
  entityLink:
    '<#E::table::sample_data.ecommerce_db.shopify.dim_address::description>',
};

describe('Test FeedPanelHeader Component', () => {
  it('Check if FeedPanelHeader has all child elements', async () => {
    const { container } = render(
      <FeedPanelHeader {...mockFeedPanelHeaderProp} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const title = await findByTestId(container, 'header-title');
    const noun = await findByTestId(container, 'header-noun');
    const newConversationButton = await findByTestId(
      container,
      'add-new-conversation'
    );

    const drawerCloseButton = await findByTestId(container, 'closeDrawer');

    expect(title).toBeInTheDocument();
    expect(noun).toHaveTextContent('Conversations label.on-lowercase');
    expect(newConversationButton).toBeInTheDocument();
    expect(drawerCloseButton).toBeInTheDocument();
  });

  it('Check if FeedPanelHeader has onShowNewConversation as undefined', async () => {
    const { container } = render(
      <FeedPanelHeader
        {...mockFeedPanelHeaderProp}
        onShowNewConversation={undefined}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const newConversationButton = queryByTestId(
      container,
      'add-new-conversation'
    );

    // onShowNewConversation is undefined so add-new-conversation should not be in the document
    expect(newConversationButton).not.toBeInTheDocument();
  });

  it('Check if FeedPanelHeader has noun as undefined', async () => {
    const { container } = render(
      <FeedPanelHeader {...mockFeedPanelHeaderProp} noun={undefined} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const noun = await findByTestId(container, 'header-noun');

    // noun is undefined so default noun should be present in text content
    expect(noun).toHaveTextContent('label.conversation label.on-lowercase');
  });

  it('Should render entityFQN if entityField is empty', async () => {
    const { container } = render(
      <FeedPanelHeader
        {...mockFeedPanelHeaderProp}
        entityLink="<#E::testCase::sample_data.ecommerce_db.shopify.dim_address.address_id.unique_column_test>"
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const entityAttribute = await findByTestId(container, 'entity-attribute');

    expect(entityAttribute).toHaveTextContent('unique_column_test');
  });

  it('Should render noun according to the thread type', async () => {
    const { container } = render(
      <FeedPanelHeader
        {...mockFeedPanelHeaderProp}
        noun={undefined}
        threadType={ThreadType.Announcement}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const noun = await findByTestId(container, 'header-noun');

    expect(noun).toHaveTextContent(/Announcement label.on-lowercase/i);
  });
});
