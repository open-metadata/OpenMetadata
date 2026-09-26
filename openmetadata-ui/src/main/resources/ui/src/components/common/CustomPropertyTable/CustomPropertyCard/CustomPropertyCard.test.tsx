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
import { CustomProperty } from '../../../../generated/type/customProperty';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { CustomPropertyCard } from './CustomPropertyCard';

const createProperty = (
  typeName: string,
  overrides: Partial<CustomProperty> = {}
): CustomProperty => ({
  name: 'ownerTeam',
  displayName: 'Owner Team',
  description: 'Team accountable for this asset.',
  propertyType: { id: `${typeName}-id`, name: typeName, type: 'type' },
  ...overrides,
});

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const renderCard = (
  props: Partial<Parameters<typeof CustomPropertyCard>[0]> = {}
) => {
  const onValueSave = jest.fn().mockResolvedValue(undefined);

  render(
    <CustomPropertyCard
      hasEditPermissions
      property={createProperty('string')}
      value="Data Platform"
      onValueSave={onValueSave}
      {...props}
    />
  );

  return { onValueSave };
};

describe('CustomPropertyCard', () => {
  it('shows the name, type, description and value', () => {
    renderCard();

    expect(screen.getByTestId('custom-property-ownerTeam-card')).toBeVisible();
    expect(screen.getByTestId('property-name')).toHaveTextContent('Owner Team');
    expect(screen.getByTestId('property-type-badge')).toHaveTextContent(
      'label.string'
    );
    expect(
      screen.getByText('Team accountable for this asset.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('value')).toHaveTextContent('Data Platform');
  });

  it('saves the edited value and closes the editor', async () => {
    const { onValueSave } = renderCard();

    await user.click(screen.getByTestId('edit-icon'));
    const input = screen.getByTestId('value-input');
    await user.clear(input);
    await user.type(input, 'Data Engineering');
    await user.click(screen.getByTestId('inline-save-btn'));

    expect(onValueSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ownerTeam' }),
      'Data Engineering'
    );

    await waitFor(() =>
      expect(screen.queryByTestId('value-input')).not.toBeInTheDocument()
    );
  });

  it('saves when Enter is pressed in the input', async () => {
    const { onValueSave } = renderCard();

    await user.click(screen.getByTestId('edit-icon'));
    await user.type(screen.getByTestId('value-input'), ' Team{Enter}');

    expect(onValueSave).toHaveBeenCalledWith(
      expect.anything(),
      'Data Platform Team'
    );
  });

  it('discards changes on cancel', async () => {
    const { onValueSave } = renderCard();

    await user.click(screen.getByTestId('edit-icon'));
    await user.type(screen.getByTestId('value-input'), 'x');
    await user.click(screen.getByTestId('inline-cancel-btn'));

    expect(onValueSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('value')).toHaveTextContent('Data Platform');
  });

  it('keeps the editor open and shows a toast when saving fails', async () => {
    const error = new Error('boom');
    const onValueSave = jest.fn().mockRejectedValue(error);
    renderCard({ onValueSave });

    await user.click(screen.getByTestId('edit-icon'));
    await user.click(screen.getByTestId('inline-save-btn'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    expect(screen.getByTestId('value-input')).toBeInTheDocument();
  });

  it('shows the empty state with an add action when there is no value', async () => {
    const { onValueSave } = renderCard({ value: undefined });

    expect(screen.getByTestId('no-data')).toHaveTextContent(
      'label.no-value-yet'
    );
    expect(screen.getByTestId('edit-icon')).toHaveTextContent(
      'label.set-value'
    );

    await user.click(screen.getByTestId('edit-icon'));
    await user.type(screen.getByTestId('value-input'), 'New{Enter}');

    expect(onValueSave).toHaveBeenCalledWith(expect.anything(), 'New');
  });

  it('hides edit controls without edit permission', () => {
    renderCard({ hasEditPermissions: false });

    expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();

    renderCard({ hasEditPermissions: false, value: undefined });

    expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
  });

  it('blocks an invalid email and shows the validation message', async () => {
    const { onValueSave } = renderCard({
      property: createProperty('email'),
      value: 'priya@acme.com',
    });

    await user.click(screen.getByTestId('edit-icon'));
    const input = screen.getByTestId('email-input');
    await user.clear(input);
    await user.type(input, 'not-an-email{Enter}');

    expect(onValueSave).not.toHaveBeenCalled();
    expect(screen.getByText('message.email-is-invalid')).toBeInTheDocument();
  });

  it('saves a timestamp as a number', async () => {
    const { onValueSave } = renderCard({
      property: createProperty('timestamp'),
      value: undefined,
    });

    await user.click(screen.getByTestId('edit-icon'));
    await user.type(
      screen.getByTestId('timestamp-input'),
      '1758542400000{Enter}'
    );

    expect(onValueSave).toHaveBeenCalledWith(expect.anything(), 1758542400000);
  });

  it('edits an existing value in an Edit modal and closes it on cancel', async () => {
    renderCard();

    await user.click(screen.getByTestId('edit-icon'));
    const modal = screen.getByTestId('custom-property-edit-modal');

    expect(modal).toHaveTextContent('label.edit-entity');

    await user.click(screen.getByTestId('inline-cancel-btn'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('custom-property-edit-modal')
      ).not.toBeInTheDocument()
    );
  });

  it('opens a Set modal for a property without a value', async () => {
    renderCard({ value: undefined });

    await user.click(screen.getByTestId('edit-icon'));

    expect(screen.getByTestId('custom-property-edit-modal')).toHaveTextContent(
      'label.set-entity'
    );
  });
});
