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
import { render, screen } from '@testing-library/react';
// internal imports
import ColumnProfileIcon from '../../../../assets/svg/column-profile.svg?react';
import DataQualityIcon from '../../../../assets/svg/data-quality.svg?react';
import TableProfileIcon from '../../../../assets/svg/table-profile.svg?react';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { TEST_CASE } from '../../../../mocks/TableData.mock';
import TableProfilerV1 from './TableProfiler';
import { TableProfilerProps } from './TableProfiler.interface';

const mockLocation = {
  search: '?activeTab=Table Profile',
  pathname: '/table',
};

jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ ...mockLocation }));
});

// mock library imports
jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }) => <a href="#">{children}</a>),
  useParams: jest.fn().mockReturnValue({
    fqn: 'sample_data.ecommerce_db.shopify.dim_address',
  }),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));
const mockDQTabComponent = () => <div>mock Data Quality TabComponent</div>;
const mockColumnProfilerTabComponent = () => (
  <div>mock Column Profile TabComponent</div>
);
const mockTableProfilerTabComponent = () => (
  <div>mock Table Profile TabComponent</div>
);

const mockGetProfilerTabOptions = [
  {
    label: 'Table Profile',
    key: 'Table Profile',
    disabled: false,
    icon: TableProfileIcon,
  },
  {
    label: 'Column Profile',
    key: 'Column Profile',
    disabled: false,
    icon: ColumnProfileIcon,
  },
  {
    label: 'Data Quality',
    key: 'Data Quality',
    disabled: false,
    icon: DataQualityIcon,
  },
];

jest.mock('./ProfilerClassBase', () => ({
  getProfilerTabs: jest.fn().mockImplementation(() => ({
    'Data Quality': mockDQTabComponent,
    'Column Profile': mockColumnProfilerTabComponent,
    'Table Profile': mockTableProfilerTabComponent,
  })),
  getProfilerTabOptions: jest
    .fn()
    .mockImplementation(() => mockGetProfilerTabOptions),
  getDefaultTabKey: jest.fn().mockReturnValue('Table Profile'),
}));

jest.mock('./ColumnProfileTable/ColumnProfileTable', () => {
  return jest.fn().mockImplementation(() => {
    return <div>ColumnProfileTable.component</div>;
  });
});

jest.mock('../../../../rest/testAPI', () => ({
  getListTestCase: jest
    .fn()
    .mockImplementation(() => Promise.resolve(TEST_CASE)),
}));
jest.mock('../../../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest.fn().mockImplementation(() => Promise.resolve()),
}));
jest.mock('./QualityTab/QualityTab.component', () => ({
  QualityTab: jest
    .fn()
    .mockImplementation(() => <div>QualityTab.component</div>),
}));

jest.mock('./TableProfilerProvider', () => ({
  TableProfilerProvider: jest.fn().mockImplementation(({ children }) => {
    return <div>{children}</div>;
  }),
}));

jest.mock('./TableProfilerChart/TableProfilerChart', () => {
  return jest.fn().mockImplementation(() => {
    return <div>TableProfilerChart.component</div>;
  });
});

jest.mock('./QualityTab/QualityTab.component', () => ({
  QualityTab: jest
    .fn()
    .mockImplementation(() => <div>QualityTab.component</div>),
}));

jest.mock('./ColumnProfileTable/ColumnProfileTable', () => {
  return jest.fn().mockImplementation(() => {
    return <div>ColumnProfileTable.component</div>;
  });
});

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
    EditOwners: true,
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
  it('should render without crashing', async () => {
    render(<TableProfilerV1 {...mockProps} />);

    const profileContainer = await screen.findByTestId(
      'table-profiler-container'
    );
    const profilerTabLeftPanel = await screen.findByTestId(
      'profiler-tab-left-panel'
    );
    const component = await screen.findByText(
      'mock Table Profile TabComponent'
    );

    expect(profileContainer).toBeInTheDocument();
    expect(profilerTabLeftPanel).toBeInTheDocument();
    expect(component).toBeInTheDocument();
  });

  it('should render Column Profile TabComponent', async () => {
    mockLocation.search = '?activeTab=Column Profile';
    render(<TableProfilerV1 {...mockProps} />);

    const component = await screen.findByText(
      'mock Column Profile TabComponent'
    );

    expect(component).toBeInTheDocument();
  });

  it('should render Data Quality TabComponent', async () => {
    mockLocation.search = '?activeTab=Data Quality';
    render(<TableProfilerV1 {...mockProps} />);

    const component = await screen.findByText('mock Data Quality TabComponent');

    expect(component).toBeInTheDocument();
  });

  it('should render all left menu options', async () => {
    render(<TableProfilerV1 {...mockProps} />);

    const tableProfileOption = await screen.findByText('Table Profile');
    const columnProfileOption = await screen.findByText('Column Profile');
    const dataQualityOption = await screen.findByText('Data Quality');

    expect(tableProfileOption).toBeInTheDocument();
    expect(columnProfileOption).toBeInTheDocument();
    expect(dataQualityOption).toBeInTheDocument();
  });
});
