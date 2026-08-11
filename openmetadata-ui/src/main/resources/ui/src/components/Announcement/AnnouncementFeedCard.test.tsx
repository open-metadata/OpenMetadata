/*
 *  Copyright 2024 Collate.
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
import { MOCK_ANNOUNCEMENT_DATA } from '../../mocks/Announcement.mock';
import AnnouncementFeedCard from './AnnouncementFeedCard.component';

jest.mock('./AnnouncementFeedCardBody.component', () =>
  jest
    .fn()
    .mockImplementation(({ updateAnnouncementHandler, onConfirmation }) => (
      <>
        <p>AnnouncementFeedCardBody</p>
        <button
          onClick={() => updateAnnouncementHandler('announcementId', 'data')}>
          UpdateAnnouncementHandlerButton
        </button>
        <button onClick={onConfirmation}>ConfirmationButton</button>
      </>
    ))
);

jest.mock('../ActivityFeed/Shared/AnnouncementBadge', () => {
  return jest.fn().mockReturnValue(<p>AnnouncementBadge</p>);
});

jest.mock('../common/ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockReturnValue(<p>ProfilePicture</p>);
});

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockProps = {
  announcement: MOCK_ANNOUNCEMENT_DATA.data[0],
  editPermission: true,
  onConfirmation: jest.fn(),
  updateAnnouncementHandler: jest.fn(),
};

describe('Test AnnouncementFeedCard Component', () => {
  it('should render AnnouncementFeedCard component', () => {
    render(<AnnouncementFeedCard {...mockProps} />);

    expect(screen.getByText('AnnouncementBadge')).toBeInTheDocument();
    expect(screen.getByText('AnnouncementFeedCardBody')).toBeInTheDocument();
  });

  it('should trigger onConfirmation', () => {
    render(<AnnouncementFeedCard {...mockProps} />);

    fireEvent.click(screen.getByText('ConfirmationButton'));

    expect(mockProps.onConfirmation).toHaveBeenCalled();
  });

  it('should trigger updateAnnouncementHandler', () => {
    render(<AnnouncementFeedCard {...mockProps} />);

    fireEvent.click(screen.getByText('UpdateAnnouncementHandlerButton'));

    expect(mockProps.updateAnnouncementHandler).toHaveBeenCalledWith(
      'announcementId',
      'data'
    );
  });
});
