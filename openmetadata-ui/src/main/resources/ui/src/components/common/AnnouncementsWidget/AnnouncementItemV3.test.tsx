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
import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';
import AnnouncementItemV3 from './AnnouncementItemV3.component';

let mockUser: { name?: string; displayName?: string } | undefined = {
  name: 'admin',
  displayName: 'Admin User',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    className,
    role,
    tabIndex,
    onClick,
    onKeyDown,
    'data-testid': dataTestId,
  }: {
    children?: React.ReactNode;
    className?: string;
    role?: React.AriaRole;
    tabIndex?: number;
    onClick?: () => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    'data-testid'?: string;
  }) => (
    <div
      className={className}
      data-testid={dataTestId}
      role={role}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}>
      {children}
    </div>
  ),
  Typography: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('@untitledui/icons', () => ({
  ArrowRight: () => <span data-testid="arrow-right" />,
}));

jest.mock('../RichTextEditor/RichTextEditorPreviewerV1', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => (
    <div data-testid="rich-text-preview">{markdown}</div>
  ),
}));

jest.mock('../ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => (
    <span data-testid="profile-picture">{name}</span>
  ),
}));

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => [undefined, false, mockUser],
}));

jest.mock('../../../utils/BlockEditorUtils', () => ({
  isDescriptionContentEmpty: (content?: string) =>
    !content || content.trim() === '',
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getUserPath: (name: string) => `/users/${name}`,
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  ...jest.requireActual('../../../utils/date-time/DateTimeUtils'),
  getShortRelativeTime: (ts?: number) => (ts === undefined ? '' : `rel-${ts}`),
}));

const announcement: AnnouncementEntity = {
  id: 'a-1',
  name: 'name-1',
  displayName: 'Upcoming changes',
  description: 'The data product will be updated.',
  entityLink: '<#E::table::service.db.schema.table>',
  startTime: 1,
  endTime: 2,
  createdBy: 'admin',
  createdAt: 1,
  updatedAt: 2,
};

const renderItem = (ui: ReactElement) => render(ui, { wrapper: MemoryRouter });

describe('AnnouncementItemV3', () => {
  beforeEach(() => {
    mockUser = { name: 'admin', displayName: 'Admin User' };
  });

  it('renders the title and description', () => {
    renderItem(
      <AnnouncementItemV3 announcement={announcement} onClick={jest.fn()} />
    );

    expect(screen.getByText('Upcoming changes')).toBeInTheDocument();
    expect(
      screen.getByText('The data product will be updated.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('arrow-right')).toBeInTheDocument();
  });

  it('falls back to name when displayName is missing', () => {
    renderItem(
      <AnnouncementItemV3
        announcement={{ ...announcement, displayName: undefined }}
        onClick={jest.fn()}
      />
    );

    expect(screen.getByText('name-1')).toBeInTheDocument();
  });

  it('does not render the description preview when the description is empty', () => {
    renderItem(
      <AnnouncementItemV3
        announcement={{ ...announcement, description: '' }}
        onClick={jest.fn()}
      />
    );

    expect(screen.queryByTestId('rich-text-preview')).not.toBeInTheDocument();
  });

  it('renders the user info line with avatar, posted-by name and relative time', () => {
    renderItem(
      <AnnouncementItemV3 announcement={announcement} onClick={jest.fn()} />
    );

    expect(screen.getByTestId('profile-picture')).toHaveTextContent('admin');
    expect(screen.getByTestId('announcement-item-a-1')).toHaveTextContent(
      'label.posted-by'
    );
    expect(screen.getByText('rel-1')).toBeInTheDocument();

    const userLink = screen.getByRole('link', { name: 'Admin User' });

    expect(userLink).toHaveAttribute('href', '/users/admin');
  });

  it('falls back to createdBy for the user link when the profile is unresolved', () => {
    mockUser = undefined;
    renderItem(
      <AnnouncementItemV3 announcement={announcement} onClick={jest.fn()} />
    );

    const userLink = screen.getByRole('link', { name: 'admin' });

    expect(userLink).toHaveAttribute('href', '/users/admin');
  });

  it('shows the relative time derived from createdAt', () => {
    renderItem(
      <AnnouncementItemV3 announcement={announcement} onClick={jest.fn()} />
    );

    expect(screen.getByText('rel-1')).toBeInTheDocument();
  });

  it('falls back to updatedAt when createdAt is missing', () => {
    renderItem(
      <AnnouncementItemV3
        announcement={{ ...announcement, createdAt: undefined }}
        onClick={jest.fn()}
      />
    );

    expect(screen.getByText('rel-2')).toBeInTheDocument();
  });

  it('renders no timestamp text when createdAt and updatedAt are both missing', () => {
    renderItem(
      <AnnouncementItemV3
        announcement={{
          ...announcement,
          createdAt: undefined,
          updatedAt: undefined,
        }}
        onClick={jest.fn()}
      />
    );

    expect(screen.queryByText(/^rel-/)).not.toBeInTheDocument();
  });

  it('omits the user info line when createdBy is absent', () => {
    renderItem(
      <AnnouncementItemV3
        announcement={{ ...announcement, createdBy: undefined }}
        onClick={jest.fn()}
      />
    );

    expect(screen.queryByTestId('profile-picture')).not.toBeInTheDocument();
    expect(screen.queryByText(/^rel-/)).not.toBeInTheDocument();
  });

  it('calls onClick when the row is clicked', () => {
    const onClick = jest.fn();
    renderItem(
      <AnnouncementItemV3 announcement={announcement} onClick={onClick} />
    );

    fireEvent.click(screen.getByTestId('announcement-item-a-1'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not trigger the row onClick when the user link is clicked', () => {
    const onClick = jest.fn();
    renderItem(
      <AnnouncementItemV3 announcement={announcement} onClick={onClick} />
    );

    fireEvent.click(screen.getByRole('link', { name: 'Admin User' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not trigger the row onClick when Enter is pressed on the user link', () => {
    const onClick = jest.fn();
    renderItem(
      <AnnouncementItemV3 announcement={announcement} onClick={onClick} />
    );

    fireEvent.keyDown(screen.getByRole('link', { name: 'Admin User' }), {
      key: 'Enter',
    });

    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls onClick when Enter is pressed on the row', () => {
    const onClick = jest.fn();
    renderItem(
      <AnnouncementItemV3 announcement={announcement} onClick={onClick} />
    );

    fireEvent.keyDown(screen.getByTestId('announcement-item-a-1'), {
      key: 'Enter',
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when Space is pressed on the row', () => {
    const onClick = jest.fn();
    renderItem(
      <AnnouncementItemV3 announcement={announcement} onClick={onClick} />
    );

    fireEvent.keyDown(screen.getByTestId('announcement-item-a-1'), {
      key: ' ',
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated keys on the row', () => {
    const onClick = jest.fn();
    renderItem(
      <AnnouncementItemV3 announcement={announcement} onClick={onClick} />
    );

    fireEvent.keyDown(screen.getByTestId('announcement-item-a-1'), {
      key: 'a',
    });

    expect(onClick).not.toHaveBeenCalled();
  });
});
