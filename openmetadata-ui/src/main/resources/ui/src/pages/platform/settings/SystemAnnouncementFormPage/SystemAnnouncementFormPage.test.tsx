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
import SystemAnnouncementFormPage from './SystemAnnouncementFormPage';

const mockNavigate = jest.fn();
let mockParams: { id?: string } = {};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

jest.mock('../../../../hooks/useAppMode', () => ({
  useIsAiMode: () => false,
}));

jest.mock('../../../../components/common/DocumentTitle/DocumentTitle', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => (
    <span data-testid="document-title">{title}</span>
  ),
}));

jest.mock(
  '../../../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component',
  () => ({ __esModule: true, default: () => null })
);

jest.mock('../../../../utils/platform/systemAnnouncements.utils', () => ({
  getSystemAnnouncementBreadcrumbs: () => [],
}));

jest.mock(
  '../../../../components/platform/settings/announcements/SystemAnnouncementFormLoader/SystemAnnouncementFormLoader',
  () => ({
    __esModule: true,
    default: ({
      id,
      mode,
      onCancel,
      onSaved,
    }: {
      id?: string;
      mode: string;
      onCancel: () => void;
      onSaved: () => void;
    }) => (
      <div data-testid="loader">
        {`${mode}:${id ?? ''}`}
        <button onClick={onCancel}>cancel</button>
        <button onClick={onSaved}>saved</button>
      </div>
    ),
  })
);

describe('SystemAnnouncementFormPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockParams = {};
  });

  it.each([
    ['create', 'label.add-entity'],
    ['duplicate', 'label.add-entity'],
    ['edit', 'label.edit-entity'],
  ] as const)('titles the %s page', (mode, title) => {
    mockParams = { id: 'a1' };

    render(<SystemAnnouncementFormPage mode={mode} />);

    expect(screen.getByTestId('document-title')).toHaveTextContent(title);
    expect(screen.getByTestId('loader')).toHaveTextContent(`${mode}:a1`);
  });

  it('returns to the list on cancel and after a save', () => {
    render(<SystemAnnouncementFormPage mode="create" />);

    fireEvent.click(screen.getByText('cancel'));
    fireEvent.click(screen.getByText('saved'));

    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenNthCalledWith(
      1,
      ROUTES.SETTINGS_ANNOUNCEMENTS
    );
    expect(mockNavigate).toHaveBeenNthCalledWith(
      2,
      ROUTES.SETTINGS_ANNOUNCEMENTS
    );
  });
});
