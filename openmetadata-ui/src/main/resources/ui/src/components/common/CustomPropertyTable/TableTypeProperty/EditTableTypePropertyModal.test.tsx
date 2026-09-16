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
import TableTypePropertyEditTable from './TableTypePropertyEditTable';

jest.mock('./TableTypePropertyEditTable', () =>
  jest.fn().mockImplementation(() => <div>TableTypePropertyEditTable</div>)
);

jest.mock('./TableTypePropertyView', () =>
  jest.fn().mockImplementation(() => <div>TableTypePropertyView</div>)
);

const mockedEditTable = TableTypePropertyEditTable as unknown as jest.Mock;

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('should preserve a user-defined column named "id" on init and save (no data loss)', async () => {
    const props: EditTableTypePropertyModalProps = {
      ...defaultProps,
      columns: ['id', 'name'],
      rows: [{ id: 'abc-123', name: 'foo' }],
    };

    const { getByTestId } = render(<EditTableTypePropertyModal {...props} />);

    // The internal row id is a prefixed key (`__row_id__`), so the user's
    // `id` column value must survive the useState initializer untouched.
    const editTableCall =
      mockedEditTable.mock.calls.find(
        (call) => call[0]?.dataSource?.length > 0
      ) ?? mockedEditTable.mock.calls[0];
    const dataSource = editTableCall[0].dataSource as Record<string, string>[];

    expect(dataSource[0].id).toBe('abc-123');
    expect(dataSource[0].name).toBe('foo');
    expect(dataSource[0].__row_id__).toBe('0');

    fireEvent.click(getByTestId('update-table-type-property'));

    await waitFor(() => expect(mockOnSave).toHaveBeenCalledTimes(1));

    const onSaveArg = mockOnSave.mock.calls[0][0];

    // The user's `id: 'abc-123'` value is preserved on save.
    expect(onSaveArg.rows).toEqual([{ id: 'abc-123', name: 'foo' }]);
    // The internal row id key is stripped and does not leak into saved data.
    expect(onSaveArg.rows[0].__row_id__).toBeUndefined();
    // The original value survives somewhere in the saved rows.
    expect(
      onSaveArg.rows.some((row: Record<string, string>) =>
        Object.values(row).includes('abc-123')
      )
    ).toBe(true);
  });

  it('should not leak the internal __row_id__ key into saved rows', async () => {
    const { getByTestId } = render(
      <EditTableTypePropertyModal {...defaultProps} />
    );
    fireEvent.click(getByTestId('update-table-type-property'));

    await waitFor(() => expect(mockOnSave).toHaveBeenCalledTimes(1));

    const onSaveArg = mockOnSave.mock.calls[0][0];

    onSaveArg.rows.forEach((row: Record<string, string>) => {
      expect(row.__row_id__).toBeUndefined();
    });
  });
});
