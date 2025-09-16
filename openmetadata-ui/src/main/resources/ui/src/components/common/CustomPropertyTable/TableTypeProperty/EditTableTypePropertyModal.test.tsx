/*
 *  Copyright 2025 Collate.
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
import '@testing-library/jest-dom/extend-expect';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { CustomProperty } from '../../../../generated/type/customProperty';
import EditTableTypePropertyModal from './EditTableTypePropertyModal';
import { EditTableTypePropertyModalProps } from './EditTableTypePropertyModal.interface';

jest.mock('./TableTypePropertyEditTable', () =>
  jest.fn().mockImplementation(() => <div>TableTypePropertyEditTable</div>)
);

jest.mock('./TableTypePropertyView', () =>
  jest.fn().mockImplementation(() => <div>TableTypePropertyView</div>)
);

const mockOnCancel = jest.fn();
const mockOnSave = jest.fn().mockResolvedValue(undefined);

const defaultProps: EditTableTypePropertyModalProps = {
  isVisible: true,
  isUpdating: false,
  property: {} as CustomProperty,
  columns: ['column1', 'column2'],
  rows: [{ column1: 'value1', column2: 'value2' }],
  onCancel: mockOnCancel,
  onSave: mockOnSave,
};

describe('EditTableTypePropertyModal', () => {
  it('should render the modal with the correct title', () => {
    const { getByText } = render(
      <EditTableTypePropertyModal {...defaultProps} />
    );

    expect(getByText('label.edit-entity-name')).toBeInTheDocument();
  });

  it('should call onCancel when the cancel button is clicked', () => {
    const { getByTestId } = render(
      <EditTableTypePropertyModal {...defaultProps} />
    );
    fireEvent.click(getByTestId('cancel-update-table-type-property'));

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should call onSave with the correct data when the update button is clicked', async () => {
    const { getByTestId } = render(
      <EditTableTypePropertyModal {...defaultProps} />
    );
    fireEvent.click(getByTestId('update-table-type-property'));
    await waitFor(() =>
      expect(mockOnSave).toHaveBeenCalledWith({
        rows: [{ column1: 'value1', column2: 'value2' }],
        columns: ['column1', 'column2'],
      })
    );
  });

  it('should add a new row when the add new row button is clicked', () => {
    const { getByTestId, getByText } = render(
      <EditTableTypePropertyModal {...defaultProps} />
    );
    fireEvent.click(getByTestId('add-new-row'));

    expect(getByText('TableTypePropertyEditTable')).toBeInTheDocument();
  });

  it('should render TableTypePropertyView when dataSource is empty', () => {
    const props = { ...defaultProps, rows: [] };
    const { getByText } = render(<EditTableTypePropertyModal {...props} />);

    expect(getByText('TableTypePropertyView')).toBeInTheDocument();
  });

  it('should render TableTypePropertyEditTable when dataSource is not empty', () => {
    const { getByText } = render(
      <EditTableTypePropertyModal {...defaultProps} />
    );

    expect(getByText('TableTypePropertyEditTable')).toBeInTheDocument();
  });
});
