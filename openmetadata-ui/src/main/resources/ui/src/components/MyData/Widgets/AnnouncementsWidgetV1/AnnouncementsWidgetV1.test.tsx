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
import { Thread } from '../../../../generated/entity/feed/thread';
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
  getEntityFQN: jest.fn((about) => about.split('::').pop() || ''),
  getEntityType: jest.fn((about) => about.split('::')[1] || ''),
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
      <div>{announcement.message}</div>
    </div>
  ));
});

const mockHandleRemoveWidget = jest.fn();

const mockAnnouncements: Thread[] = [
  {
    id: '1',
    type: 'Announcement',
    href: 'http://localhost:8585/api/v1/feed/1',
    threadTs: 1659609358138,
    about: '<#E::table::sample_data.ecommerce_db.shopify.raw_product_catalog>',
    entityId: 'b9aba5ce-6899-4a09-b378-1e7fcbe596cc',
    createdBy: 'alberto',
    updatedAt: 1659610946842,
    updatedBy: 'anonymous',
    resolved: false,
    message: 'Alberto updated `dim_address_table`',
    postsCount: 0,
    posts: [],
    reactions: [],
    announcement: {
      description:
        'We will be deprecating a column, please change accordingly.',
      startTime: 1659609300000,
      endTime: 1659868500000,
    },
    feedInfo: {
      fieldName: 'PARTNER_NAME',
    },
  } as Thread,
  {
    id: '2',
    type: 'Announcement',
    href: 'http://localhost:8585/api/v1/feed/2',
    threadTs: 1659512958138,
    about: '<#E::table::sample_data.ecommerce_db.shopify.raw_product_catalog>',
    entityId: 'b9aba5ce-6899-4a09-b378-1e7fcbe596cc',
    createdBy: 'system',
    updatedAt: 1659512958138,
    updatedBy: 'system',
    resolved: false,
    message: 'Total Data Assets',
    postsCount: 0,
    posts: [],
    reactions: [],
    announcement: {
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vitae congue nullam consectetur Lorem ipsum',
      startTime: 1659512958138,
      endTime: 1659868500000,
    },
  } as Thread,
];

const widgetProps = {
  isEditView: false,
  widgetKey: 'announcements-widget-v1',
  handleRemoveWidget: mockHandleRemoveWidget,
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

    expect(mockHandleRemoveWidget).toHaveBeenCalledWith(
      'announcements-widget-v1'
    );
  });

  it('should hide widget when close button is clicked without handleRemoveWidget', () => {
    const { container } = renderAnnouncementsWidgetV1({
      announcements: mockAnnouncements,
      handleRemoveWidget: undefined,
    });

    const closeButton = screen.getByTestId('announcements-widget-v1-close');
    fireEvent.click(closeButton);

    expect(container.firstChild).toBeNull();
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
