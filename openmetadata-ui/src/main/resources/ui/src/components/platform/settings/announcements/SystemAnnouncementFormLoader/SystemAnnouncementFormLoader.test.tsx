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
import { render, screen } from '@testing-library/react';
import { AnnouncementEntity } from '../../../../../rest/announcementsAPI';
import SystemAnnouncementFormLoader from './SystemAnnouncementFormLoader';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseSystemAnnouncement = jest.fn();

jest.mock('../../../../../hooks/platform/useSystemAnnouncements', () => ({
  useSystemAnnouncement: (id?: string) => mockUseSystemAnnouncement(id),
}));

jest.mock('../../../../common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

jest.mock('../SystemAnnouncementForm/SystemAnnouncementForm', () => ({
  __esModule: true,
  default: ({
    announcement,
    mode,
  }: {
    announcement?: AnnouncementEntity;
    mode: string;
  }) => <div data-testid="form">{`${mode}:${announcement?.id ?? 'none'}`}</div>,
}));

const stored: AnnouncementEntity = {
  id: 'a1',
  name: 'announcement-a1',
  description: 'Body',
  startTime: 1,
  endTime: 2,
};

const renderLoader = (mode: 'create' | 'edit' | 'duplicate', id?: string) =>
  render(
    <SystemAnnouncementFormLoader
      id={id}
      mode={mode}
      onCancel={jest.fn()}
      onSaved={jest.fn()}
    />
  );

describe('SystemAnnouncementFormLoader', () => {
  beforeEach(() => {
    mockUseSystemAnnouncement.mockReturnValue({
      data: undefined,
      isError: false,
      isLoading: false,
    });
  });

  it('opens an empty form to create, without fetching anything', () => {
    renderLoader('create', 'a1');

    expect(mockUseSystemAnnouncement).toHaveBeenCalledWith(undefined);
    expect(screen.getByTestId('form')).toHaveTextContent('create:none');
  });

  it('waits for the announcement before mounting the form', () => {
    mockUseSystemAnnouncement.mockReturnValue({ isLoading: true });

    renderLoader('edit', 'a1');

    expect(mockUseSystemAnnouncement).toHaveBeenCalledWith('a1');
    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByTestId('form')).not.toBeInTheDocument();
  });

  it.each(['edit', 'duplicate'] as const)(
    'starts the %s form from the fetched announcement',
    (mode) => {
      mockUseSystemAnnouncement.mockReturnValue({
        data: stored,
        isError: false,
        isLoading: false,
      });

      renderLoader(mode, 'a1');

      expect(screen.getByTestId('form')).toHaveTextContent(`${mode}:a1`);
    }
  );

  it('says not found for a missing announcement', () => {
    mockUseSystemAnnouncement.mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
    });

    renderLoader('edit', 'gone');

    expect(screen.getByTestId('announcement-not-found')).toBeInTheDocument();
  });

  it('refuses an announcement on an asset: this page manages system ones only', () => {
    mockUseSystemAnnouncement.mockReturnValue({
      data: { ...stored, entityLink: '<#E::table::db.schema.orders>' },
      isError: false,
      isLoading: false,
    });

    renderLoader('edit', 'a1');

    expect(screen.getByTestId('announcement-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('form')).not.toBeInTheDocument();
  });
});
