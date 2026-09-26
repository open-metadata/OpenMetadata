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
import { Column, DataType } from '../../../generated/entity/data/table';
import { CustomProperty } from '../../../generated/type/customProperty';
import { PropertyValue } from '../../common/CustomPropertyTable/PropertyValue';
import { ColumnCustomPropertyCell } from './ColumnCustomPropertyCell';

jest.mock('../../common/CustomPropertyTable/PropertyValue', () => ({
  PropertyValue: jest
    .fn()
    .mockImplementation(({ onExtensionUpdate, extension }) => (
      <button
        data-testid="mock-property-value"
        onClick={() => onExtensionUpdate({ ...extension, owner: 'new' })}>
        PropertyValue
      </button>
    )),
}));

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

describe('ColumnCustomPropertyCell', () => {
  it('renders PropertyValue without its label, using the record extension', () => {
    render(
      <ColumnCustomPropertyCell
        hasEditPermissions
        property={property}
        record={record}
        onExtensionUpdate={jest.fn()}
      />
    );

    expect(screen.getByTestId('mock-property-value')).toBeInTheDocument();
    expect(PropertyValue).toHaveBeenCalledWith(
      expect.objectContaining({
        hideLabel: true,
        isRenderedInRightPanel: true,
        hasEditPermissions: true,
        property,
        extension: record.extension,
      }),
      expect.anything()
    );
  });

  it('forwards extension updates together with the row record', async () => {
    const onExtensionUpdate = jest.fn().mockResolvedValue(undefined);

    render(
      <ColumnCustomPropertyCell
        hasEditPermissions
        property={property}
        record={record}
        onExtensionUpdate={onExtensionUpdate}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-property-value'));
    });

    expect(onExtensionUpdate).toHaveBeenCalledWith(record, {
      owner: 'new',
      other: 1,
    });
  });

  it('passes read-only permission through', () => {
    render(
      <ColumnCustomPropertyCell
        hasEditPermissions={false}
        property={property}
        record={record}
        onExtensionUpdate={jest.fn()}
      />
    );

    expect(PropertyValue).toHaveBeenCalledWith(
      expect.objectContaining({ hasEditPermissions: false }),
      expect.anything()
    );
  });
});
