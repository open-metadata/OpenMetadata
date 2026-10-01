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
import { CustomProperty } from '../../../generated/type/customProperty';
import CustomPropertiesListTable from './CustomPropertiesListTable';

const property: CustomProperty = {
  name: 'owner',
  description: 'Owning team',
  propertyType: { id: 'string', type: 'type', name: 'string' },
};

const secondProperty: CustomProperty = {
  name: 'retention',
  displayName: 'Retention Period',
  description: 'How long data is kept',
  propertyType: { id: 'integer', type: 'type', name: 'integer' },
};

const baseProps = {
  customProperties: [property, secondProperty],
  isLoading: false,
  emptyText: <p>empty</p>,
  onEdit: jest.fn(),
  onDelete: jest.fn(),
};

describe('CustomPropertiesListTable', () => {
  it('offers only the edit action when delete is not allowed', async () => {
    render(
      <CustomPropertiesListTable {...baseProps} canEdit canDelete={false} />
    );

    fireEvent.click(screen.getAllByTestId('property-actions')[0]);
    const item = await screen.findByRole('menuitem', { name: 'label.edit' });

    expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();

    fireEvent.click(item);

    expect(baseProps.onEdit).toHaveBeenCalledWith(property);
  });

  it('offers only the delete action when edit is not allowed', async () => {
    render(
      <CustomPropertiesListTable {...baseProps} canDelete canEdit={false} />
    );

    fireEvent.click(screen.getAllByTestId('property-actions')[0]);
    const item = await screen.findByTestId('delete-button');

    expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();

    fireEvent.click(item);

    expect(baseProps.onDelete).toHaveBeenCalledWith(property);
  });

  it('uses the given test id and empty text', () => {
    render(
      <CustomPropertiesListTable
        {...baseProps}
        canDelete
        canEdit
        customProperties={[]}
        data-testid="custom-property-table"
      />
    );

    expect(screen.getByTestId('custom-property-table')).toBeInTheDocument();
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('filters rows by name or display name and shows a search empty state', async () => {
    jest.useFakeTimers();
    render(<CustomPropertiesListTable {...baseProps} canDelete canEdit />);

    const search = screen.getByTestId('custom-property-search');

    fireEvent.change(search, { target: { value: 'retention period' } });
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(
      screen.getAllByTestId('property-name').map((el) => el.textContent)
    ).toEqual(['Retention Period']);

    fireEvent.change(search, { target: { value: 'nothing-matches' } });
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(screen.queryByTestId('property-name')).not.toBeInTheDocument();
    expect(
      screen.getByText('message.try-adjusting-filter')
    ).toBeInTheDocument();
    expect(screen.queryByText('empty')).not.toBeInTheDocument();

    jest.useRealTimers();
  });

  it('filters rows by the picked types and lists only types in use', async () => {
    render(<CustomPropertiesListTable {...baseProps} canDelete canEdit />);

    fireEvent.click(screen.getByTestId('custom-property-type-filter'));

    expect(
      (await screen.findAllByRole('menuitemcheckbox')).map((item) =>
        item.getAttribute('data-testid')
      )
    ).toEqual(['integer', 'string']);

    fireEvent.click(screen.getByTestId('integer'));

    expect(
      screen.getAllByTestId('property-name').map((el) => el.textContent)
    ).toEqual(['Retention Period']);

    fireEvent.click(screen.getByTestId('string'));

    expect(screen.getAllByTestId('property-name')).toHaveLength(2);
  });
});
