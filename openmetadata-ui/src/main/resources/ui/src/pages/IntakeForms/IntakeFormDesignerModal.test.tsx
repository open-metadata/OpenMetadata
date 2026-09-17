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
import { CustomProperty } from '../../generated/entity/type';
import { TargetEntityType } from '../../generated/governance/intakeForm';
import { getCustomPropertiesByEntityType } from '../../rest/metadataTypeAPI';
import IntakeFormDesignerModal from './IntakeFormDesignerModal';

const mockTranslate = (key: string) => key;
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));
jest.mock('../../rest/metadataTypeAPI', () => ({
  getCustomPropertiesByEntityType: jest.fn(),
}));
jest.mock('../../rest/workflowDefinitionsAPI', () => ({
  getWorkflowDefinitions: jest.fn().mockResolvedValue({
    data: [],
    paging: { total: 0 },
  }),
}));

it('waits for the complete field catalog before allowing selection or publication', async () => {
  let resolveProperties: ((properties: CustomProperty[]) => void) | undefined;
  (getCustomPropertiesByEntityType as jest.Mock).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveProperties = resolve;
      })
  );
  render(
    <IntakeFormDesignerModal
      open
      entityType={TargetEntityType.DataProduct}
      initialValue={null}
      onCancel={jest.fn()}
      onSubmit={jest.fn().mockResolvedValue(undefined)}
    />
  );
  const picker = screen.getByRole('button', { name: /label\.field/ });

  expect(picker).toBeDisabled();
  expect(screen.getByTestId('intake-form-submit')).toBeDisabled();

  await act(async () => {
    resolveProperties?.([
      {
        name: 'reviewReason',
        description: 'Reason for publishing the asset',
        propertyType: { id: 'string', type: 'type', name: 'string' },
      },
    ]);
  });

  expect(picker).toBeEnabled();
  expect(screen.getByTestId('intake-form-submit')).toBeEnabled();

  fireEvent.click(picker);

  expect(
    await screen.findByRole('option', { name: 'reviewReason' })
  ).toBeVisible();
});

it('protects configuration changes when the builder is dismissed', async () => {
  (getCustomPropertiesByEntityType as jest.Mock).mockResolvedValue([]);
  const cancel = jest.fn();
  await act(async () =>
    render(
      <IntakeFormDesignerModal
        open
        entityType={TargetEntityType.Metric}
        initialValue={null}
        onCancel={cancel}
        onSubmit={async () => undefined}
      />
    )
  );
  fireEvent.change(screen.getByRole('textbox', { name: /label.description/ }), {
    target: { value: 'Unpublished requirements' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'label.continue-editing' })
  );

  expect(
    screen.getByRole('textbox', { name: /label.description/ })
  ).toHaveValue('Unpublished requirements');
  expect(cancel).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));
  fireEvent.click(await screen.findByRole('button', { name: 'label.discard' }));

  expect(cancel).toHaveBeenCalledTimes(1);
});
