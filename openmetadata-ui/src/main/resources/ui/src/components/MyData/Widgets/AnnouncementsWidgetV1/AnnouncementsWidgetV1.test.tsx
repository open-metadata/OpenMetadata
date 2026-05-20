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
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AnnouncementEntity } from '../../../../rest/announcementsAPI';
import AnnouncementsWidgetV1 from './AnnouncementsWidgetV1.component';

// Mock React Router hooks
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock utility functions
jest.mock('../../../../utils/FeedUtils', () => ({
  getEntityFQN: jest.fn(
    () => 'sample_data.ecommerce_db.shopify.raw_product_catalog'
  ),
  getEntityType: jest.fn(() => 'table'),
  prepareFeedLink: jest.fn(() => '/test-feed-link'),
}));

jest.mock('../Common/WidgetWrapper/WidgetWrapper', () =>
  jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="widget-wrapper">{children}</div>
    ))
);

jest.mock('./AnnouncementCardV1/AnnouncementCardV1.component', () => {
  return jest.fn().mockImplementation(({ announcement, onClick }) => (
    <div
      data-testid={`announcement-card-v1-${announcement.id}`}
      onClick={onClick}>
      <div>{announcement.createdBy}</div>
      <div>{announcement.displayName ?? announcement.name}</div>
    </div>
  ));
});

const mockOnClose = jest.fn();

const mockAnnouncements: AnnouncementEntity[] = [
  {
    id: '1',
    name: 'announcement-one',
    displayName: 'Alberto updated `dim_address_table`',
    description: 'We will be deprecating a column, please change accordingly.',
    entityLink:
      '<#E::table::sample_data.ecommerce_db.shopify.raw_product_catalog>',
    createdBy: 'alberto',
    updatedAt: 1659610946842,
    startTime: 1659609300000,
    endTime: 1659868500000,
  },
  {
    id: '2',
    name: 'announcement-two',
    displayName: 'Total Data Assets',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vitae congue nullam consectetur Lorem ipsum',
    entityLink:
      '<#E::table::sample_data.ecommerce_db.shopify.raw_product_catalog>',
    createdBy: 'system',
    updatedAt: 1659512958138,
    startTime: 1659512958138,
    endTime: 1659868500000,
  },
];

const widgetProps = {
  onClose: mockOnClose,
  loading: false,
};

describe('AnnouncementsWidgetV1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderAnnouncementsWidgetV1 = (props = {}) => {
    return render(
      <BrowserRouter>
        <AnnouncementsWidgetV1 {...widgetProps} {...props} />
      </BrowserRouter>
    );
  };

  it('should render announcements widget v1 with header elements', () => {
    renderAnnouncementsWidgetV1({ announcements: mockAnnouncements });

    expect(
      screen.getByTestId('announcements-widget-v1-title')
    ).toBeInTheDocument();
    expect(screen.getByTestId('announcement-count-badge')).toBeInTheDocument();
    expect(
      screen.getByTestId('announcements-widget-v1-close')
    ).toBeInTheDocument();
    expect(
      screen.getByText('label.recent-announcement-plural')
    ).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Count badge
  });

  it('should render announcement cards when announcements are provided', () => {
    renderAnnouncementsWidgetV1({ announcements: mockAnnouncements });

    expect(screen.getByTestId('announcement-card-v1-1')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-card-v1-2')).toBeInTheDocument();
    expect(screen.getByText('alberto')).toBeInTheDocument();
    expect(
      screen.getByText('Alberto updated `dim_address_table`')
    ).toBeInTheDocument();
    expect(screen.getByText('Total Data Assets')).toBeInTheDocument();
  });

  it('should render loading state', () => {
    renderAnnouncementsWidgetV1({ loading: true });

    expect(screen.getByTestId('widget-wrapper')).toBeInTheDocument();
  });

  it('should call handleRemoveWidget when close button is clicked', () => {
    renderAnnouncementsWidgetV1({ announcements: mockAnnouncements });

    const closeButton = screen.getByTestId('announcements-widget-v1-close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should display correct announcement content', () => {
    renderAnnouncementsWidgetV1({ announcements: mockAnnouncements });

    // Check first announcement content
    expect(screen.getByText('alberto')).toBeInTheDocument();
    expect(
      screen.getByText('Alberto updated `dim_address_table`')
    ).toBeInTheDocument();

    // Check second announcement content
    expect(screen.getByText('Total Data Assets')).toBeInTheDocument();
  });

  it('should handle announcement card clicks', () => {
    renderAnnouncementsWidgetV1({ announcements: mockAnnouncements });

    const announcementCard = screen.getByTestId('announcement-card-v1-1');
    fireEvent.click(announcementCard);

    // Verify that navigate was called with the correct feed link
    expect(mockNavigate).toHaveBeenCalledWith('/test-feed-link');
  });
});
