/*
 *  Copyright 2023 Collate.
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
  fireEvent,
  queryByTestId,
  queryByText,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
import { TestCase } from '../../../generated/tests/testCase';
import { checkPermission } from '../../../utils/PermissionsUtils';
import TestCaseResultTab from './TestCaseResultTab.component';
import { TestCaseResultTabProps } from './TestCaseResultTab.interface';

const mockProps: TestCaseResultTabProps = {
  testCaseData: {
    id: '1b748634-d24b-4879-9791-289f2f90fc3c',
    name: 'table_column_count_equals',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.dim_address.table_column_count_equals',
    testDefinition: {
      id: '48063740-ac35-4854-9ab3-b1b542c820fe',
      type: 'testDefinition',
      name: 'tableColumnCountToEqual',
      fullyQualifiedName: 'tableColumnCountToEqual',
      displayName: 'Table Column Count To Equal',
    },
    entityLink: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
    entityFQN: 'sample_data.ecommerce_db.shopify.dim_address',
    testSuite: {
      id: 'fe44ef1a-1b83-4872-bef6-fbd1885986b8',
      type: 'testSuite',
      name: 'sample_data.ecommerce_db.shopify.dim_address.testSuite',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address.testSuite',
    },
    parameterValues: [
      {
        name: 'columnCount',
        value: '10',
      },
      { name: 'sqlExpression', value: 'select * from dim_address' },
    ],
    testCaseResult: {
      timestamp: 1703570591595,
      testCaseStatus: 'Success',
      result: 'Found 10 columns vs. the expected 10',
      testResultValue: [
        {
          name: 'columnCount',
          value: '10',
        },
      ],
    },
    updatedAt: 1703570589915,
    updatedBy: 'admin',
  } as TestCase,
  onTestCaseUpdate: jest.fn(),
};

jest.mock('../../common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockImplementation(() => <div>DescriptionV1</div>);
});
jest.mock('../../SchemaEditor/SchemaEditor', () => {
  return jest.fn().mockImplementation(() => <div>SchemaEditor</div>);
});
jest.mock('../../ProfilerDashboard/component/TestSummary', () => {
  return jest.fn().mockImplementation(() => <div>TestSummary</div>);
});
jest.mock('../../AddDataQualityTest/EditTestCaseModal', () => {
  return jest.fn().mockImplementation(({ onUpdate, testCase, onCancel }) => (
    <div>
      EditTestCaseModal
      <button data-testid="cancel-btn" onClick={onCancel}>
        cancel
      </button>
      <button data-testid="update-test" onClick={() => onUpdate(testCase)}>
        update
      </button>
    </div>
  ));
});
jest.mock('../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

describe('TestCaseResultTab', () => {
  it('Should render component', async () => {
    render(<TestCaseResultTab {...mockProps} />);

    expect(
      await screen.findByTestId('test-case-result-tab-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('parameter-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('edit-parameter-icon')
    ).toBeInTheDocument();
    expect(await screen.findByText('DescriptionV1')).toBeInTheDocument();
    expect(await screen.findByText('TestSummary')).toBeInTheDocument();
  });

  it("EditTestCaseModal should be rendered when 'Edit' button is clicked", async () => {
    render(<TestCaseResultTab {...mockProps} />);

    const editButton = await screen.findByTestId('edit-parameter-icon');
    fireEvent.click(editButton);

    expect(await screen.findByText('EditTestCaseModal')).toBeInTheDocument();
  });

  it('EditTestCaseModal should be removed on cancel click', async () => {
    const { container } = render(<TestCaseResultTab {...mockProps} />);

    const editButton = await screen.findByTestId('edit-parameter-icon');
    fireEvent.click(editButton);

    expect(await screen.findByText('EditTestCaseModal')).toBeInTheDocument();

    const cancelButton = await screen.findByTestId('cancel-btn');
    fireEvent.click(cancelButton);

    expect(queryByText(container, 'EditTestCaseModal')).not.toBeInTheDocument();
  });

  it('onTestCaseUpdate should be called while updating params', async () => {
    render(<TestCaseResultTab {...mockProps} />);

    const editButton = await screen.findByTestId('edit-parameter-icon');
    fireEvent.click(editButton);

    expect(await screen.findByText('EditTestCaseModal')).toBeInTheDocument();

    const updateButton = await screen.findByTestId('update-test');
    fireEvent.click(updateButton);

    expect(mockProps.onTestCaseUpdate).toHaveBeenCalledWith(
      mockProps.testCaseData
    );
  });

  it("Should not show edit icon if user doesn't have edit permission", () => {
    (checkPermission as jest.Mock).mockReturnValueOnce(false);
    const { container } = render(<TestCaseResultTab {...mockProps} />);

    const editButton = queryByTestId(container, 'edit-parameter-icon');

    expect(editButton).not.toBeInTheDocument();
  });
});
