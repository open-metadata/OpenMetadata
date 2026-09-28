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
  Box: ({
    children,
    className,
    'data-testid': dataTestId,
  }: {
    children?: React.ReactNode;
    className?: string;
    'data-testid'?: string;
  }) => (
    <div className={className} data-testid={dataTestId}>
      {children}
    </div>
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
  Skeleton: ({ 'data-testid': dataTestId }: { 'data-testid'?: string }) => (
    <span data-testid={dataTestId} />
  ),
}));

jest.mock('./AnnouncementBanner.component', () => ({
  __esModule: true,
  default: ({
    announcement,
    expanded,
    onClick,
    onDismiss,
    onToggleExpand,
  }: {
    announcement: AnnouncementEntity;
    expanded?: boolean;
    onClick?: () => void;
    onDismiss?: () => void;
    onToggleExpand?: () => void;
  }) => (
    <div data-testid="mock-announcement-banner">
      <span data-testid="banner-title" role="presentation" onClick={onClick}>
        {announcement.displayName}
      </span>
      <span data-testid="banner-expanded">{String(expanded)}</span>
      <button data-testid="banner-toggle" onClick={onToggleExpand}>
        toggle
      </button>
      <button data-testid="banner-dismiss" onClick={onDismiss}>
        dismiss
      </button>
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
  it('renders only the current announcement, not the whole list', () => {
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    expect(screen.getAllByTestId('mock-announcement-banner')).toHaveLength(1);
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

    fireEvent.click(screen.getByTestId('announcement-next-btn'));

    expect(screen.getByText('Announcement 2')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-next-btn')).toBeDisabled();

    fireEvent.click(screen.getByTestId('announcement-prev-btn'));

    expect(screen.getByText('Announcement 1')).toBeInTheDocument();
  });

  it('collapses an expanded banner when paging to the next one', () => {
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('banner-toggle'));

    expect(screen.getByTestId('banner-expanded')).toHaveTextContent('true');

    fireEvent.click(screen.getByTestId('announcement-next-btn'));

    expect(screen.getByTestId('banner-expanded')).toHaveTextContent('false');
  });

  it('hides the chevrons when there is only one announcement', () => {
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

    fireEvent.click(screen.getByTestId('banner-title'));

    expect(onItemClick).toHaveBeenCalledWith(mockAnnouncements[0]);
  });

  it('drops a dismissed announcement and keeps paging over the rest', () => {
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements}
        onItemClick={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('banner-dismiss'));

    expect(screen.getByText('Announcement 1')).toBeInTheDocument();
    expect(screen.queryByText('Announcement 0')).not.toBeInTheDocument();
  });

  it('renders nothing once every announcement is dismissed', () => {
    render(
      <AnnouncementsWidgetV3Body
        announcements={mockAnnouncements.slice(0, 1)}
        onItemClick={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('banner-dismiss'));

    expect(
      screen.queryByTestId('announcements-widget-v3')
    ).not.toBeInTheDocument();
  });

  it('renders only the skeleton while loading', () => {
    render(
      <AnnouncementsWidgetV3Body
        loading
        announcements={mockAnnouncements}
        testId="custom-widget"
        onItemClick={jest.fn()}
      />
    );

    expect(screen.getByTestId('custom-widget-loading')).toBeInTheDocument();
    expect(screen.queryAllByTestId('mock-announcement-banner')).toHaveLength(0);
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

    expect(screen.getByText('Announcement 2')).toBeInTheDocument();

    rerender(
      <AnnouncementsWidgetV3Body
        announcements={[
          { ...mockAnnouncements[0], displayName: 'Next 0', id: 'b-0' },
          { ...mockAnnouncements[1], displayName: 'Next 1', id: 'b-1' },
        ]}
        onItemClick={jest.fn()}
      />
    );

    expect(screen.getByText('Next 0')).toBeInTheDocument();
  });
});
