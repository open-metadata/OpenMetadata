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
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { searchQuery } from '../../../rest/searchAPI';
import { getListTestCase } from '../../../rest/testAPI';
import { TestCases } from './TestCases.component';

const testCasePermission = {
  Create: true,
  Delete: true,
  ViewAll: true,
  EditAll: true,
  EditDescription: true,
  EditDisplayName: true,
  EditCustomFields: true,
};
const mockUseParam = { tab: DataQualityPageTabs.TEST_CASES } as {
  tab?: DataQualityPageTabs;
};
const mockUseHistory = { push: jest.fn() };
const mockLocation = { search: '' };

jest.mock('../../../components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      testCase: testCasePermission,
    },
  })),
}));
jest.mock('../../../rest/testAPI', () => {
  return {
    ...jest.requireActual('../../../rest/testAPI'),
    getListTestCase: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ data: [], paging: { total: 0 } })
      ),
    getTestCaseById: jest.fn().mockImplementation(() => Promise.resolve()),
  };
});
jest.mock('../../../rest/searchAPI', () => {
  return {
    ...jest.requireActual('../../../rest/searchAPI'),
    searchQuery: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ hits: { hits: [], total: { value: 0 } } })
      ),
  };
});
jest.mock('react-router-dom', () => {
  return {
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn().mockImplementation(() => mockUseParam),
    useHistory: jest.fn().mockImplementation(() => mockUseHistory),
    useLocation: jest.fn().mockImplementation(() => mockLocation),
  };
});
jest.mock('../../../components/common/next-previous/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious.component</div>);
});
jest.mock('../../../components/common/searchbar/Searchbar', () => {
  return jest.fn().mockImplementation(() => <div>Searchbar.component</div>);
});
jest.mock(
  '../../../components/ProfilerDashboard/component/DataQualityTab',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>DataQualityTab.component</div>);
  }
);
jest.mock(
  '../../../components/common/error-with-placeholder/ErrorPlaceHolder',
  () => {
    return jest
      .fn()
      .mockImplementation(({ type }) => (
        <div data-testid={`error-placeholder-type-${type}`}>
          ErrorPlaceHolder.component
        </div>
      ));
  }
);

const mockProps = {
  summaryPanel: <div>SummaryPanel.component</div>,
};

describe('TestCases component', () => {
  it('component should render', async () => {
    render(<TestCases {...mockProps} />);

    expect(
      await screen.findByTestId('test-case-container')
    ).toBeInTheDocument();
    expect(await screen.findByText('Searchbar.component')).toBeInTheDocument();
    expect(
      await screen.findByText('SummaryPanel.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('DataQualityTab.component')
    ).toBeInTheDocument();
  });

  it('on page load getListTestCase API should call', async () => {
    const mockGetListTestCase = getListTestCase as jest.Mock;

    render(<TestCases {...mockProps} />);

    expect(mockGetListTestCase).toHaveBeenCalledWith({
      fields: 'testDefinition,testCaseResult,testSuite',
      orderByLastExecutionDate: true,
    });
  });

  it('should call searchQuery api, if there is search term in URL', async () => {
    const mockSearchQuery = searchQuery as jest.Mock;
    mockLocation.search = '?searchValue=sale';

    render(<TestCases {...mockProps} />);

    expect(mockSearchQuery).toHaveBeenCalledWith({
      fetchSource: false,
      pageNumber: 1,
      pageSize: 10,
      query: 'sale',
      searchIndex: 'test_case_search_index',
    });
  });
});
