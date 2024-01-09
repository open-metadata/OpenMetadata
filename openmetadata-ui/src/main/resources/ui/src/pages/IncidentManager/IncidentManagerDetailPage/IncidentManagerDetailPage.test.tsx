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
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getTestCaseByFqn } from '../../../rest/testAPI';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { IncidentManagerTabs } from '../IncidentManager.interface';
import IncidentManagerDetailPage from './IncidentManagerDetailPage';

const mockTestCaseData = {
  id: '1b748634-d24b-4879-9791-289f2f90fc3c',
  name: 'table_column_count_equals',
  fullyQualifiedName:
    'sample_data.ecommerce_db.shopify.dim_address.table_column_count_equals',
  description: 'test the number of column in table',
  testDefinition: {
    id: '48063740-ac35-4854-9ab3-b1b542c820fe',
    type: 'testDefinition',
    name: 'tableColumnCountToEqual',
    fullyQualifiedName: 'tableColumnCountToEqual',
    description:
      'This test defines the test TableColumnCountToEqual. Test the number of columns equal to a value.',
    displayName: 'Table Column Count To Equal',
    deleted: false,
    href: 'http://localhost:8585/api/v1/dataQuality/testDefinitions/48063740-ac35-4854-9ab3-b1b542c820fe',
  },
  entityLink: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
  entityFQN: 'sample_data.ecommerce_db.shopify.dim_address',
  testSuite: {
    id: 'fe44ef1a-1b83-4872-bef6-fbd1885986b8',
    type: 'testSuite',
    name: 'sample_data.ecommerce_db.shopify.dim_address.testSuite',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.dim_address.testSuite',
    description: 'This is an executable test suite linked to an entity',
    deleted: false,
    href: 'http://localhost:8585/api/v1/dataQuality/testSuites/fe44ef1a-1b83-4872-bef6-fbd1885986b8',
  },
  parameterValues: [
    {
      name: 'columnCount',
      value: '10',
    },
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
  version: 0.1,
  updatedAt: 1703570589915,
  updatedBy: 'admin',
};

jest.mock('../../../rest/testAPI', () => ({
  getTestCaseByFqn: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockTestCaseData })),
  updateTestCaseById: jest.fn(),
}));
const mockHistory = {
  push: jest.fn(),
};
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => mockHistory,
  useParams: () => ({
    fqn: 'sample_data.ecommerce_db.shopify.dim_address.table_column_count_equals',
    tab: IncidentManagerTabs.TEST_CASE_RESULTS,
  }),
}));
jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () =>
  jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="page-layout-v1">{children}</div>
    ))
);
jest.mock('../../../components/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);
jest.mock(
  '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () =>
    jest
      .fn()
      .mockImplementation(({ type }) => <div>ErrorPlaceHolder {type}</div>)
);
jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>)
);
jest.mock(
  '../../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component',
  () => jest.fn().mockImplementation(() => <div>EntityHeaderTitle</div>)
);
jest.mock(
  '../../../components/IncidentManager/TestCaseResultTab/TestCaseResultTab.component',
  () => jest.fn().mockImplementation(() => <div>TestCaseResultTab</div>)
);
jest.mock(
  '../../../components/IncidentManager/TestCaseIssuesTab/TestCaseIssueTab.component',
  () => jest.fn().mockImplementation(() => <div>TestCaseIssueTab</div>)
);
jest.mock(
  '../../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);
jest.mock('../../../components/common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockImplementation(() => <div>OwnerLabel</div>),
}));
jest.mock('../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

describe('IncidentManagerDetailPage', () => {
  it('should render component', async () => {
    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: MemoryRouter });
    });

    expect(
      await screen.findByTestId('incident-manager-details-page-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('table-name')).toBeInTheDocument();
    expect(
      await screen.findByTestId('test-definition-name')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('tabs')).toBeInTheDocument();
    expect(await screen.findByText('TitleBreadcrumb')).toBeInTheDocument();
    expect(await screen.findByText('EntityHeaderTitle')).toBeInTheDocument();
    expect(await screen.findByText('OwnerLabel')).toBeInTheDocument();
    expect(await screen.findByText('TestCaseResultTab')).toBeInTheDocument();
  });

  it('onClick of Issue tab, should call history.push', async () => {
    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: MemoryRouter });
    });

    const issueTab = await screen.findByTestId('issue');
    await act(async () => {
      fireEvent.click(issueTab);
    });

    expect(mockHistory.push).toHaveBeenCalledWith(
      '/incident-manager/sample_data.ecommerce_db.shopify.dim_address.table_column_count_equals/issues'
    );
  });

  it('onClick of same tab, should not call history.push', async () => {
    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: MemoryRouter });
    });

    const testCaseResult = await screen.findByTestId('test-case-result');
    await act(async () => {
      fireEvent.click(testCaseResult);
    });

    expect(mockHistory.push).not.toHaveBeenCalled();
  });

  it("should render no permission message if user doesn't have permission", async () => {
    (checkPermission as jest.Mock).mockImplementationOnce(
      (data) => !(data === 'ViewAll')
    );
    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: MemoryRouter });
    });

    expect(
      await screen.findByText('ErrorPlaceHolder PERMISSION')
    ).toBeInTheDocument();
  });

  it('should render no data placeholder message if there is no data', async () => {
    (getTestCaseByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: MemoryRouter });
    });

    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();
  });
});
