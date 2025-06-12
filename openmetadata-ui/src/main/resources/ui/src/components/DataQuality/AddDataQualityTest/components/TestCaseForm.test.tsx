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
import {
  act,
  findByRole,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import { ProfilerDashboardType } from '../../../../enums/table.enum';
import { MOCK_TABLE } from '../../../../mocks/TableData.mock';
import { getListTestDefinitions } from '../../../../rest/testAPI';
import TestCaseForm from './TestCaseForm';

const mockProps = {
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
  table: MOCK_TABLE,
};

const mockParams = {
  fqn: 'sample_data.ecommerce_db.shopify.dim_address',
  dashboardType: ProfilerDashboardType.TABLE,
};

const mockTestDefinition = {
  data: [
    {
      id: '21bda32d-3c62-4d19-a477-1a99fd1737fa',
      name: 'columnValueLengthsToBeBetween',
      displayName: 'Column Value Lengths To Be Between',
      fullyQualifiedName: 'columnValueLengthsToBeBetween',
      entityType: 'COLUMN',
      testPlatforms: ['OpenMetadata'],
      supportedDataTypes: [
        'BYTES',
        'STRING',
        'MEDIUMTEXT',
        'TEXT',
        'CHAR',
        'VARCHAR',
        'ARRAY',
      ],
      parameterDefinition: [
        {
          name: 'minLength',
          displayName: 'Min',
          dataType: 'INT',
          description: 'description',
          required: false,
          optionValues: [],
        },
        {
          name: 'maxLength',
          displayName: 'Max',
          dataType: 'INT',
          description: 'description',
          required: false,
          optionValues: [],
        },
      ],
      supportsRowLevelPassedFailed: true,
    },
  ],
};
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useParams: jest.fn().mockImplementation(() => mockParams),
}));
jest.mock('../../../../utils/DataQuality/DataQualityUtils', () => {
  return {
    createTestCaseParameters: jest.fn().mockImplementation(() => []),
  };
});
jest.mock('../../../../rest/testAPI', () => ({
  getListTestCase: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
  getListTestDefinitions: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockTestDefinition)),
}));
jest.mock('../../../common/RichTextEditor/RichTextEditor', () =>
  forwardRef(
    jest.fn().mockImplementation(() => <div>RichTextEditor.component</div>)
  )
);
jest.mock('./ParameterForm', () =>
  jest.fn().mockImplementation(() => <div>ParameterForm.component</div>)
);
jest.mock('crypto-random-string-with-promisify-polyfill', () =>
  jest.fn().mockImplementation(() => '4B3B')
);

describe('TestCaseForm', () => {
  it('should render component', async () => {
    await act(async () => {
      render(<TestCaseForm {...mockProps} />);
    });

    expect(await screen.findByTestId('test-case-form')).toBeInTheDocument();
    expect(await screen.findByTestId('cancel-btn')).toBeInTheDocument();
    expect(await screen.findByTestId('submit-test')).toBeInTheDocument();
    expect(await screen.findByTestId('test-case-name')).toBeInTheDocument();
    expect(await screen.findByTestId('test-type')).toBeInTheDocument();
    expect(
      screen.queryByTestId('compute-passed-failed-row-count')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('column')).not.toBeInTheDocument();
    expect(
      screen.queryByText('ParameterForm.component')
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText('RichTextEditor.component')
    ).toBeInTheDocument();
  });

  it("should call onCancel when click 'Cancel' button", async () => {
    await act(async () => {
      render(<TestCaseForm {...mockProps} />);
    });

    const cancelBtn = await screen.findByTestId('cancel-btn');
    await act(async () => {
      cancelBtn.click();
    });

    expect(mockProps.onCancel).toHaveBeenCalled();
  });

  it.skip("should call onSubmit when click 'Submit' button", async () => {
    await act(async () => {
      render(<TestCaseForm {...mockProps} />);
    });

    const typeSelector = await findByRole(
      await screen.findByTestId('test-type'),
      'combobox'
    );
    await act(async () => {
      fireEvent.click(typeSelector);
    });

    expect(typeSelector).toBeInTheDocument();

    await waitFor(() =>
      screen.findByText('Column Value Lengths To Be Between')
    );

    await act(async () => {
      userEvent.click(
        await screen.findByText('Column Value Lengths To Be Between')
      );
    });

    expect(
      await screen.findByTestId('compute-passed-failed-row-count')
    ).toBeInTheDocument();

    const submitBtn = await screen.findByTestId('submit-test');
    await act(async () => {
      submitBtn.click();
    });

    expect(mockProps.onSubmit).toHaveBeenCalledWith({
      computePassedFailedRowCount: undefined,
      description: undefined,
      displayName: 'dim_address_column_value_lengths_to_be_between_4B3B',
      entityLink: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
      name: 'dim_address_column_value_lengths_to_be_between_4B3B',
      parameterValues: [],
      testDefinition: 'columnValueLengthsToBeBetween',
    });
  });

  it("should call getListTestDefinitions when test type is 'Table'", async () => {
    await act(async () => {
      render(<TestCaseForm {...mockProps} />);
    });

    expect(getListTestDefinitions).toHaveBeenCalledWith({
      entityType: 'TABLE',
      limit: 50,
      supportedDataType: undefined,
      testPlatform: 'OpenMetadata',
    });
  });

  // column test case
  it.skip("should show column section when test type is 'Column'", async () => {
    mockParams.dashboardType = ProfilerDashboardType.COLUMN;
    await act(async () => {
      render(<TestCaseForm {...mockProps} />);
    });

    expect(await screen.findByTestId('column')).toBeInTheDocument();
    expect(getListTestDefinitions).not.toHaveBeenCalled();
  });

  it.skip('should call getListTestDefinitions when column value change', async () => {
    mockParams.dashboardType = ProfilerDashboardType.COLUMN;

    await act(async () => {
      render(<TestCaseForm {...mockProps} />);
    });

    const column = await findByRole(
      await screen.findByTestId('column'),
      'combobox'
    );
    await act(async () => {
      userEvent.click(column);
    });

    expect(column).toBeInTheDocument();

    await waitFor(() => screen.findByText('last_name'));

    await act(async () => {
      userEvent.click(await screen.findByText('last_name'));
    });

    expect(mockNavigate).toHaveBeenCalledWith({
      search:
        'activeColumnFqn=sample_data.ecommerce_db.shopify.dim_address.last_name',
    });
    expect(getListTestDefinitions).toHaveBeenCalledWith({
      entityType: 'COLUMN',
      limit: 50,
      supportedDataType: 'VARCHAR',
      testPlatform: 'OpenMetadata',
    });

    mockParams.dashboardType = ProfilerDashboardType.TABLE;
  });

  it.skip('should show compute row count field, if supportsRowLevelPassedFailed is true in test definition', async () => {
    await act(async () => {
      render(<TestCaseForm {...mockProps} />);
    });

    const typeSelector = await findByRole(
      await screen.findByTestId('test-type'),
      'combobox'
    );
    await act(async () => {
      userEvent.click(typeSelector);
    });

    expect(typeSelector).toBeInTheDocument();

    await waitFor(() =>
      screen.findByText('Column Value Lengths To Be Between')
    );

    await act(async () => {
      userEvent.click(
        await screen.findByText('Column Value Lengths To Be Between')
      );
    });

    expect(
      await screen.findByTestId('compute-passed-failed-row-count')
    ).toBeInTheDocument();
  });
});
