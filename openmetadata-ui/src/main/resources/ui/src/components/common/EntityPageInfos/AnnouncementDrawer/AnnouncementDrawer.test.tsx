/*
 *  Copyright 2022 Collate.
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

import { fireEvent, render, screen, within } from '@testing-library/react';
import AnnouncementDrawer from './AnnouncementDrawer';

jest.mock('../../../../utils/EntityPureUtils', () => ({
  getEntityFeedLink: jest.fn(),
}));

jest.mock('../../../../rest/announcementsAPI', () => ({
  deleteAnnouncement: jest.fn(),
  patchAnnouncement: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../Announcement/AnnouncementThreadBody.component', () =>
  jest
    .fn()
    .mockImplementation(({ statusFilter }: { statusFilter?: string }) => (
      <div>
        AnnouncementThreadBody
        <span data-testid="status-filter">{statusFilter ?? 'none'}</span>
      </div>
    ))
);

jest.mock('../../../Modals/AnnouncementModal/AddAnnouncementModal', () => {
  return jest.fn().mockReturnValue(<div>AddAnnouncementModal</div>);
});

const mockProps = {
  open: true,
  entityType: 'string',
  entityFQN: 'string',
  onClose: jest.fn(),
  createPermission: true,
};

describe('Test Announcement drawer component', () => {
  it('Should render the component', async () => {
    render(<AnnouncementDrawer {...mockProps} />);

    const announcementHeader = screen.getByText('label.announcement-plural');
    const addAnnouncementButton = screen.getByTestId('add-announcement');

    const addButton = screen.getByTestId('add-announcement');

    const announcements = screen.getByText('AnnouncementThreadBody');

    expect(announcementHeader).toBeInTheDocument();
    expect(addAnnouncementButton).toBeInTheDocument();
    expect(addButton).toBeInTheDocument();
    expect(announcements).toBeInTheDocument();
  });

  it('Should be disabled if not having permission to create', async () => {
    render(<AnnouncementDrawer {...mockProps} createPermission={false} />);

    const addButton = screen.getByTestId('add-announcement');

    expect(addButton).toBeDisabled();
  });

  it('Should expose the status filters as a tab list', async () => {
    render(<AnnouncementDrawer {...mockProps} />);

    const tabs = screen.getByRole('tablist');

    // A tab list, not four independent toggles: core's Tabs gives the group a
    // single tab stop and arrow-key navigation, which `aria-pressed` buttons
    // do not.
    expect(within(tabs).getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByTestId('announcement-status-all')).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('Should filter the body by the selected status', async () => {
    render(<AnnouncementDrawer {...mockProps} />);

    // "All" passes no filter through at all, so the body lists every status.
    expect(screen.getByTestId('status-filter')).toHaveTextContent('none');

    fireEvent.click(screen.getByTestId('announcement-status-Scheduled'));

    expect(screen.getByTestId('status-filter')).toHaveTextContent('Scheduled');
    expect(screen.getByTestId('announcement-status-Scheduled')).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('Should open modal on click of add button', async () => {
    render(<AnnouncementDrawer {...mockProps} />);

    const addButton = screen.getByTestId('add-announcement');

    fireEvent.click(addButton);

    expect(await screen.findByText('AddAnnouncementModal')).toBeInTheDocument();
  });

  it('Should stack the scrim over app chrome that carries its own z-index', () => {
    render(<AnnouncementDrawer {...mockProps} />);

    // The library's slideout overlay has no z-index of its own, so the fixed
    // nav rail and the docked assistant bar painted straight through the
    // scrim. Stacked here, as the other drawers in this app do.
    const scrim = screen
      .getByTestId('announcement-drawer')
      .closest('.tw\\:fixed');

    expect(scrim).toHaveClass('tw:z-50');
  });
});
