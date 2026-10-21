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
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import {
  AnnouncementColor,
  AnnouncementType,
} from '../../../../../generated/entity/feed/announcement';
import {
  AnnouncementEntity,
  createAnnouncement,
  patchAnnouncement,
} from '../../../../../rest/announcementsAPI';
import { renderWithQueryClient } from '../../../../../test/unit/test-utils';
import SystemAnnouncementForm from './SystemAnnouncementForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { entity?: string }) =>
      key === 'label.entity-copy' ? `${options?.entity} (copy)` : key,
  }),
}));

jest.mock('../../../../../rest/announcementsAPI', () => ({
  createAnnouncement: jest.fn(),
  patchAnnouncement: jest.fn(),
}));

jest.mock('../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { name: 'admin' } }),
}));

// The block editor is a boundary here: the form only needs its text out.
jest.mock('../../../../common/RichTextEditor/RichTextEditor', () => ({
  __esModule: true,
  default: ({
    initialValue,
    onTextChange,
  }: {
    initialValue?: string;
    onTextChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="description"
      data-testid="description-editor"
      defaultValue={initialValue}
      onChange={(e) => onTextChange(e.target.value)}
    />
  ),
}));

jest.mock(
  '../../../../common/AnnouncementsWidget/AnnouncementBanner.component',
  () => ({
    __esModule: true,
    default: ({ announcement }: { announcement: AnnouncementEntity }) => (
      <div data-testid="preview-banner">{announcement.displayName}</div>
    ),
  })
);

const DAY = 86_400_000;
const start = Date.now() + DAY;

const stored: AnnouncementEntity = {
  id: 'a1',
  name: 'announcement-a1',
  displayName: 'Planned maintenance',
  description: 'Search is read-only for an hour.',
  startTime: start,
  endTime: start + DAY,
  type: AnnouncementType.Warning,
  createdBy: 'priya',
};

const submit = async () => {
  await waitFor(() =>
    expect(screen.getByTestId('announcement-submit')).toBeEnabled()
  );
  await act(async () => {
    fireEvent.click(screen.getByTestId('announcement-submit'));
  });
};

describe('SystemAnnouncementForm', () => {
  const onCancel = jest.fn();
  const onSaved = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (createAnnouncement as jest.Mock).mockResolvedValue({
      ...stored,
      id: 'new',
    });
    (patchAnnouncement as jest.Mock).mockResolvedValue(stored);
  });

  it('starts empty with submit blocked, and previews the title as it is typed', async () => {
    renderWithQueryClient(
      <SystemAnnouncementForm
        mode="create"
        onCancel={onCancel}
        onSaved={onSaved}
      />
    );

    expect(screen.getByTestId('announcement-submit')).toBeDisabled();
    expect(screen.getByTestId('preview-banner')).toHaveTextContent(
      'label.announcement-title'
    );
    // No window yet, so no status to derive.
    expect(
      screen.queryByTestId('announcement-preview-status')
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/label\.title/), {
        target: { value: 'Release 1.10 is live' },
      });
    });

    expect(screen.getByTestId('preview-banner')).toHaveTextContent(
      'Release 1.10 is live'
    );
  });

  it('asks for a name and a colour only for a Custom announcement', async () => {
    renderWithQueryClient(
      <SystemAnnouncementForm
        mode="create"
        onCancel={onCancel}
        onSaved={onSaved}
      />
    );

    expect(screen.queryByTestId('custom-type-name')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`announcement-type-${AnnouncementType.Custom}`)
      );
    });

    expect(screen.getByTestId('custom-type-name')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-color-select')).toBeInTheDocument();
  });

  it('saves a duplicate as a new system announcement with no entity link', async () => {
    renderWithQueryClient(
      <SystemAnnouncementForm
        announcement={stored}
        mode="duplicate"
        onCancel={onCancel}
        onSaved={onSaved}
      />
    );

    expect(screen.getByLabelText(/label\.title/)).toHaveValue(
      'Planned maintenance (copy)'
    );
    // The window is in the future, so it would go live later.
    expect(screen.getByTestId('announcement-preview-status')).toHaveTextContent(
      'label.scheduled'
    );

    await submit();

    expect(patchAnnouncement).not.toHaveBeenCalled();

    const [request] = (createAnnouncement as jest.Mock).mock.calls[0];

    expect(request).toEqual({
      displayName: 'Planned maintenance (copy)',
      description: 'Search is read-only for an hour.',
      startTime: stored.startTime,
      endTime: stored.endTime,
      type: AnnouncementType.Warning,
      color: undefined,
      customTypeName: undefined,
    });
    expect(request).not.toHaveProperty('entityLink');

    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new' })
      )
    );
  });

  it('patches only what changed when editing', async () => {
    renderWithQueryClient(
      <SystemAnnouncementForm
        announcement={stored}
        mode="edit"
        onCancel={onCancel}
        onSaved={onSaved}
      />
    );

    expect(screen.getByTestId('announcement-submit')).toHaveTextContent(
      'label.save-changes'
    );

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/label\.title/), {
        target: { value: 'Maintenance moved' },
      });
    });
    await submit();

    expect(createAnnouncement).not.toHaveBeenCalled();
    expect(patchAnnouncement).toHaveBeenCalledWith('a1', [
      { op: 'replace', path: '/displayName', value: 'Maintenance moved' },
    ]);
  });

  it('drops the colour and name when an edit leaves Custom', async () => {
    renderWithQueryClient(
      <SystemAnnouncementForm
        announcement={{
          ...stored,
          type: AnnouncementType.Custom,
          color: AnnouncementColor.Pink,
          customTypeName: 'Town hall',
        }}
        mode="edit"
        onCancel={onCancel}
        onSaved={onSaved}
      />
    );

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`announcement-type-${AnnouncementType.Notice}`)
      );
    });
    await submit();

    expect(patchAnnouncement).toHaveBeenCalledWith(
      'a1',
      expect.arrayContaining([
        { op: 'remove', path: '/color' },
        { op: 'remove', path: '/customTypeName' },
        { op: 'replace', path: '/type', value: AnnouncementType.Notice },
      ])
    );
  });

  it('leaves without saving on Cancel', () => {
    renderWithQueryClient(
      <SystemAnnouncementForm
        mode="create"
        onCancel={onCancel}
        onSaved={onSaved}
      />
    );

    fireEvent.click(screen.getByTestId('announcement-cancel'));

    expect(onCancel).toHaveBeenCalled();
    expect(createAnnouncement).not.toHaveBeenCalled();
  });
});
