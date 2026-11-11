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
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { CustomProperty } from '../../generated/entity/type';
import {
  FieldKind,
  IntakeForm,
  TargetEntityType,
} from '../../generated/governance/intakeForm';
import { getCustomPropertiesByEntityType } from '../../rest/metadataTypeAPI';
import IntakeFormDesignerBody, {
  IntakeFormDesignerBodyHandle,
} from './IntakeFormDesignerBody';

jest.mock('../../rest/metadataTypeAPI', () => ({
  getCustomPropertiesByEntityType: jest.fn(),
}));

jest.mock('../../components/common/Loader/Loader', () => () => (
  <div data-testid="loader" />
));

const initialValue = {
  id: 'form-1',
  name: 'domain',
  entityType: TargetEntityType.Domain,
  enabled: false,
  formFields: [
    {
      fieldPath: 'displayName',
      fieldKind: FieldKind.Native,
      fieldLabel: 'Display Name',
      required: true,
    },
  ],
} as unknown as IntakeForm;

describe('IntakeFormDesignerBody', () => {
  it('keeps what was typed when the custom properties load afterwards', async () => {
    let loadProperties: (properties: CustomProperty[]) => void = jest.fn();
    (getCustomPropertiesByEntityType as jest.Mock).mockReturnValue(
      new Promise<CustomProperty[]>((resolve) => {
        loadProperties = resolve;
      })
    );
    const onSubmit = jest.fn();
    const ref = createRef<IntakeFormDesignerBodyHandle>();
    render(
      <IntakeFormDesignerBody
        open
        entityType={TargetEntityType.Domain}
        initialValue={initialValue}
        ref={ref}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(
      within(screen.getByTestId('error-displayName')).getByRole('textbox'),
      { target: { value: 'A business name is required' } }
    );
    await act(async () => loadProperties([]));
    await act(async () => ref.current?.submit());

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        formFields: expect.arrayContaining([
          expect.objectContaining({
            fieldPath: 'displayName',
            errorMessage: 'A business name is required',
          }),
        ]),
      })
    );
  });
});
