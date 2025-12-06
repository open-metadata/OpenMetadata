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

import { createTheme, Theme, ThemeProvider } from '@mui/material/styles';
import { ThemeColors } from '@openmetadata/ui-core-components';
import { act, render, screen } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import EntitySummaryPanel from './EntitySummaryPanel.component';
import { mockDashboardEntityDetails } from './mocks/DashboardSummary.mock';
import { mockMlModelEntityDetails } from './mocks/MlModelSummary.mock';
import { mockPipelineEntityDetails } from './mocks/PipelineSummary.mock';
import { mockTableEntityDetails } from './mocks/TableSummary.mock';
import { mockTopicEntityDetails } from './mocks/TopicSummary.mock';

const mockHandleClosePanel = jest.fn();

const mockThemeColors: ThemeColors = {
  white: '#FFFFFF',
  blue: {
    50: '#E6F4FF',
    100: '#BAE0FF',
    600: '#1677FF',
    700: '#0958D9',
  },
  blueGray: {
    50: '#F8FAFC',
  },
  gray: {
    300: '#D1D5DB',
    700: '#374151',
    900: '#111827',
  },
} as ThemeColors;

const theme: Theme = createTheme({
  palette: {
    allShades: mockThemeColors,
    background: {
      paper: '#FFFFFF',
    },
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityLinkFromType: jest.fn().mockImplementation(() => 'link'),
  getEntityName: jest.fn().mockImplementation(() => 'displayName'),
  getEntityOverview: jest.fn().mockImplementation(() => []),
}));
jest.mock('../../../utils/StringsUtils', () => ({
  getEncodedFqn: jest.fn().mockImplementation((fqn) => fqn),
  stringToHTML: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => ({ tab: 'table' })),
  Link: jest.fn().mockImplementation(({ children }) => <>{children}</>),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermission: jest.fn().mockReturnValue({
      ViewBasic: true,
      ViewCustomFields: true,
    }),
  }),
}));

jest.mock(
  '../../../context/RuleEnforcementProvider/RuleEnforcementProvider',
  () => ({
    useRuleEnforcementProvider: jest.fn().mockImplementation(() => ({
      fetchRulesForEntity: jest.fn(),
      getRulesForEntity: jest.fn().mockReturnValue([]),
      getEntityRuleValidation: jest.fn().mockReturnValue({
        canAddMultipleUserOwners: true,
        canAddMultipleTeamOwner: true,
        canAddMultipleDomains: true,
        canAddMultipleDataProducts: true,
        maxDomains: Infinity,
        maxDataProducts: Infinity,
        canAddMultipleGlossaryTerm: true,
        requireDomainForDataProduct: false,
      }),
      rules: {},
      isLoading: false,
    })),
  })
);

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockImplementation(() => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
      canAddMultipleDomains: true,
      canAddMultipleDataProducts: true,
      maxDomains: Infinity,
      maxDataProducts: Infinity,
      canAddMultipleGlossaryTerm: true,
      requireDomainForDataProduct: false,
    },
    rules: [],
    isLoading: false,
  })),
}));

describe('EntitySummaryPanel component tests', () => {
  it('TableSummary should render for table data', async () => {
    await act(async () => {
      render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />,
        { wrapper: Wrapper }
      );
    });

    const tableSummary = screen.getByTestId('TableSummary');

    expect(tableSummary).toBeInTheDocument();
  });

  it('TopicSummary should render for topics data', async () => {
    await act(async () => {
      render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockTopicEntityDetails,
              entityType: EntityType.TOPIC,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />,
        { wrapper: Wrapper }
      );
    });

    const topicSummary = screen.getByTestId('TopicSummary');

    expect(topicSummary).toBeInTheDocument();
  });

  it('DashboardSummary should render for dashboard data', async () => {
    await act(async () => {
      render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockDashboardEntityDetails,
              entityType: EntityType.DASHBOARD,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />,
        { wrapper: Wrapper }
      );
    });

    const dashboardSummary = screen.getByTestId('DashboardSummary');

    expect(dashboardSummary).toBeInTheDocument();
  });

  it('PipelineSummary should render for pipeline data', async () => {
    await act(async () => {
      render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockPipelineEntityDetails,
              entityType: EntityType.PIPELINE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />,
        { wrapper: Wrapper }
      );
    });

    const pipelineSummary = screen.getByTestId('PipelineSummary');

    expect(pipelineSummary).toBeInTheDocument();
  });

  it('MlModelSummary should render for mlModel data', async () => {
    await act(async () => {
      render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockMlModelEntityDetails,
              entityType: EntityType.MLMODEL,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />,
        { wrapper: Wrapper }
      );
    });

    const mlModelSummary = screen.getByTestId('MlModelSummary');

    expect(mlModelSummary).toBeInTheDocument();
  });

  it('ChartSummary should render for chart data', async () => {
    await act(async () => {
      render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockMlModelEntityDetails,
              entityType: EntityType.CHART,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />,
        { wrapper: Wrapper }
      );
    });

    const chartSummary = screen.getByTestId('ChartSummary');

    expect(chartSummary).toBeInTheDocument();
  });

  it('should render drawer header when isSideDrawer is true', async () => {
    await act(async () => {
      render(
        <EntitySummaryPanel
          isSideDrawer
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />,
        { wrapper: Wrapper }
      );
    });

    const closeIcon = screen.getByTestId('drawer-close-icon');

    expect(closeIcon).toBeInTheDocument();
  });

  it('should not render drawer header when isSideDrawer is false', async () => {
    await act(async () => {
      render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
          isSideDrawer={false}
        />,
        { wrapper: Wrapper }
      );
    });

    const closeIcon = screen.queryByTestId('drawer-close-icon');

    expect(closeIcon).not.toBeInTheDocument();
  });

  it('should apply drawer-specific CSS classes when isSideDrawer is true', async () => {
    const { container } = await act(async () => {
      return render(
        <EntitySummaryPanel
          isSideDrawer
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />,
        { wrapper: Wrapper }
      );
    });

    const summaryPanelContainer = container.querySelector(
      '.drawer-summary-panel-container'
    );
    const contentArea = container.querySelector('.drawer-content-area');

    expect(summaryPanelContainer).toBeInTheDocument();
    expect(contentArea).toBeInTheDocument();
  });
});
