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
import { CustomPropertyListItem } from './CustomPropertyListItem';

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const createProperty = (typeName: string): CustomProperty => ({
  name: 'ownerTeam',
  displayName: 'Owner Team',
  description: '',
  propertyType: { id: `${typeName}-id`, name: typeName, type: 'type' },
});

const renderItem = (
  props: Partial<Parameters<typeof CustomPropertyListItem>[0]> = {}
) => {
  const onValueSave = jest.fn().mockResolvedValue(undefined);

  render(
    <ul>
      <CustomPropertyListItem
        hasEditPermissions
        property={createProperty('string')}
        value="Data Platform"
        onValueSave={onValueSave}
        {...props}
      />
    </ul>
  );

  return { onValueSave };
};

describe('CustomPropertyListItem', () => {
  it('shows the name, type and value summary of the property', () => {
    renderItem({
      property: createProperty('sqlQuery'),
      value: 'SELECT 1\nFROM dual',
    });

    expect(screen.getByTestId('custom-property-ownerTeam-row')).toBeVisible();
    expect(screen.getByTestId('property-name')).toHaveTextContent('Owner Team');
    expect(screen.getByTestId('property-value')).toHaveTextContent(
      'label.count-line-plural'
    );
    expect(screen.getByText('label.sql-uppercase')).toBeInTheDocument();
  });

  it('shows "not set" for an empty value', () => {
    renderItem({ value: undefined });

    expect(screen.getByTestId('property-value')).toHaveTextContent(
      'label.not-set'
    );
    expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
  });

  it('renders a one-bound timeInterval value as plain text without crashing', () => {
    renderItem({
      hasEditPermissions: false,
      property: createProperty('timeInterval'),
      value: { start: 100 },
    });

    expect(
      screen.getByTestId('custom-property-ownerTeam-row')
    ).toBeInTheDocument();
    expect(screen.getByTestId('property-value')).toHaveTextContent('100');
    expect(screen.getByTestId('property-value')).not.toHaveTextContent(
      /0 minutes/i
    );
  });

  it('renders a null-bound timeInterval value as plain text without "0 minutes"', () => {
    renderItem({
      hasEditPermissions: false,
      property: createProperty('timeInterval'),
      value: { start: 100, end: null },
    });

    expect(
      screen.getByTestId('custom-property-ownerTeam-row')
    ).toBeInTheDocument();
    expect(screen.getByTestId('property-value')).toHaveTextContent('100');
    expect(screen.getByTestId('property-value')).not.toHaveTextContent(
      /0 minutes/i
    );
  });

  it('renders the extra actions after the type badge', () => {
    renderItem({
      actions: (
        <button aria-label="layout-action" data-testid="layout-action" />
      ),
    });

    expect(screen.getByTestId('layout-action')).toBeInTheDocument();
  });

  it('has no edit button without edit permission', () => {
    renderItem({ hasEditPermissions: false });

    expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
  });

  it('saves the edited value and closes the editor', async () => {
    const { onValueSave } = renderItem();

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
      expect(
        screen.queryByTestId('custom-property-edit-modal')
      ).not.toBeInTheDocument()
    );
  });

  it('keeps the editor open and shows a toast when saving fails', async () => {
    const error = new Error('boom');
    renderItem({ onValueSave: jest.fn().mockRejectedValue(error) });

    await user.click(screen.getByTestId('edit-icon'));
    await user.click(screen.getByTestId('inline-save-btn'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    expect(
      screen.getByTestId('custom-property-edit-modal')
    ).toBeInTheDocument();
  });

  it('closes the editor on cancel without saving', async () => {
    const { onValueSave } = renderItem();

    await user.click(screen.getByTestId('edit-icon'));
    await user.click(screen.getByTestId('inline-cancel-btn'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('custom-property-edit-modal')
      ).not.toBeInTheDocument()
    );

    expect(onValueSave).not.toHaveBeenCalled();
  });
});
