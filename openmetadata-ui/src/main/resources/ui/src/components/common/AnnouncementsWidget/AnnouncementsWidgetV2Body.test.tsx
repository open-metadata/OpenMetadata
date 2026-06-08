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
import AnnouncementsWidgetV2Body from './AnnouncementsWidgetV2Body.component';

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

jest.mock('./AnnouncementItemV2.component', () => ({
  __esModule: true,
  default: ({
    announcement,
    onClick,
    hideEntityName,
  }: {
    announcement: AnnouncementEntity;
    onClick: () => void;
    hideEntityName?: boolean;
  }) => (
    <div
      data-hide-entity-name={String(Boolean(hideEntityName))}
      data-testid="mock-announcement-item"
      onClick={onClick}>
      {announcement.displayName}
    </div>
  ),
}));

const mockAnnouncements: AnnouncementEntity[] = Array.from(
  { length: 6 },
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

describe('AnnouncementsWidgetV2Body', () => {
  it('renders the header label and total announcement count', () => {
    render(
      <AnnouncementsWidgetV2Body
        announcements={mockAnnouncements.slice(0, 2)}
        onItemClick={jest.fn()}
      />
    );

    expect(screen.getByText('label.announcement-plural')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('limits visible items to displayCount and toggles with View all', () => {
    render(
      <AnnouncementsWidgetV2Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    expect(screen.getAllByTestId('mock-announcement-item')).toHaveLength(4);
    expect(screen.getByTestId('view-all-btn')).toHaveTextContent(
      'label.view-all'
    );

    fireEvent.click(screen.getByTestId('view-all-btn'));

    expect(screen.getAllByTestId('mock-announcement-item')).toHaveLength(6);
    expect(screen.getByTestId('view-all-btn')).toHaveTextContent(
      'label.show-less'
    );
  });

  it('calls onItemClick with the clicked announcement', () => {
    const onItemClick = jest.fn();
    render(
      <AnnouncementsWidgetV2Body
        announcements={mockAnnouncements.slice(0, 1)}
        onItemClick={onItemClick}
      />
    );

    fireEvent.click(screen.getByTestId('mock-announcement-item'));

    expect(onItemClick).toHaveBeenCalledWith(mockAnnouncements[0]);
  });

  it('forwards hideEntityName to the items', () => {
    render(
      <AnnouncementsWidgetV2Body
        hideEntityName
        announcements={mockAnnouncements.slice(0, 1)}
        onItemClick={jest.fn()}
      />
    );

    expect(screen.getByTestId('mock-announcement-item')).toHaveAttribute(
      'data-hide-entity-name',
      'true'
    );
  });

  it('renders the loader while loading', () => {
    render(
      <AnnouncementsWidgetV2Body
        loading
        announcements={[]}
        testId="custom-widget"
        onItemClick={jest.fn()}
      />
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.getByTestId('custom-widget')).toBeInTheDocument();
  });

  it('renders nothing when there are no announcements', () => {
    render(
      <AnnouncementsWidgetV2Body announcements={[]} onItemClick={jest.fn()} />
    );

    expect(
      screen.queryByTestId('announcements-widget-v2')
    ).not.toBeInTheDocument();
  });
});
