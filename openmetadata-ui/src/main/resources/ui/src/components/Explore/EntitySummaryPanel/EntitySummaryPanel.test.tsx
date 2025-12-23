/*
 *  Copyright 2025 Collate.
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
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { EntityType } from '../../../enums/entity.enum';
import EntitySummaryPanel from './EntitySummaryPanel.component';
import { mockDashboardEntityDetails } from './mocks/DashboardSummary.mock';
import { mockDomainEntityDetails } from './mocks/DomainSummary.mock';
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
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
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

jest.mock('../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: jest.fn().mockReturnValue('/entity/link'),
    getEntityIcon: jest.fn().mockReturnValue(<span>Icon</span>),
    getEntitySummaryComponent: jest.fn().mockReturnValue(null),
  },
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

  it('should render for domain data without requesting invalid domains field', async () => {
    const { container } = await act(async () => {
      return render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockDomainEntityDetails,
              entityType: EntityType.DOMAIN,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />,
        { wrapper: Wrapper }
      );
    });

    expect(
      container.querySelector('.entity-summary-panel-container')
    ).toBeInTheDocument();
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

  describe('Lineage Loading State Management', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should initialize with loading state for permissions', async () => {
      // Force permission fetch to remain pending so we can reliably assert the initial loader state.
      (
        usePermissionProvider().getEntityPermission as jest.Mock
      ).mockImplementationOnce(() => new Promise(() => undefined));

      const { container } = await act(async () => {
        return render(
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

      // Should show loader initially while permissions load
      const loaders = container.querySelectorAll('[data-testid="loader"]');

      expect(loaders.length).toBeGreaterThan(0);
    });

    it('should handle entity type that supports lineage', async () => {
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

      // Table entity should render (tables support lineage)
      const tableSummary = screen.getByTestId('TableSummary');

      expect(tableSummary).toBeInTheDocument();
    });

    it('should handle entity type that does not support lineage gracefully', async () => {
      await act(async () => {
        render(
          <EntitySummaryPanel
            entityDetails={{
              details: {
                ...mockTableEntityDetails,
                entityType: EntityType.USER,
                id: 'user-1',
                fullyQualifiedName: 'user1',
              },
            }}
            handleClosePanel={mockHandleClosePanel}
          />,
          { wrapper: Wrapper }
        );
      });

      // Should still render without crashing, even though USER doesn't support lineage
      expect(screen.queryByTestId('TableSummary')).not.toBeInTheDocument();
    });

    it('should handle missing lineageData gracefully', async () => {
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

      // Should render without crashing even when lineageData is null/undefined
      const tableSummary = screen.getByTestId('TableSummary');

      expect(tableSummary).toBeInTheDocument();
    });

    it('should handle missing fullyQualifiedName for lineage-supported entity', async () => {
      const entityWithoutFQN = {
        ...mockTableEntityDetails,
        fullyQualifiedName: undefined,
        entityType: EntityType.TABLE,
      };

      await act(async () => {
        render(
          <EntitySummaryPanel
            entityDetails={{
              details: entityWithoutFQN,
            }}
            handleClosePanel={mockHandleClosePanel}
          />,
          { wrapper: Wrapper }
        );
      });

      // Should still render without crashing
      const tableSummary = screen.getByTestId('TableSummary');

      expect(tableSummary).toBeInTheDocument();
    });

    it('should handle missing entityType gracefully', async () => {
      await act(async () => {
        render(
          <EntitySummaryPanel
            entityDetails={{
              details: {
                ...mockTableEntityDetails,
                entityType: undefined as unknown as EntityType,
              },
            }}
            handleClosePanel={mockHandleClosePanel}
          />,
          { wrapper: Wrapper }
        );
      });

      // Component defaults to EntityType.TABLE when entityType is undefined
      // So it should render TableSummary as a fallback
      const tableSummary = screen.getByTestId('TableSummary');

      expect(tableSummary).toBeInTheDocument();
    });

    it('should handle missing entityDetails gracefully', async () => {
      await act(async () => {
        render(
          <EntitySummaryPanel
            entityDetails={{
              details: null as unknown as any,
            }}
            handleClosePanel={mockHandleClosePanel}
          />,
          { wrapper: Wrapper }
        );
      });

      // Should not crash when entityDetails is null
      expect(screen.queryByTestId('TableSummary')).not.toBeInTheDocument();
    });

    it('should handle missing id for lineage-supported entity', async () => {
      const entityWithoutId = {
        ...mockTableEntityDetails,
        id: undefined,
        entityType: EntityType.TABLE,
      };

      await act(async () => {
        render(
          <EntitySummaryPanel
            entityDetails={{
              details: entityWithoutId,
            }}
            handleClosePanel={mockHandleClosePanel}
          />,
          { wrapper: Wrapper }
        );
      });

      // Should not crash when id is missing (component may show loader or not render summary)
      // The component should handle missing id gracefully without throwing errors
      expect(screen.queryByTestId('TableSummary')).not.toBeInTheDocument();
    });

    it('should handle entity type change correctly', async () => {
      const { rerender } = await act(async () => {
        return render(
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

      expect(screen.getByTestId('TableSummary')).toBeInTheDocument();

      // Change entity type to Topic
      await act(async () => {
        rerender(
          <Wrapper>
            <EntitySummaryPanel
              entityDetails={{
                details: {
                  ...mockTopicEntityDetails,
                  entityType: EntityType.TOPIC,
                },
              }}
              handleClosePanel={mockHandleClosePanel}
            />
          </Wrapper>
        );
      });

      expect(screen.getByTestId('TopicSummary')).toBeInTheDocument();
    });

    it('should handle missing fullyQualifiedName gracefully', async () => {
      const entityWithoutFQN = {
        ...mockTableEntityDetails,
        fullyQualifiedName: undefined,
      };

      await act(async () => {
        render(
          <EntitySummaryPanel
            entityDetails={{
              details: {
                ...entityWithoutFQN,
                entityType: EntityType.TABLE,
              },
            }}
            handleClosePanel={mockHandleClosePanel}
          />,
          { wrapper: Wrapper }
        );
      });

      // Should still render without crashing
      const tableSummary = screen.getByTestId('TableSummary');

      expect(tableSummary).toBeInTheDocument();
    });

    it('should handle entity details change correctly', async () => {
      const { rerender } = await act(async () => {
        return render(
          <EntitySummaryPanel
            entityDetails={{
              details: {
                ...mockTableEntityDetails,
                id: 'table-1',
                entityType: EntityType.TABLE,
              },
            }}
            handleClosePanel={mockHandleClosePanel}
          />,
          { wrapper: Wrapper }
        );
      });

      expect(screen.getByTestId('TableSummary')).toBeInTheDocument();

      // Change to different entity with different ID
      await act(async () => {
        rerender(
          <Wrapper>
            <EntitySummaryPanel
              entityDetails={{
                details: {
                  ...mockTableEntityDetails,
                  id: 'table-2',
                  fullyQualifiedName: 'new.table.fqn',
                  entityType: EntityType.TABLE,
                },
              }}
              handleClosePanel={mockHandleClosePanel}
            />
          </Wrapper>
        );
      });

      // Should still render the new entity
      expect(screen.getByTestId('TableSummary')).toBeInTheDocument();
    });

    it('should handle permission loading state correctly', async () => {
      const mockGetEntityPermission = jest
        .fn()
        .mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ ViewBasic: true }), 100)
            )
        );

      (
        usePermissionProvider().getEntityPermission as jest.Mock
      ).mockImplementationOnce(mockGetEntityPermission);

      const { container } = await act(async () => {
        return render(
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

      // Should show loader while permission is loading
      const loaders = container.querySelectorAll('[data-testid="loader"]');

      expect(loaders.length).toBeGreaterThan(0);
      expect(mockGetEntityPermission).toHaveBeenCalled();
    });
  });
});
