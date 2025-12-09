/*
 *  Copyright 2024 Collate.
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  deleteTestDefinitionById,
  getListTestDefinitions,
  patchTestDefinition,
} from '../../../rest/testAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import TestDefinitionForm from '../TestDefinitionForm/TestDefinitionForm.component';
import TestDefinitionList from './TestDefinitionList.component';

const mockTestDefinitions = {
  data: [
    {
      id: 'test-def-1',
      name: 'columnValuesToBeNotNull',
      displayName: 'Column Values To Be Not Null',
      description: 'Ensures that all values in a column are not null',
      entityType: 'COLUMN',
      testPlatforms: ['OpenMetadata'],
      enabled: true,
    },
    {
      id: 'test-def-2',
      name: 'tableRowCountToBeBetween',
      displayName: 'Table Row Count To Be Between',
      description: 'Ensures table row count is between min and max values',
      entityType: 'TABLE',
      testPlatforms: ['OpenMetadata', 'DBT'],
      enabled: false,
    },
  ],
  paging: {
    total: 2,
  },
};

jest.mock('../../../rest/testAPI', () => ({
  getListTestDefinitions: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockTestDefinitions)),
  patchTestDefinition: jest.fn().mockImplementation(() => Promise.resolve({})),
  deleteTestDefinitionById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('../TestDefinitionForm/TestDefinitionForm.component', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="test-definition-form">TestDefinitionForm</div>
    )),
}));

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="page-layout">{children}</div>
    )),
}));

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    currentPage: 1,
    pageSize: 15,
    paging: { total: 2 },
    handlePagingChange: jest.fn(),
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    showPagination: false,
  }),
}));

describe('TestDefinitionList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render component with test definitions table', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(screen.getByTestId('test-definition-table')).toBeInTheDocument();
    });

    expect(screen.getByText('columnValuesToBeNotNull')).toBeInTheDocument();
    expect(screen.getByText('tableRowCountToBeBetween')).toBeInTheDocument();
  });

  it('should render all table columns', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      const tableHeaders = screen.getAllByRole('columnheader');
      const labels = tableHeaders.map((header) => header.textContent);

      expect(labels).toContain('label.name');
      expect(labels).toContain('label.description');
      expect(labels).toContain('label.entity-type');
      expect(labels).toContain('label.test-platform');
      expect(labels).toContain('label.enabled');
      expect(labels).toContain('label.action-plural');
    });
  });

  it('should fetch test definitions on mount', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(getListTestDefinitions).toHaveBeenCalledWith({
        limit: 15,
        offset: 0,
      });
    });
  });

  it('should render enabled switch for each test definition', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      const switches = screen.getAllByRole('switch');

      expect(switches).toHaveLength(2);
    });
  });

  it('should call patchTestDefinition when enable switch is toggled', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(screen.getByTestId('test-definition-table')).toBeInTheDocument();
    });

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[1]);

    await waitFor(() => {
      expect(patchTestDefinition).toHaveBeenCalled();
      expect(showSuccessToast).toHaveBeenCalled();
    });
  });

  it('should render edit and delete action buttons', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      const editButtons = screen.getAllByTestId(/edit-test-definition-/);
      const deleteButtons = screen.getAllByTestId(/delete-test-definition-/);

      expect(editButtons).toHaveLength(2);
      expect(deleteButtons).toHaveLength(2);
    });
  });

  it('should open form drawer when edit button is clicked', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      const editButtons = screen.getAllByTestId(/edit-test-definition-/);
      fireEvent.click(editButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('test-definition-form')).toBeInTheDocument();
    });
  });

  it('should show delete confirmation modal when delete button is clicked', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      const deleteButtons = screen.getAllByTestId(/delete-test-definition-/);
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText(/label.delete-entity/)).toBeInTheDocument();
    });
  });

  it('should call deleteTestDefinitionById when delete is confirmed', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      const deleteButtons = screen.getAllByTestId(/delete-test-definition-/);
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      const confirmButton = screen.getByRole('button', {
        name: /label.delete/,
      });
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(deleteTestDefinitionById).toHaveBeenCalledWith('test-def-1');
      expect(showSuccessToast).toHaveBeenCalled();
    });
  });

  it('should render add test definition button', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(
        screen.getByTestId('add-test-definition-button')
      ).toBeInTheDocument();
    });
  });

  it('should open form drawer when add button is clicked', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    const addButton = await screen.findByTestId('add-test-definition-button');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByTestId('test-definition-form')).toBeInTheDocument();
    });
  });

  it('should show error toast when API call fails', async () => {
    const mockError = new Error('API Error');

    (getListTestDefinitions as jest.Mock).mockRejectedValueOnce(mockError);

    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(mockError);
    });
  });

  it('should refresh list after successful create/update', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    const addButton = await screen.findByTestId('add-test-definition-button');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByTestId('test-definition-form')).toBeInTheDocument();
    });

    const initialCallCount = (getListTestDefinitions as jest.Mock).mock.calls
      .length;

    const onSuccessCallback = (TestDefinitionForm as jest.Mock).mock.calls[0][0]
      .onSuccess;
    onSuccessCallback();

    await waitFor(() => {
      expect(getListTestDefinitions).toHaveBeenCalledTimes(
        initialCallCount + 1
      );
    });
  });
});
