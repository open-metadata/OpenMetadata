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
import { EntityType } from '../../../enums/entity.enum';
import { getTypeByFQN } from '../../../rest/metadataTypeAPI';
import { ModalWithCustomPropertyEditor } from './ModalWithCustomPropertyEditor.component';

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../rest/metadataTypeAPI', () => ({
  getTypeByFQN: jest.fn(),
}));

jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: () => null,
}));

// The provider hands the table its `onUpdate`; drive that directly.
jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: ({
    onUpdate,
  }: {
    onUpdate: (data: { extension: Record<string, string> }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onUpdate({ extension: { owner: 'team-a' } })}>
      edit-property
    </button>
  ),
}));

const renderModal = () =>
  render(
    <ModalWithCustomPropertyEditor
      visible
      entityType={EntityType.GLOSSARY_TERM}
      header="Edit CustomProperty"
      value=""
      onCancel={jest.fn()}
      onSave={jest.fn()}
    />
  );

describe('ModalWithCustomPropertyEditor', () => {
  it('shows an empty state and keeps Save disabled when the type has no custom properties', async () => {
    (getTypeByFQN as jest.Mock).mockResolvedValue({ customProperties: [] });

    renderModal();

    expect(
      await screen.findByText('label.no-custom-properties-defined')
    ).toBeInTheDocument();
    expect(screen.getByTestId('save')).toBeDisabled();
    expect(screen.getByTestId('cancel')).toBeEnabled();
  });

  it('does not claim the type has no custom properties when loading it fails', async () => {
    (getTypeByFQN as jest.Mock).mockRejectedValue(new Error('network'));

    renderModal();

    expect(await screen.findByTestId('save')).toBeDisabled();
    expect(
      screen.queryByText('label.no-custom-properties-defined')
    ).not.toBeInTheDocument();
  });

  it('enables Save only after a custom property value changes', async () => {
    (getTypeByFQN as jest.Mock).mockResolvedValue({
      customProperties: [{ name: 'owner', propertyType: { name: 'string' } }],
    });

    renderModal();

    const edit = await screen.findByRole('button', { name: 'edit-property' });

    expect(screen.getByTestId('save')).toBeDisabled();

    fireEvent.click(edit);

    expect(screen.getByTestId('save')).toBeEnabled();
  });
});
