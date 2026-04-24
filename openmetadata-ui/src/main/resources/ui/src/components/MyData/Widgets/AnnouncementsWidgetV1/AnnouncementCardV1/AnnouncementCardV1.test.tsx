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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AnnouncementEntity } from '../../../../../rest/announcementsAPI';
import AnnouncementCardV1 from './AnnouncementCardV1.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../../../utils/date-time/DateTimeUtils', () => ({
  getShortRelativeTime: jest.fn(() => '12 hrs ago'),
}));

jest.mock('../../../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: jest.fn(() => '/test-announcement-entity-link'),
  },
}));

jest.mock('../../../../../utils/FeedUtils', () => ({
  getEntityFQN: jest.fn(() => 'service::entity'),
  getEntityType: jest.fn(() => 'table'),
}));

jest.mock('../../../../../utils/RouterUtils', () => ({
  getUserPath: jest.fn((userName) => `/users/${userName}`),
}));

jest.mock('../../../../../utils/TableUtils', () => ({
  getEntityIcon: jest.fn(() => <div data-testid="entity-icon">EntityIcon</div>),
}));

jest.mock('../../../../common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest
    .fn()
    .mockImplementation(({ markdown, 'data-testid': testId }) => (
      <div data-testid={testId}>{markdown}</div>
    ))
);

const mockOnClick = jest.fn();

const mockAnnouncement: AnnouncementEntity = {
  id: '1',
  name: 'announcement-one',
  displayName: 'Total Data Assets',
  description: 'Lorem ipsum dolor sit amet.',
  entityLink:
    '<#E::table::sample_data.ecommerce_db.shopify.raw_product_catalog>',
  createdBy: 'alberto',
  updatedAt: 1659610946842,
  startTime: 1659609300000,
  endTime: 1659868500000,
};

describe('AnnouncementCardV1', () => {
  const renderAnnouncementCardV1 = (announcement: AnnouncementEntity) => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders announcement metadata and description', () => {
    renderAnnouncementCardV1(mockAnnouncement);

    expect(screen.getByTestId('announcement-card-v1-1')).toBeInTheDocument();
    expect(screen.getByText('alberto')).toBeInTheDocument();
    expect(screen.getByText('Total Data Assets')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-description')).toHaveTextContent(
      'Lorem ipsum dolor sit amet.'
    );
  });

  it('renders entity and user links without triggering card click', () => {
    renderAnnouncementCardV1(mockAnnouncement);

    fireEvent.click(screen.getByTestId('announcement-entity-link'));
    fireEvent.click(screen.getByTestId('user-link'));

    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('triggers onClick when the card itself is clicked', () => {
    renderAnnouncementCardV1(mockAnnouncement);

    fireEvent.click(screen.getByTestId('announcement-card-v1-1'));

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });
});
