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

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DataInsightTabs } from '../../interface/data-insight.interface';
import DataInsightPage from './DataInsightPage.component';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
  useLocation: jest
    .fn()
    .mockImplementation(() => ({ pathname: '/data-insights/data-assets' })),
  useParams: jest
    .fn()
    .mockImplementation(() => ({ tab: DataInsightTabs.DATA_ASSETS })),
}));

jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest
    .fn()
    .mockImplementation(() => ({ tab: DataInsightTabs.DATA_ASSETS })),
}));

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../components/common/ResizablePanels/ResizableLeftPanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <div data-testid="resizable-panels">
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </div>
  ))
);

jest.mock('../../utils/DataInsightUtils', () => ({
  getDataInsightPathWithFqn: jest.fn().mockReturnValue('/'),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('./DataInsightProvider', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  useDataInsightProvider: jest.fn().mockReturnValue({
    teamFilter: {},
    tierFilter: {},
    chartFilter: { startTs: Date.now(), endTs: Date.now() },
    onChartFilterChange: jest.fn(),
    kpi: { isLoading: false, data: [] },
    entitiesSummary: {},
    updateEntitySummary: jest.fn(),
  }),
}));

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('./DataInsightHeader/DataInsightHeader.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="data-insight-header">DataInsightHeader.component</div>
    ))
);

jest.mock('./DataInsightClassBase', () => ({
  getLeftPanel: jest.fn().mockReturnValue(() => <div>LeftPanel</div>),
  getDataInsightTabComponent: jest
    .fn()
    .mockReturnValue(() => <div>dataAssetsComponent</div>),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      dataInsightChart: {
        ViewAll: true,
      },
      kpi: {
        ViewAll: true,
        Create: true,
      },
    },
  }),
}));

jest.mock('../../utils/DataInsightUtils', () => ({
  getDataInsightPathWithFqn: jest.fn().mockReturnValue('/'),
}));

const mockProps = {
  pageTitle: 'data-insight',
};

describe('Test DataInsightPage Component', () => {
  it('Should render all child elements', async () => {
    render(<DataInsightPage {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    // Wait for the header to be present
    const header = await screen.findByTestId('data-insight-header');

    expect(header).toBeInTheDocument();
    expect(
      await screen.findByTestId('data-insight-container')
    ).toBeInTheDocument();
  });
});
