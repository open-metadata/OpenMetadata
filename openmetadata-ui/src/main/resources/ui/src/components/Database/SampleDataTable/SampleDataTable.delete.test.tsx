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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { MOCK_TABLE } from '../../../mocks/TableData.mock';
import {
  deleteSampleDataByTableId,
  getSampleDataByTableId,
} from '../../../rest/tableAPI';
import SampleDataTable from './SampleDataTable.component';

const mockProps = {
  tableId: 'id',
  owners: [{ type: 'user', id: 'ownerId' }],
  permissions: {
    ViewAll: true,
    EditAll: true,
  } as OperationPermission,
};

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children }) => <span>{children}</span>),
}));

jest.mock('../../../rest/tableAPI', () => ({
  getSampleDataByTableId: jest.fn(),
  deleteSampleDataByTableId: jest.fn(),
}));

describe('SampleDataTable delete confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSampleDataByTableId as jest.Mock).mockResolvedValue(MOCK_TABLE);
  });

  it('should keep sample data and skip the delete call when the modal is cancelled', async () => {
    await act(async () => {
      render(<SampleDataTable {...mockProps} />);
    });

    fireEvent.click(screen.getByTestId('sample-data-manage-button'));
    fireEvent.click(screen.getByTestId('delete-button-details-container'));

    expect(screen.getByTestId('modal-header')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-button')).toBeEnabled();

    fireEvent.click(screen.getByTestId('cancel-button'));

    await waitFor(() =>
      expect(screen.queryByTestId('modal-header')).not.toBeInTheDocument()
    );

    expect(screen.getByTestId('sample-data')).toBeInTheDocument();
    expect(screen.getByText('address_id1')).toBeInTheDocument();
    expect(deleteSampleDataByTableId).not.toHaveBeenCalled();
  });
});
