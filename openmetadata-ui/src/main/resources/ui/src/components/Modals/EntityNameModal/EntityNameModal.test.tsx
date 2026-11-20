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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TFunction } from 'i18next';
import { MAX_NAME_LENGTH } from '../../../constants/constants';
import { getTagRenameRules } from '../../../utils/TagsPureUtils';
import EntityNameModal from './EntityNameModal.component';

const mockT = jest.fn((key: string) => key) as unknown as TFunction;

describe('EntityNameModal with the tag rename rules', () => {
  const renameTo = async (name: string) => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <EntityNameModal
        allowRename
        visible
        entity={{ name: 'NonSensitive' }}
        nameValidationRules={getTagRenameRules(mockT)}
        title="label.edit-entity"
        onCancel={jest.fn()}
        onSave={onSave}
      />
    );
    const input = await screen.findByTestId('name');
    await user.clear(input);
    await user.type(input, name);
    await user.click(screen.getByTestId('save-button'));

    return onSave;
  };

  it('saves a name as long as the entityName schema allows', async () => {
    const name = 'a'.repeat(MAX_NAME_LENGTH);

    const onSave = await renameTo(name);

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name }))
    );
  });

  it('refuses a name one character longer than the schema allows', async () => {
    const onSave = await renameTo('a'.repeat(MAX_NAME_LENGTH + 1));

    expect(
      await screen.findByText('message.entity-size-in-between')
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
