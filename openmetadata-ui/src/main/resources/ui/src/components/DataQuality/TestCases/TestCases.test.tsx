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
import { getListTestCaseBySearch } from '../../../rest/testAPI';
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

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      testCase: testCasePermission,
    },
  })),
}));
jest.mock('../../../rest/testAPI', () => {
  return {
    ...jest.requireActual('../../../rest/testAPI'),
    getListTestCaseBySearch: jest
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
jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({
    ...mockLocation,
  }));
});
jest.mock('react-router-dom', () => {
  return {
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn().mockImplementation(() => mockUseParam),
    useHistory: jest.fn().mockImplementation(() => mockUseHistory),
  };
});
jest.mock('../../common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious.component</div>);
});
jest.mock('../../common/SearchBarComponent/SearchBar.component', () => {
  return jest.fn().mockImplementation(() => <div>Searchbar.component</div>);
});
jest.mock('../../Database/Profiler/DataQualityTab/DataQualityTab', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>DataQualityTab.component</div>);
});
jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest
    .fn()
    .mockImplementation(({ type }) => (
      <div data-testid={`error-placeholder-type-${type}`}>
        ErrorPlaceHolder.component
      </div>
    ));
});
const mockDataQualityContext = {
  isTestCaseSummaryLoading: false,
  testCaseSummary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  },
  activeTab: DataQualityPageTabs.TEST_CASES,
};
jest.mock('../../../pages/DataQuality/DataQualityProvider', () => {
  return {
    useDataQualityProvider: jest
      .fn()
      .mockImplementation(() => mockDataQualityContext),
  };
});
jest.mock('../SummaryPannel/SummaryPanel.component', () => {
  return {
    SummaryPanel: jest
      .fn()
      .mockImplementation(() => <div>SummaryPanel.component</div>),
  };
});

describe('TestCases component', () => {
  it('component should render', async () => {
    render(<TestCases />);

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
    expect(await screen.findByTestId('advanced-filter')).toBeInTheDocument();
    expect(
      await screen.findByTestId('status-select-filter')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('test-case-type-select-filter')
    ).toBeInTheDocument();
  });

  it('on page load getListTestCaseBySearch API should call', async () => {
    const mockGetListTestCase = getListTestCaseBySearch as jest.Mock;

    render(<TestCases />);

    expect(mockGetListTestCase).toHaveBeenCalledWith({
      fields: ['testCaseResult', 'testSuite', 'incidentId'],
      includeAllTests: true,
      limit: 15,
      offset: 0,
      q: undefined,
      testCaseStatus: undefined,
      sortField: 'testCaseResult.timestamp',
      sortType: 'desc',
    });
  });

  it('should call getListTestCaseBySearch api, if there is search term in URL', async () => {
    const mockSearchQuery = getListTestCaseBySearch as jest.Mock;
    mockLocation.search = '?searchValue=sale';

    render(<TestCases />);

    expect(mockSearchQuery).toHaveBeenCalledWith({
      fields: ['testCaseResult', 'testSuite', 'incidentId'],
      includeAllTests: true,
      limit: 15,
      offset: 0,
      q: '*sale*',
      testCaseStatus: undefined,
      sortField: 'testCaseResult.timestamp',
      sortType: 'desc',
    });
  });
});
