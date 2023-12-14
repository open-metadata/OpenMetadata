/*
 *  Copyright 2022 Collate.
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

// Library imports
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
// internal imports
import { TableProfilerTab } from '../../components/ProfilerDashboard/profilerDashboard.interface';
import { TEST_CASE } from '../../mocks/TableData.mock';
import { getTableDetailsByFQN } from '../../rest/tableAPI';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';
import { TableProfilerProps } from './TableProfiler.interface';
import TableProfilerV1 from './TableProfilerV1';

const mockLocation = {
  search: '?activeTab=Table Profile',
  pathname: '/table',
};

// mock library imports
jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: jest.fn(),
  })),
  useLocation: jest.fn().mockImplementation(() => mockLocation),
  Link: jest
    .fn()
    .mockImplementation(({ children }) => <a href="#">{children}</a>),
  useParams: jest.fn().mockReturnValue({
    fqn: 'sample_data.ecommerce_db.shopify.dim_address',
  }),
}));

// mock internal imports
jest.mock('./Component/ProfilerSettingsModal', () => {
  return jest.fn().mockImplementation(() => {
    return <div>ProfilerSettingsModal.component</div>;
  });
});
jest.mock('./Component/ColumnProfileTable', () => {
  return jest.fn().mockImplementation(() => {
    return <div>ColumnProfileTable.component</div>;
  });
});

jest.mock('../../utils/CommonUtils', () => ({
  formatNumberWithComma: jest.fn(),
  formTwoDigitNumber: jest.fn(),
  getStatisticsDisplayValue: jest.fn(),
}));

jest.mock('../../rest/testAPI', () => ({
  getListTestCase: jest
    .fn()
    .mockImplementation(() => Promise.resolve(TEST_CASE)),
}));
jest.mock('../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest.fn().mockImplementation(() => Promise.resolve()),
}));
jest.mock('./QualityTab/QualityTab.component', () => ({
  QualityTab: jest
    .fn()
    .mockImplementation(() => <div>QualityTab.component</div>),
}));

const mockProps: TableProfilerProps = {
  permissions: {
    Create: true,
    Delete: true,
    EditAll: true,
    EditCustomFields: true,
    EditDataProfile: true,
    EditDescription: true,
    EditDisplayName: true,
    EditLineage: true,
    EditOwner: true,
    EditQueries: true,
    EditSampleData: true,
    EditTags: true,
    EditTests: true,
    EditTier: true,
    ViewAll: true,
    ViewDataProfile: true,
    ViewQueries: true,
    ViewSampleData: true,
    ViewTests: true,
    ViewUsage: true,
  } as OperationPermission,
};

describe('Test TableProfiler component', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render without crashing', async () => {
    render(<TableProfilerV1 {...mockProps} />);

    const profileContainer = await screen.findByTestId(
      'table-profiler-container'
    );
    const settingBtn = await screen.findByTestId('profiler-setting-btn');
    const addTableTest = await screen.findByTestId(
      'profiler-add-table-test-btn'
    );

    expect(profileContainer).toBeInTheDocument();
    expect(settingBtn).toBeInTheDocument();
    expect(addTableTest).toBeInTheDocument();
  });

  it('CTA: Add table test should work properly', async () => {
    render(<TableProfilerV1 {...mockProps} />);

    const addTableTest = await screen.findByTestId(
      'profiler-add-table-test-btn'
    );

    expect(addTableTest).toBeInTheDocument();
  });

  it('CTA: Setting button should work properly', async () => {
    render(<TableProfilerV1 {...mockProps} />);

    const settingBtn = await screen.findByTestId('profiler-setting-btn');

    expect(settingBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(settingBtn);
    });

    expect(
      await screen.findByText('ProfilerSettingsModal.component')
    ).toBeInTheDocument();
  });

  it('should fetch testSuite details when data quality tab is active', async () => {
    mockLocation.search = `?activeTab=${TableProfilerTab.DATA_QUALITY}`;

    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        name: 'test',
        id: '123',
        tableFqn: 'fqn',
        testSuite: { name: 'testSuite1' },
      })
    );

    await act(async () => {
      render(<TableProfilerV1 {...mockProps} />);
    });

    expect(getTableDetailsByFQN).toHaveBeenCalledWith(
      'sample_data.ecommerce_db.shopify.dim_address',
      'testSuite'
    );
  });
});
