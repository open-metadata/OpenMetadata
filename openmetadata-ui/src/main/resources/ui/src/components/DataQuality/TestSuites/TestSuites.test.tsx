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
import { MemoryRouter } from 'react-router-dom';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { getListTestSuites } from '../../../rest/testAPI';
import { TestSuites } from './TestSuites.component';

const testSuitePermission = {
  Create: true,
  Delete: true,
  ViewAll: true,
  EditAll: true,
  EditDescription: true,
  EditDisplayName: true,
  EditCustomFields: true,
};
const mockUseParam = { tab: DataQualityPageTabs.TABLES } as {
  tab?: DataQualityPageTabs;
};

jest.mock('../../../components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      testSuite: testSuitePermission,
    },
  })),
}));
jest.mock('../../../rest/testAPI', () => {
  return {
    ...jest.requireActual('../../../rest/testAPI'),
    getListTestSuites: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ data: [], paging: { total: 0 } })
      ),
  };
});
jest.mock('react-router-dom', () => {
  return {
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn().mockImplementation(() => mockUseParam),
  };
});
jest.mock('../../../components/common/next-previous/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious.component</div>);
});
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

describe('TestSuites component', () => {
  it('component should render', async () => {
    render(<TestSuites {...mockProps} />);
    const tableHeader = await screen.findAllByRole('columnheader');
    const labels = tableHeader.map((header) => header.textContent);

    expect(tableHeader).toHaveLength(4);
    expect(labels).toStrictEqual([
      'label.name',
      'label.test-plural',
      'label.success %',
      'label.owner',
    ]);
    expect(await screen.findByTestId('test-suite-table')).toBeInTheDocument();
    expect(
      await screen.findByText('SummaryPanel.component')
    ).toBeInTheDocument();
  });

  it('should send testSuiteType executable in api, if active tab is tables', async () => {
    const mockGetListTestSuites = getListTestSuites as jest.Mock;

    render(<TestSuites {...mockProps} />);

    expect(
      await screen.findByTestId('test-suite-container')
    ).toBeInTheDocument();
    expect(mockGetListTestSuites).toHaveBeenCalledWith({
      fields: 'owner,summary',
      testSuiteType: 'executable',
    });
  });

  it('pagination should visible if total is grater than 15', async () => {
    (getListTestSuites as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: [], paging: { total: 16 } })
    );

    render(<TestSuites {...mockProps} />);

    expect(
      await screen.findByText('NextPrevious.component')
    ).toBeInTheDocument();
  });

  // TestSuite type test
  it('add test suite button should be visible, if type is testSuite', async () => {
    mockUseParam.tab = DataQualityPageTabs.TEST_SUITES;
    render(<TestSuites {...mockProps} />, { wrapper: MemoryRouter });

    expect(await screen.findByTestId('add-test-suite-btn')).toBeInTheDocument();
  });

  it('should send testSuiteType logical in api, if active tab is tables', async () => {
    mockUseParam.tab = DataQualityPageTabs.TEST_SUITES;
    const mockGetListTestSuites = getListTestSuites as jest.Mock;

    render(<TestSuites {...mockProps} />, { wrapper: MemoryRouter });

    expect(
      await screen.findByTestId('test-suite-container')
    ).toBeInTheDocument();
    expect(mockGetListTestSuites).toHaveBeenCalledWith({
      fields: 'owner,summary',
      testSuiteType: 'logical',
    });
  });

  it('should render no data placeholder, if there is no permission', async () => {
    mockUseParam.tab = DataQualityPageTabs.TEST_SUITES;
    testSuitePermission.ViewAll = false;
    render(<TestSuites {...mockProps} />, { wrapper: MemoryRouter });

    expect(
      await screen.findByTestId('error-placeholder-type-PERMISSION')
    ).toBeInTheDocument();
  });
});
