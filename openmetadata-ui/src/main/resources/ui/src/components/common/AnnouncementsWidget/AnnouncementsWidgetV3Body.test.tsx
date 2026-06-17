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
  Button: ({
    children,
    onClick,
    'data-testid': dataTestId,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    'data-testid'?: string;
  }) => (
    <button data-testid={dataTestId} onClick={onClick}>
      {children}
    </button>
  ),
  ButtonUtility: ({
    isDisabled,
    onClick,
    tooltip,
    'data-testid': dataTestId,
  }: {
    isDisabled?: boolean;
    onClick?: () => void;
    tooltip?: string;
    'data-testid'?: string;
  }) => (
    <button
      aria-label={tooltip}
      data-testid={dataTestId}
      disabled={isDisabled}
      onClick={onClick}
    />
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
  it('renders the header label and the current/total counter', () => {
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    expect(screen.getByText('label.announcement-plural')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('renders only the current announcement, not the whole list', () => {
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    expect(screen.getAllByTestId('mock-announcement-item')).toHaveLength(1);
    expect(screen.getByText('Announcement 0')).toBeInTheDocument();
  });

  it('disables the previous chevron on the first announcement', () => {
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    expect(screen.getByTestId('announcement-prev-btn')).toBeDisabled();
    expect(screen.getByTestId('announcement-next-btn')).not.toBeDisabled();
  });

  it('pages forward and backward through the announcements', () => {
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('announcement-next-btn'));

    expect(screen.getByText('Announcement 1')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('announcement-next-btn'));

    expect(screen.getByText('Announcement 2')).toBeInTheDocument();
    expect(screen.getByText('3/3')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-next-btn')).toBeDisabled();
    expect(screen.getByTestId('announcement-prev-btn')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('announcement-prev-btn'));

    expect(screen.getByText('Announcement 1')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('hides the counter when there is only one announcement', () => {
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements.slice(0, 1)}
        onItemClick={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('announcement-prev-btn')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('announcement-next-btn')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('1/1')).not.toBeInTheDocument();
    expect(screen.getByText('Announcement 0')).toBeInTheDocument();
  });

  it('calls onItemClick with the current announcement', () => {
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

  it('renders only the loader while loading, suppressing the header and item', () => {
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

  it('resets to the first announcement when the announcements prop changes', () => {
    const { rerender } = render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('announcement-next-btn'));
    fireEvent.click(screen.getByTestId('announcement-next-btn'));

    expect(screen.getByText('3/3')).toBeInTheDocument();

    const nextEntityAnnouncements: AnnouncementEntity[] = [
      { ...mockAnnouncements[0], displayName: 'Next 0', id: 'b-0' },
      { ...mockAnnouncements[1], displayName: 'Next 1', id: 'b-1' },
    ];

    rerender(
      <AnnouncementsWidgetV3Body
        announcements={nextEntityAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('Next 0')).toBeInTheDocument();
  });

  it('renders nothing after the announcements prop becomes empty', () => {
    const { rerender } = render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    expect(screen.getByTestId('announcements-widget-v3')).toBeInTheDocument();

    rerender(
      <AnnouncementsWidgetV3Body announcements={[]} onItemClick={jest.fn()} />
    );

    expect(
      screen.queryByTestId('announcements-widget-v3')
    ).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('mock-announcement-item')).toHaveLength(0);
  });
});
