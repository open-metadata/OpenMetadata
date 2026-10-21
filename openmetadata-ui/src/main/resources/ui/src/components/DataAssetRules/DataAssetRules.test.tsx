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
import { AddEditSemanticsRuleModal } from './DataAssetRules.component';

jest.mock(
  '../common/Form/JSONSchema/JsonSchemaWidgets/QueryBuilderWidget/QueryBuilderWidget',
  () => jest.fn(() => <div data-testid="query-builder" />)
);

jest.mock('../../utils/JSONLogicSearchClassBase', () => ({
  getMapFields: jest.fn(() => ({})),
}));

const rule = {
  name: 'Tiered',
  description: 'Assets must have a tier',
  enabled: true,
  rule: '{"!!":{"var":"tier"}}',
};

const renderModal = (onSave = jest.fn()) => {
  render(
    <AddEditSemanticsRuleModal
      otherSemanticsRules={[{ ...rule, name: 'Owned' }]}
      semanticsRule={rule}
      onCancel={jest.fn()}
      onSave={onSave}
    />
  );

  return onSave;
};

describe('AddEditSemanticsRuleModal', () => {
  it('saves the edited rule with its previous name', async () => {
    const onSave = renderModal();

    fireEvent.change(screen.getByDisplayValue('Tiered'), {
      target: { value: 'Tiered assets' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('label.save'));
    });

    expect(onSave).toHaveBeenCalledWith(
      { ...rule, name: 'Tiered assets' },
      'Tiered'
    );
  });

  it('rejects a name another rule already uses', async () => {
    const onSave = renderModal();

    fireEvent.change(screen.getByDisplayValue('Tiered'), {
      target: { value: 'Owned' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('label.save'));
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('message.name-already-exists')).toBeInTheDocument();
  });
});
