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

import { fireEvent, render, screen } from '@testing-library/react';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';
import AnnouncementsWidgetV3Body from './AnnouncementsWidgetV3Body.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Typography: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('../Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader">Loader</div>,
}));

jest.mock('./AnnouncementItemV3.component', () => ({
  __esModule: true,
  default: ({
    announcement,
    onClick,
  }: {
    announcement: AnnouncementEntity;
    onClick: () => void;
  }) => (
    <div data-testid="mock-announcement-item" onClick={onClick}>
      {announcement.displayName}
    </div>
  ),
}));

const mockAnnouncements: AnnouncementEntity[] = Array.from(
  { length: 3 },
  (_, index) => ({
    id: `a-${index}`,
    name: `name-${index}`,
    displayName: `Announcement ${index}`,
    description: `Description ${index}`,
    entityLink: '<#E::table::service.db.schema.table>',
    startTime: 1,
    endTime: 2,
    createdBy: 'admin',
    createdAt: 1,
    updatedAt: 2,
  })
);

describe('AnnouncementsWidgetV3Body', () => {
  it('renders the header label and total announcement count', () => {
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    expect(screen.getByText('label.announcement-plural')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders every active announcement as a row', () => {
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    expect(screen.getAllByTestId('mock-announcement-item')).toHaveLength(3);
  });

  it('calls onItemClick with the clicked announcement', () => {
    const onItemClick = jest.fn();
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements.slice(0, 1)}
        onItemClick={onItemClick}
      />
    );

    fireEvent.click(screen.getByTestId('mock-announcement-item'));

    expect(onItemClick).toHaveBeenCalledWith(mockAnnouncements[0]);
  });

  it('renders View All and calls onViewAll when clicked', () => {
    const onViewAll = jest.fn();
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
        onViewAll={onViewAll}
      />
    );

    fireEvent.click(screen.getByTestId('view-all-btn'));

    expect(onViewAll).toHaveBeenCalledTimes(1);
  });

  it('does not render View All when onViewAll is not provided', () => {
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    expect(screen.queryByTestId('view-all-btn')).not.toBeInTheDocument();
  });

  it('renders only the loader while loading, suppressing the header and rows', () => {
    render(
      <AnnouncementsWidgetV3Body
        loading
        announcements={mockAnnouncements}
        testId="custom-widget"
        onItemClick={jest.fn()}
        onViewAll={jest.fn()}
      />
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.getByTestId('custom-widget')).toBeInTheDocument();
    expect(screen.queryAllByTestId('mock-announcement-item')).toHaveLength(0);
    expect(
      screen.queryByText('label.announcement-plural')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('view-all-btn')).not.toBeInTheDocument();
  });

  it('renders nothing when there are no announcements', () => {
    render(
      <AnnouncementsWidgetV3Body announcements={[]} onItemClick={jest.fn()} />
    );

    expect(
      screen.queryByTestId('announcements-widget-v3')
    ).not.toBeInTheDocument();
  });
});
