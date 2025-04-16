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

import { fireEvent, render, screen } from '@testing-library/react';
import { Thread } from '../../../../generated/entity/feed/thread';
import AnnouncementCard from './AnnouncementCard';

const mockOnClick = jest.fn();
const mockAnnouncement = {
  id: '92d08ecb-129f-4b39-b2af-10b7663f8d29',
  type: 'Announcement',
  href: 'http://localhost:8585/api/v1/feed/92d08ecb-129f-4b39-b2af-10b7663f8d29',
  threadTs: 1659609358138,
  about: '<#E::table::sample_data.ecommerce_db.shopify.raw_product_catalog>',
  entityId: 'b9aba5ce-6899-4a09-b378-1e7fcbe596cc',
  createdBy: 'aaron_johnson0',
  updatedAt: 1659610946842,
  updatedBy: 'anonymous',
  resolved: false,
  message:
    'This table will be deleted in 10 days, please store the necessary data.',
  postsCount: 0,
  posts: [],
  reactions: [],
  announcement: {
    description:
      'As this table is no longer maintained, we will be removing this table from our metadata store',
    startTime: 1659609300000,
    endTime: 1659868500000,
  },
} as Thread;

describe('Test Announcement card component', () => {
  it('should render the compnent', async () => {
    render(
      <AnnouncementCard announcement={mockAnnouncement} onClick={mockOnClick} />
    );

    const card = await screen.findByTestId('announcement-card');

    expect(card).toBeInTheDocument();
  });

  it('Click should call onClick function', async () => {
    render(
      <AnnouncementCard announcement={mockAnnouncement} onClick={mockOnClick} />
    );

    const card = await screen.findByTestId('announcement-card');

    fireEvent.click(card);

    expect(mockOnClick).toHaveBeenCalled();

    expect(mockOnClick).toHaveBeenCalled();
  });
});
