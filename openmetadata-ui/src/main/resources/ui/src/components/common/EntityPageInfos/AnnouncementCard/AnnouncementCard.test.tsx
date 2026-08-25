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
import { AnnouncementEntity } from '../../../../rest/announcementsAPI';
import AnnouncementCard from './AnnouncementCard';

const mockOnClick = jest.fn();
const mockAnnouncement = {
  id: '92d08ecb-129f-4b39-b2af-10b7663f8d29',
  name: 'deprecation-announcement',
  displayName:
    'This table will be deleted in 10 days, please store the necessary data.',
  description:
    'As this table is no longer maintained, we will be removing this table from our metadata store',
  entityLink:
    '<#E::table::sample_data.ecommerce_db.shopify.raw_product_catalog>',
  createdBy: 'aaron_johnson0',
  updatedAt: 1659610946842,
  updatedBy: 'anonymous',
  startTime: 1659609300000,
  endTime: 1659868500000,
} as AnnouncementEntity;

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
