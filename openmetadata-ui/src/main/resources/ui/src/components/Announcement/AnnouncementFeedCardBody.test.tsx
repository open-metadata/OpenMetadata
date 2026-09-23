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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AnnouncementType } from '../../generated/entity/feed/announcement';
import { MOCK_ANNOUNCEMENT_DATA } from '../../mocks/Announcement.mock';
import { toAnnouncementTypeFields } from '../Modals/AnnouncementModal/announcementFormUtils';
import AnnouncementFeedCardBody from './AnnouncementFeedCardBody.component';

jest.mock('../../utils/date-time/DateTimeUtils', () => ({
  formatDate: jest.fn(() => 'formatted-date'),
  formatDateTime: jest.fn(() => 'formatted-time'),
}));

jest.mock('../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockReturnValue(<p>ProfilePicture</p>)
);

jest.mock('../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: jest.fn(() => '/entity-link'),
  },
}));

jest.mock('../../utils/FeedUtilsPure', () => ({
  getEntityFQN: jest.fn(() => 'service.database.table'),
  getEntityType: jest.fn(() => 'table'),
}));

jest.mock('../common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest.fn().mockImplementation(({ markdown }) => <div>{markdown}</div>)
);

// What the dialog hands back on save; a case can swap it for an untouched edit.
let mockConfirmed: { title: string; details: object } = {
  title: 'Updated title',
  details: {
    description: 'Updated description',
    startTime: 10,
    endTime: 20,
  },
};

jest.mock('../Modals/AnnouncementModal/EditAnnouncementModal', () =>
  jest
    .fn()
    .mockImplementation(({ onConfirm }) => (
      <button
        onClick={() => onConfirm(mockConfirmed.title, mockConfirmed.details)}>
        SaveAnnouncement
      </button>
    ))
);

const mockProps = {
  announcement: MOCK_ANNOUNCEMENT_DATA.data[0],
  editPermission: true,
  updateAnnouncementHandler: jest.fn(),
  onConfirmation: jest.fn(),
};

describe('AnnouncementFeedCardBody', () => {
  it('renders the announcement title and description', () => {
    render(<AnnouncementFeedCardBody {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByText('Cypress announcement')).toBeInTheDocument();
    expect(
      screen.getByText('Cypress announcement description')
    ).toBeInTheDocument();
  });

  it('opens the edit flow and patches the announcement', () => {
    render(<AnnouncementFeedCardBody {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    fireEvent.click(screen.getByTestId('announcement-actions'));
    fireEvent.click(screen.getByText('label.edit'));
    fireEvent.click(screen.getByText('SaveAnnouncement'));

    expect(mockProps.updateAnnouncementHandler).toHaveBeenCalledWith(
      MOCK_ANNOUNCEMENT_DATA.data[0].id,
      expect.any(Array)
    );
  });

  it('sends delete confirmation for the selected announcement', () => {
    render(<AnnouncementFeedCardBody {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    fireEvent.click(screen.getByTestId('announcement-actions'));
    fireEvent.click(screen.getByText('label.delete'));

    expect(mockProps.onConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: MOCK_ANNOUNCEMENT_DATA.data[0].id,
        isThread: true,
      })
    );
  });

  it('does not patch when an edit is saved untouched', async () => {
    // As the server returns it: an unset flag comes back as `false`.
    const announcement = {
      id: 'untouched-id',
      name: 'untouched',
      displayName: 'Untouched announcement',
      description: 'Body',
      startTime: 10,
      endTime: 20,
      announcementType: AnnouncementType.Notice,
      systemWide: false,
    };
    mockConfirmed = {
      title: announcement.displayName,
      details: {
        description: announcement.description,
        startTime: announcement.startTime,
        endTime: announcement.endTime,
        // Built the way the edit dialog builds it, so a drift there shows here.
        ...toAnnouncementTypeFields({
          title: announcement.displayName,
          description: announcement.description,
          startTime: announcement.startTime,
          endTime: announcement.endTime,
          announcementType: announcement.announcementType,
          systemWide: announcement.systemWide,
        }),
      },
    };
    const updateAnnouncementHandler = jest.fn();

    render(
      <AnnouncementFeedCardBody
        {...mockProps}
        announcement={announcement}
        updateAnnouncementHandler={updateAnnouncementHandler}
      />,
      { wrapper: MemoryRouter }
    );

    fireEvent.click(screen.getByTestId('announcement-actions'));
    fireEvent.click(screen.getByText('label.edit'));
    await act(async () => {
      fireEvent.click(screen.getByText('SaveAnnouncement'));
    });

    expect(updateAnnouncementHandler).not.toHaveBeenCalled();
  });

  it('shows a Custom announcement by its own name', () => {
    render(
      <AnnouncementFeedCardBody
        {...mockProps}
        announcement={{
          ...MOCK_ANNOUNCEMENT_DATA.data[0],
          announcementType: AnnouncementType.Custom,
          customTypeName: 'Release',
        }}
      />,
      { wrapper: MemoryRouter }
    );

    expect(screen.getByTestId('announcement-type-badge')).toHaveTextContent(
      'Release'
    );
  });
});
