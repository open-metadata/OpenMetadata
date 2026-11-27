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
import { Button } from '@openmetadata/ui-core-components';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomProperty } from '../../../generated/type/customProperty';
import { CustomPropertyEditModalProps } from '../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyEditModal.interface';
import HeaderCustomPropertyEditor from './HeaderCustomPropertyEditor';

const mockOnPropertyValueSave = jest.fn().mockResolvedValue(undefined);
const mockShowErrorToast = jest.fn();

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
}));

jest.mock(
  '../../common/CustomPropertyTable/useCustomPropertyValueSave',
  () => ({
    useCustomPropertyValueSave: () => ({
      onPropertyValueSave: mockOnPropertyValueSave,
    }),
  })
);

jest.mock(
  '../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyEditModal',
  () => ({
    CustomPropertyEditModal: ({
      isNewValue,
      onSave,
    }: CustomPropertyEditModalProps) => (
      <button data-testid="save-value" onClick={() => onSave('Karan')}>
        {isNewValue ? 'set' : 'edit'}
      </button>
    ),
  })
);

const property = {
  name: 'steward',
  displayName: 'Data Steward',
  propertyType: { id: 'id', type: 'type', name: 'string' },
} as CustomProperty;

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

describe('HeaderCustomPropertyEditor', () => {
  it('opens the editor from its trigger and saves through the entity update', async () => {
    render(
      <HeaderCustomPropertyEditor property={property} value={undefined}>
        <Button data-testid="open-editor">add</Button>
      </HeaderCustomPropertyEditor>
    );

    expect(screen.queryByTestId('save-value')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('open-editor'));

    expect(screen.getByTestId('save-value')).toHaveTextContent('set');

    await user.click(screen.getByTestId('save-value'));

    expect(mockOnPropertyValueSave).toHaveBeenCalledWith(property, 'Karan');
    expect(screen.queryByTestId('save-value')).not.toBeInTheDocument();
  });

  it('keeps the editor open and reports the error when the save fails', async () => {
    const error = new Error('save failed');
    mockOnPropertyValueSave.mockRejectedValueOnce(error);
    render(
      <HeaderCustomPropertyEditor property={property} value="Anika">
        <Button data-testid="open-editor">edit</Button>
      </HeaderCustomPropertyEditor>
    );

    await user.click(screen.getByTestId('open-editor'));
    await user.click(screen.getByTestId('save-value'));

    expect(mockShowErrorToast).toHaveBeenCalledWith(error);
    expect(screen.getByTestId('save-value')).toHaveTextContent('edit');
  });
});
