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
import { act, render, screen } from '@testing-library/react';
import { MOCK_ANNOUNCEMENT_DATA } from '../../../mocks/Announcement.mock';
import AnnouncementsWidget from './AnnouncementsWidget';

const mockAnnouncementData = [MOCK_ANNOUNCEMENT_DATA.data[0]];

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockReturnValue(<div>ErrorPlaceHolder</div>)
);

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest.fn().mockImplementation(({ markdown }) => <div>{markdown}</div>)
);

describe('AnnouncementsWidget', () => {
  it('should render Announcements Widget', () => {
    const { container } = render(<AnnouncementsWidget widgetKey="testKey" />);

    expect(container).toBeTruthy();
  });

  it('should render loading state', () => {
    render(<AnnouncementsWidget isAnnouncementLoading widgetKey="testKey" />);

    expect(screen.getByText('Loader')).toBeInTheDocument();
  });

  it('should render empty state', () => {
    render(<AnnouncementsWidget announcements={[]} widgetKey="testKey" />);

    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('should render announcements', async () => {
    await act(async () => {
      render(
        <AnnouncementsWidget
          announcements={mockAnnouncementData}
          widgetKey="testKey"
        />
      );
    });

    expect(
      screen.getByText('Cypress announcement description')
    ).toBeInTheDocument();
    expect(screen.getByText('label.announcement')).toBeInTheDocument();
  });
});
