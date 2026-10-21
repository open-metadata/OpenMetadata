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
  useTranslation: () => ({ t: (key: string) => key }),
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

describe('UserDescriptionRow', () => {
  it('shows the placeholder, then saves a changed description', async () => {
    const updateUserDetails = jest.fn().mockResolvedValue(undefined);
    render(
      <UserDescriptionRow
        canEdit
        updateUserDetails={updateUserDetails}
        userData={{ id: 'u1', name: 'jane' } as User}
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
  });
});
