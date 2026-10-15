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
import { ROUTES } from '../../../../constants/constants';
import SystemAnnouncementsPage from './SystemAnnouncementsPage';

const mockNavigate = jest.fn();
let mockIsAiMode = false;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../../hooks/useAppMode', () => ({
  useIsAiMode: () => mockIsAiMode,
}));

jest.mock('../../../../hooks/platform/useSystemAnnouncements', () => ({
  useSystemAnnouncementsList: () => ({ announcements: [] }),
}));

jest.mock('../../../../components/common/DocumentTitle/DocumentTitle', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock(
  '../../../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component',
  () => ({
    __esModule: true,
    default: ({ items }: { items: { label: string }[] }) => (
      <nav data-testid="breadcrumb">
        {items.map(({ label }) => label).join(' > ')}
      </nav>
    ),
  })
);

jest.mock('../../../../utils/platform/systemAnnouncements.utils', () => ({
  getSystemAnnouncementBreadcrumbs: (current?: string) => [
    { label: 'label.setting-plural' },
    { label: 'label.announcement-plural' },
    ...(current ? [{ label: current }] : []),
  ],
}));

jest.mock(
  '../../../../components/platform/settings/announcements/SystemAnnouncementsTable/SystemAnnouncementsTable',
  () => ({
    __esModule: true,
    default: ({
      onAdd,
      onDuplicate,
      onEdit,
    }: {
      onAdd: () => void;
      onDuplicate: (a: { id: string }) => void;
      onEdit: (a: { id: string }) => void;
    }) => (
      <div data-testid="table">
        <button onClick={onAdd}>table-add</button>
        <button onClick={() => onEdit({ id: 'a1' })}>table-edit</button>
        <button onClick={() => onDuplicate({ id: 'a1' })}>
          table-duplicate
        </button>
      </div>
    ),
  })
);

describe('SystemAnnouncementsPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockIsAiMode = false;
  });

  it('shows the list under the Notifications breadcrumb', () => {
    render(<SystemAnnouncementsPage />);

    expect(screen.getByTestId('system-announcements-page')).toBeInTheDocument();
    expect(screen.getByTestId('breadcrumb')).toHaveTextContent(
      'label.announcement-plural'
    );
    expect(screen.getByTestId('table')).toBeInTheDocument();
  });

  it('opens the add page from the header and from the empty list', () => {
    render(<SystemAnnouncementsPage />);

    fireEvent.click(screen.getByTestId('add-announcement'));
    fireEvent.click(screen.getByText('table-add'));

    expect(mockNavigate).toHaveBeenNthCalledWith(
      1,
      ROUTES.SETTINGS_ANNOUNCEMENT_ADD
    );
    expect(mockNavigate).toHaveBeenNthCalledWith(
      2,
      ROUTES.SETTINGS_ANNOUNCEMENT_ADD
    );
  });

  it('routes a row to its edit and duplicate pages by id', () => {
    render(<SystemAnnouncementsPage />);

    fireEvent.click(screen.getByText('table-edit'));
    fireEvent.click(screen.getByText('table-duplicate'));

    expect(mockNavigate).toHaveBeenNthCalledWith(
      1,
      '/settings/notifications/announcements/edit/a1'
    );
    expect(mockNavigate).toHaveBeenNthCalledWith(
      2,
      '/settings/notifications/announcements/duplicate/a1'
    );
  });

  it('renders the same page in AI mode', () => {
    mockIsAiMode = true;

    render(<SystemAnnouncementsPage />);

    expect(screen.getByTestId('table')).toBeInTheDocument();
  });
});
