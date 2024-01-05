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
  findByRole,
  render,
  screen,
  waitForElement,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { forwardRef } from 'react';
import { act } from 'react-dom/test-utils';
import { ProfilerDashboardType } from '../../../enums/table.enum';
import { MOCK_TABLE } from '../../../mocks/TableData.mock';
import TestCaseForm from './TestCaseForm';

const mockProps = {
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
  table: MOCK_TABLE,
};

const mockParams = {
  entityTypeFQN: 'sample_data.ecommerce_db.shopify.dim_address',
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

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockImplementation(() => mockParams),
}));
jest.mock('../../../rest/testAPI', () => ({
  getListTestCase: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
  getListTestDefinitions: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockTestDefinition)),
}));
jest.mock('../../common/RichTextEditor/RichTextEditor', () =>
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

  it("should call onSubmit when click 'Submit' button", async () => {
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

    await waitForElement(() =>
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
      testSuite: '',
    });
  });

  // column test case
  it("should show column section when test type is 'Column'", async () => {
    mockParams.dashboardType = ProfilerDashboardType.COLUMN;
    await act(async () => {
      render(<TestCaseForm {...mockProps} />);
    });

    expect(await screen.findByTestId('column')).toBeInTheDocument();
  });

  it('should show compute row count field, if supportsRowLevelPassedFailed is true in test definition', async () => {
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

    await waitForElement(() =>
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
