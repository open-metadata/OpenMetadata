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

const MOCK_MOCK_ANNOUNCEMENT_ITEM = 'mock-announcement-item';
const ANNOUNCEMENT_PREV_BTN = 'announcement-prev-btn';
const ANNOUNCEMENT_NEXT_BTN = 'announcement-next-btn';
const VIEW_ALL_BTN = 'view-all-btn';
const ANNOUNCEMENTS_WIDGET_V3 = 'announcements-widget-v3';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    className,
    'data-testid': dataTestId,
  }: {
    children?: React.ReactNode;
    className?: string;
    // eslint-disable-next-line sonarjs/no-duplicate-string
    'data-testid'?: string;
  }) => (
    <div className={className} data-testid={dataTestId}>
      {children}
    </div>
  ),
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
    'aria-label': ariaLabel,
    'data-testid': dataTestId,
  }: {
    isDisabled?: boolean;
    onClick?: () => void;
    'aria-label'?: string;
    'data-testid'?: string;
  }) => (
    <button
      aria-label={ariaLabel}
      data-testid={dataTestId}
      disabled={isDisabled}
      onClick={onClick}
    />
  ),
  Skeleton: () => <span data-testid="skeleton" />,
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
    <div
      data-testid={MOCK_MOCK_ANNOUNCEMENT_ITEM}
      role="presentation"
      onClick={onClick}>
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

    expect(screen.getAllByTestId(MOCK_MOCK_ANNOUNCEMENT_ITEM)).toHaveLength(1);
    expect(screen.getByText('Announcement 0')).toBeInTheDocument();
  });

  it('disables the previous chevron on the first announcement', () => {
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    expect(screen.getByTestId(ANNOUNCEMENT_PREV_BTN)).toBeDisabled();
    expect(screen.getByTestId(ANNOUNCEMENT_NEXT_BTN)).not.toBeDisabled();
  });

  it('pages forward and backward through the announcements', () => {
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId(ANNOUNCEMENT_NEXT_BTN));

    expect(screen.getByText('Announcement 1')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(ANNOUNCEMENT_NEXT_BTN));

    expect(screen.getByText('Announcement 2')).toBeInTheDocument();
    expect(screen.getByText('3/3')).toBeInTheDocument();
    expect(screen.getByTestId(ANNOUNCEMENT_NEXT_BTN)).toBeDisabled();
    expect(screen.getByTestId(ANNOUNCEMENT_PREV_BTN)).not.toBeDisabled();

    fireEvent.click(screen.getByTestId(ANNOUNCEMENT_PREV_BTN));

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

    expect(screen.queryByTestId(ANNOUNCEMENT_PREV_BTN)).not.toBeInTheDocument();
    expect(screen.queryByTestId(ANNOUNCEMENT_NEXT_BTN)).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByTestId(MOCK_MOCK_ANNOUNCEMENT_ITEM));

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

    fireEvent.click(screen.getByTestId(VIEW_ALL_BTN));

    expect(onViewAll).toHaveBeenCalledTimes(1);
  });

  it('does not render View All when onViewAll is not provided', () => {
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    expect(screen.queryByTestId(VIEW_ALL_BTN)).not.toBeInTheDocument();
  });

  it('renders only the skeleton while loading, suppressing the header and item', () => {
    render(
      <AnnouncementsWidgetV3Body
        loading
        announcements={mockAnnouncements}
        testId="custom-widget"
        onItemClick={jest.fn()}
        onViewAll={jest.fn()}
      />
    );

    expect(screen.getByTestId('custom-widget-loading')).toBeInTheDocument();
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.getByTestId('custom-widget')).toBeInTheDocument();
    expect(screen.queryAllByTestId(MOCK_MOCK_ANNOUNCEMENT_ITEM)).toHaveLength(
      0
    );
    expect(
      screen.queryByText('label.announcement-plural')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId(VIEW_ALL_BTN)).not.toBeInTheDocument();
  });

  it('renders nothing when there are no announcements', () => {
    render(
      <AnnouncementsWidgetV3Body announcements={[]} onItemClick={jest.fn()} />
    );

    expect(
      screen.queryByTestId(ANNOUNCEMENTS_WIDGET_V3)
    ).not.toBeInTheDocument();
  });

  it('resets to the first announcement when the announcements prop changes', () => {
    const { rerender } = render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId(ANNOUNCEMENT_NEXT_BTN));
    fireEvent.click(screen.getByTestId(ANNOUNCEMENT_NEXT_BTN));

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

    expect(screen.getByTestId(ANNOUNCEMENTS_WIDGET_V3)).toBeInTheDocument();

    rerender(
      <AnnouncementsWidgetV3Body announcements={[]} onItemClick={jest.fn()} />
    );

    expect(
      screen.queryByTestId(ANNOUNCEMENTS_WIDGET_V3)
    ).not.toBeInTheDocument();
    expect(screen.queryAllByTestId(MOCK_MOCK_ANNOUNCEMENT_ITEM)).toHaveLength(
      0
    );
  });
});
