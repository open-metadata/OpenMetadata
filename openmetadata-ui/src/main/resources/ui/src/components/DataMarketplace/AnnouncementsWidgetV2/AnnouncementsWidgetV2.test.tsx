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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  AnnouncementEntity,
  getActiveAnnouncements,
} from '../../../rest/announcementsAPI';
import AnnouncementsWidgetV2 from './AnnouncementsWidgetV2.component';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../rest/announcementsAPI', () => ({
  getActiveAnnouncements: jest.fn(),
}));

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => [undefined, undefined, { displayName: 'Admin User' }],
}));

jest.mock('../../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockReturnValue(<span>ProfilePicture</span>)
);

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }: { markdown: string }) => (
      <div>{markdown}</div>
    ))
);

const buildAnnouncement = (
  id: string,
  displayName: string,
  entityLink: string
): AnnouncementEntity => ({
  id,
  name: id,
  displayName,
  description: `${displayName} description`,
  entityLink,
  startTime: 1,
  endTime: 2,
  createdBy: 'admin',
});

const domainAnnouncement = buildAnnouncement(
  'domain-1',
  'Domain update',
  '<#E::domain::Engineering>'
);
const dataProductAnnouncement = buildAnnouncement(
  'dp-1',
  'Data product update',
  '<#E::dataProduct::Campaign>'
);
const tableAnnouncement = buildAnnouncement(
  'table-1',
  'Table update',
  '<#E::table::service.db.schema.orders>'
);

const renderWidget = () =>
  render(<AnnouncementsWidgetV2 widgetKey="announcements" />, {
    wrapper: MemoryRouter,
  });

describe('AnnouncementsWidgetV2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows only domain and data product announcements in the banner carousel', async () => {
    (getActiveAnnouncements as jest.Mock).mockResolvedValue({
      data: [domainAnnouncement, tableAnnouncement, dataProductAnnouncement],
    });

    renderWidget();

    expect(
      await screen.findByRole('region', {
        name: 'label.announcement: Domain update',
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('announcement-next-btn'));

    expect(
      screen.getByRole('region', {
        name: 'label.announcement: Data product update',
      })
    ).toBeInTheDocument();
    // A disabled ButtonUtility with a tooltip stays focusable (aria-disabled).
    expect(screen.getByTestId('announcement-next-btn')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.queryByText('Table update')).not.toBeInTheDocument();
  });

  it('navigates to the announced entity when the banner is opened', async () => {
    (getActiveAnnouncements as jest.Mock).mockResolvedValue({
      data: [domainAnnouncement],
    });

    renderWidget();

    fireEvent.click(await screen.findByTestId('announcement-open-btn'));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate.mock.calls[0][0]).toContain('Engineering');
  });

  it('renders nothing when there are no marketplace announcements', async () => {
    (getActiveAnnouncements as jest.Mock).mockResolvedValue({
      data: [tableAnnouncement],
    });

    renderWidget();

    await waitFor(() =>
      expect(
        screen.queryByTestId('announcements-widget-v2-loading')
      ).not.toBeInTheDocument()
    );

    expect(
      screen.queryByTestId('announcements-widget-v2')
    ).not.toBeInTheDocument();
  });
});
