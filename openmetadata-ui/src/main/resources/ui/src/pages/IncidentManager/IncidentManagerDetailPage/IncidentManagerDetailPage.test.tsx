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
import { MemoryRouter } from 'react-router-dom';
import { TestCase } from '../../../generated/tests/testCase';
import { MOCK_PERMISSIONS } from '../../../mocks/Glossary.mock';
import { getTestCaseByFqn } from '../../../rest/testAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { TestCasePageTabs } from '../IncidentManager.interface';
import IncidentManagerDetailPage from './IncidentManagerDetailPage';
import { UseTestCaseStoreInterface } from './useTestCase.store';

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
    description: 'This is an basic test suite linked to an entity',
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
} as TestCase;
const mockUseTestCase: UseTestCaseStoreInterface = {
  testCase: mockTestCaseData,
  setTestCase: jest.fn(),
  isLoading: false,
  setIsLoading: jest.fn(),
  reset: jest.fn(),
  showAILearningBanner: false,
  setShowAILearningBanner: jest.fn(),
  dqLineageData: undefined,
  setDqLineageData: jest.fn(),
  isPermissionLoading: false,
  testCasePermission: MOCK_PERMISSIONS,
  setTestCasePermission: jest.fn(),
  setIsPermissionLoading: jest.fn(),
  isTabExpanded: false,
  setIsTabExpanded: jest.fn(),
};
jest.mock('./useTestCase.store', () => ({
  useTestCaseStore: jest.fn().mockImplementation(() => mockUseTestCase),
}));

jest.mock('../../../rest/testAPI', () => ({
  getTestCaseByFqn: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockTestCaseData })),
  updateTestCaseById: jest.fn(),
  TestCaseType: {
    all: 'all',
    table: 'table',
    column: 'column',
  },
}));

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest
    .fn()
    .mockImplementation(() => ({ state: { breadcrumbData: [] } }));
});

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({
    fqn: 'sample_data.ecommerce_db.shopify.dim_address.table_column_count_equals',
    tab: TestCasePageTabs.TEST_CASE_RESULTS,
  }),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));
jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () =>
  jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="page-layout-v1">{children}</div>
    ))
);
jest.mock('../../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);
jest.mock(
  '../../../components/DataQuality/IncidentManager/IncidentManagerPageHeader/IncidentManagerPageHeader.component',
  () => jest.fn().mockImplementation(() => <div>IncidentManagerPageHeader</div>)
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
  '../../../components/DataQuality/IncidentManager/TestCaseResultTab/TestCaseResultTab.component',
  () => jest.fn().mockImplementation(() => <div>TestCaseResultTab</div>)
);
jest.mock(
  '../../../components/DataQuality/IncidentManager/TestCaseIncidentTab/TestCaseIncidentTab.component',
  () => jest.fn().mockImplementation(() => <div>TestCaseIncidentTab</div>)
);
jest.mock(
  '../../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);
jest.mock('../../../components/common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockImplementation(() => <div>OwnerLabel</div>),
}));

describe('IncidentManagerDetailPage', () => {
  it('should render component', async () => {
    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: MemoryRouter });
    });

    expect(
      await screen.findByTestId('incident-manager-details-page-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('tabs')).toBeInTheDocument();
    expect(await screen.findByText('TitleBreadcrumb')).toBeInTheDocument();
    expect(await screen.findByText('EntityHeaderTitle')).toBeInTheDocument();
    expect(
      await screen.findByText('IncidentManagerPageHeader')
    ).toBeInTheDocument();
  });

  it('onClick of same tab, should not call navigate', async () => {
    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: MemoryRouter });
    });

    const testCaseResult = await screen.findByTestId('test-case-result');
    await act(async () => {
      fireEvent.click(testCaseResult);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should render no permission message if user doesn't have permission", async () => {
    mockUseTestCase.testCasePermission = DEFAULT_ENTITY_PERMISSION;
    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: MemoryRouter });
    });

    expect(
      await screen.findByText('ErrorPlaceHolder PERMISSION')
    ).toBeInTheDocument();

    mockUseTestCase.testCasePermission = MOCK_PERMISSIONS;
  });

  it('should render no data placeholder message if there is no data', async () => {
    mockUseTestCase.testCase = undefined;
    (getTestCaseByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );

    await act(async () => {
      render(<IncidentManagerDetailPage />, { wrapper: MemoryRouter });
    });

    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();

    mockUseTestCase.testCase = mockTestCaseData;
  });
});
