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
import {
  FieldOperation,
  Thread,
} from '../../../../../generated/entity/feed/thread';
import AnnouncementCardV1 from './AnnouncementCardV1.component';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock utility functions
jest.mock('../../../../../utils/date-time/DateTimeUtils', () => ({
  getRelativeTime: jest.fn(() => '2022-08-03'),
}));

jest.mock('../../../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: jest.fn(() => '/test-announcement-entity-link'),
  },
}));

jest.mock('../../../../../utils/FeedUtils', () => ({
  getEntityFQN: jest.fn((about) => about.split('::').pop() || ''),
  getEntityType: jest.fn((about) => about.split('::')[1] || ''),
}));

jest.mock('../../../../../utils/RouterUtils', () => ({
  getUserPath: jest.fn((userName) => `/users/${userName}`),
}));

jest.mock('../../../../../utils/TableUtils', () => ({
  getEntityIcon: jest.fn(() => <div data-testid="entity-icon">EntityIcon</div>),
}));

// Mock components
jest.mock('../../../../common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest
    .fn()
    .mockImplementation(({ markdown, className, 'data-testid': testId }) => (
      <div className={className} data-testid={testId}>
        {markdown}
      </div>
    ))
);

const mockOnClick = jest.fn();

const mockUpdateAnnouncement: Thread = {
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
  message: 'Alberto updated dim_address_table',
  postsCount: 0,
  posts: [],
  reactions: [],
  fieldOperation: FieldOperation.Updated,
  announcement: {
    description: 'We will be deprecating a column, please change accordingly.',
    startTime: 1659609300000,
    endTime: 1659868500000,
  },
  feedInfo: {
    fieldName: 'PARTNER_NAME',
  },
} as Thread;

const mockGeneralAnnouncement: Thread = {
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
  fieldOperation: FieldOperation.None,
  announcement: {
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    startTime: 1659512958138,
    endTime: 1659868500000,
  },
} as Thread;

describe('AnnouncementCardV1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderAnnouncementCardV1 = (announcement: Thread) => {
    return render(
      <BrowserRouter>
        <AnnouncementCardV1
          announcement={announcement}
          currentBackgroundColor="#9dd5fa"
          onClick={mockOnClick}
        />
      </BrowserRouter>
    );
  };

  it('should render update announcement card v1 correctly', () => {
    renderAnnouncementCardV1(mockUpdateAnnouncement);

    expect(screen.getByTestId('announcement-card-v1-1')).toBeInTheDocument();
    expect(screen.getByText('alberto')).toBeInTheDocument();
    expect(screen.getByText('label.updated-lowercase')).toBeInTheDocument();
    expect(
      screen.getByText('Alberto updated dim_address_table')
    ).toBeInTheDocument();
    expect(
      screen.getByText('label.column-name: PARTNER_NAME')
    ).toBeInTheDocument();
  });

  it('should render general announcement card v1 correctly', () => {
    renderAnnouncementCardV1(mockGeneralAnnouncement);

    expect(screen.getByTestId('announcement-card-v1-2')).toBeInTheDocument();
    expect(screen.getByText('Total Data Assets')).toBeInTheDocument();
    expect(
      screen.queryByText('label.updated-lowercase')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('label.column-name')).not.toBeInTheDocument();
  });

  it('should call onClick when card is clicked', () => {
    renderAnnouncementCardV1(mockUpdateAnnouncement);

    const card = screen.getByTestId('announcement-card-v1-1');
    fireEvent.click(card);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should handle announcement without description', () => {
    const announcementWithoutDescription = {
      ...mockUpdateAnnouncement,
      announcement: undefined,
    };

    renderAnnouncementCardV1(announcementWithoutDescription);

    expect(screen.getByTestId('announcement-card-v1-1')).toBeInTheDocument();
    expect(screen.getByText('alberto')).toBeInTheDocument();
    expect(
      screen.queryByText(
        'We will be deprecating a column, please change accordingly.'
      )
    ).not.toBeInTheDocument();
  });

  it('should handle announcement without column name', () => {
    const announcementWithoutColumn = {
      ...mockUpdateAnnouncement,
      feedInfo: undefined,
    };

    renderAnnouncementCardV1(announcementWithoutColumn);

    expect(screen.getByTestId('announcement-card-v1-1')).toBeInTheDocument();
    expect(screen.getByText('alberto')).toBeInTheDocument();
    expect(screen.queryByText('label.column-name')).not.toBeInTheDocument();
  });

  it('should render clickable entity name link for field operations', () => {
    renderAnnouncementCardV1(mockUpdateAnnouncement);

    const entityLink = screen.getByTestId('announcement-entity-link');

    expect(entityLink).toBeInTheDocument();
    expect(entityLink).toHaveAttribute(
      'href',
      '/test-announcement-entity-link'
    );
  });

  it('should render clickable user name link for field operations', () => {
    renderAnnouncementCardV1(mockUpdateAnnouncement);

    const userLink = screen.getByTestId('user-link');

    expect(userLink).toBeInTheDocument();
    expect(userLink).toHaveAttribute(
      'href',
      expect.stringContaining('/users/alberto')
    );
  });

  it('should not render clickable user name for general announcements', () => {
    renderAnnouncementCardV1(mockGeneralAnnouncement);

    const userLink = screen.queryByTestId('user-link');

    expect(userLink).not.toBeInTheDocument();
  });

  it('should handle user click without triggering card click', () => {
    renderAnnouncementCardV1(mockUpdateAnnouncement);

    const userLink = screen.getByTestId('user-link');
    fireEvent.click(userLink);

    // Card click should not be triggered when clicking on user link
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('should handle both user and entity clicks independently', () => {
    renderAnnouncementCardV1(mockUpdateAnnouncement);

    const userLink = screen.getByTestId('user-link');
    const entityLink = screen.getByTestId('announcement-entity-link');

    fireEvent.click(userLink);

    expect(mockOnClick).not.toHaveBeenCalled();

    fireEvent.click(entityLink);

    expect(mockOnClick).not.toHaveBeenCalled();

    // Only card click should trigger the onClick handler
    const card = screen.getByTestId('announcement-card-v1-1');
    fireEvent.click(card);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });
});
