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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { User } from '../../../../../generated/entity/teams/user';
import UserDescriptionRow from './UserDescriptionRow';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) =>
      opts?.name ? `${key}:${opts.name}` : key,
  }),
}));

jest.mock('../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { name: 'harsh' } }),
}));

jest.mock(
  '../../../../common/RichTextEditor/RichTextEditor',
  () =>
    ({
      initialValue,
      onTextChange,
    }: {
      initialValue?: string;
      onTextChange: (value: string) => void;
    }) =>
      (
        <textarea
          aria-label="description"
          data-testid="editor"
          defaultValue={initialValue}
          onChange={(e) => onTextChange(e.target.value)}
        />
      )
);

jest.mock(
  '../../../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () =>
    ({ markdown }: { markdown: string }) =>
      <div data-testid="preview">{markdown}</div>
);

const JANE = { id: 'u1', name: 'jane' } as User;

describe('UserDescriptionRow', () => {
  it('shows the placeholder, then saves a changed description', async () => {
    const updateUserDetails = jest.fn().mockResolvedValue(true);
    render(
      <UserDescriptionRow
        canEdit
        updateUserDetails={updateUserDetails}
        userData={JANE}
      />
    );

    expect(screen.getByTestId('user-description')).toHaveTextContent(
      'label.no-description'
    );

    fireEvent.click(screen.getByTestId('user-description-edit'));

    expect(screen.getByTestId('user-description-save')).toBeDisabled();

    fireEvent.change(screen.getByTestId('editor'), {
      target: { value: 'Data steward for sales' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('user-description-save'));
    });

    expect(updateUserDetails).toHaveBeenCalledWith(
      { description: 'Data steward for sales' },
      'description'
    );
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument();
  });

  it('keeps the editor open with the draft when the save fails', async () => {
    render(
      <UserDescriptionRow
        canEdit
        updateUserDetails={jest.fn().mockResolvedValue(false)}
        userData={JANE}
      />
    );

    fireEvent.click(screen.getByTestId('user-description-edit'));
    fireEvent.change(screen.getByTestId('editor'), {
      target: { value: 'Unsaved draft' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('user-description-save'));
    });

    expect(screen.getByTestId('editor')).toHaveValue('Unsaved draft');
  });

  it('shows another user’s description read-only, in third person', () => {
    render(
      <UserDescriptionRow
        canEdit={false}
        updateUserDetails={jest.fn()}
        userData={{ ...JANE, description: 'Owns billing' }}
      />
    );

    expect(screen.getByTestId('preview')).toHaveTextContent('Owns billing');
    expect(screen.getByTestId('user-description')).toHaveTextContent(
      'message.user-description-description'
    );
    expect(
      screen.queryByTestId('user-description-edit')
    ).not.toBeInTheDocument();
  });
});
