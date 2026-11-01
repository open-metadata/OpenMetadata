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
import { Column, DataType } from '../../../generated/entity/data/table';
import { CustomProperty } from '../../../generated/type/customProperty';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  ColumnCustomPropertyCell,
  ColumnCustomPropertyCellProps,
} from './ColumnCustomPropertyCell';

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const property: CustomProperty = {
  name: 'owner',
  displayName: 'Owner',
  description: 'Business owner',
  propertyType: {
    id: 'string-type-id',
    type: 'type',
    name: 'string',
  },
};

const record: Column = {
  name: 'amount',
  dataType: DataType.Numeric,
  fullyQualifiedName: 'svc.db.schema.table.amount',
  extension: { owner: 'old', other: 1 },
};

const renderCell = (props: Partial<ColumnCustomPropertyCellProps> = {}) => {
  const onExtensionUpdate = jest.fn().mockResolvedValue(undefined);

  render(
    <ColumnCustomPropertyCell
      hasEditPermissions
      property={property}
      record={record}
      onExtensionUpdate={onExtensionUpdate}
      {...props}
    />
  );

  return { onExtensionUpdate };
};

describe('ColumnCustomPropertyCell', () => {
  it('renders the record value without the property label', () => {
    renderCell();

    expect(screen.getByTestId('owner')).toBeInTheDocument();
    expect(screen.getByTestId('property-value')).toHaveTextContent('old');
    expect(screen.queryByTestId('property-name')).not.toBeInTheDocument();
    expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
  });

  it('shows "not set" when the record has no value for the property', () => {
    renderCell({ record: { ...record, extension: undefined } });

    expect(screen.getByTestId('property-value')).toHaveTextContent(
      'label.not-set'
    );
  });

  it('has no edit button without edit permission', () => {
    renderCell({ hasEditPermissions: false });

    expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
  });

  it('merges the edited value into the record extension and closes the editor', async () => {
    const { onExtensionUpdate } = renderCell();

    await user.click(screen.getByTestId('edit-icon'));
    const input = screen.getByTestId('value-input');
    await user.clear(input);
    await user.type(input, 'new');
    await user.click(screen.getByTestId('inline-save-btn'));

    expect(onExtensionUpdate).toHaveBeenCalledWith(record, {
      owner: 'new',
      other: 1,
    });

    await waitFor(() =>
      expect(
        screen.queryByTestId('custom-property-edit-modal')
      ).not.toBeInTheDocument()
    );
  });

  it('keeps the editor open and shows a toast when saving fails', async () => {
    const error = new Error('boom');
    renderCell({ onExtensionUpdate: jest.fn().mockRejectedValue(error) });

    await user.click(screen.getByTestId('edit-icon'));
    await user.click(screen.getByTestId('inline-save-btn'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    expect(
      screen.getByTestId('custom-property-edit-modal')
    ).toBeInTheDocument();
  });
});
