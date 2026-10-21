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
import AnnouncementDeleteDialog from './AnnouncementDeleteDialog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('AnnouncementDeleteDialog', () => {
  it('deletes only on confirm, and cancels from the button or Escape', () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();

    render(
      <AnnouncementDeleteDialog
        isOpen
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByTestId('cancel'));
    fireEvent.keyDown(screen.getByTestId('announcement-delete-confirm'), {
      key: 'Escape',
    });

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('save-button'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while closed', () => {
    render(
      <AnnouncementDeleteDialog
        isOpen={false}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('announcement-delete-confirm')
    ).not.toBeInTheDocument();
  });
});
