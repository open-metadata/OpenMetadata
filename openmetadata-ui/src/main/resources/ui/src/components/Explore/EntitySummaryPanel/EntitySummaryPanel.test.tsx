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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { EntityType } from '../../../enums/entity.enum';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import EntitySummaryPanel from './EntitySummaryPanel.component';
import { mockApplicationEntityDetails } from './mocks/ApplicationSummary.mock';
import { mockDashboardEntityDetails } from './mocks/DashboardSummary.mock';
import { mockDomainEntityDetails } from './mocks/DomainSummary.mock';
import { mockGlossaryEntityDetails } from './mocks/GlossarySummary.mock';
import { mockMlModelEntityDetails } from './mocks/MlModelSummary.mock';
import { mockPipelineEntityDetails } from './mocks/PipelineSummary.mock';
import { mockTableEntityDetails } from './mocks/TableSummary.mock';
import { mockTagEntityDetails } from './mocks/TagSummary.mock';
import { mockTopicEntityDetails } from './mocks/TopicSummary.mock';

const mockHandleClosePanel = jest.fn();

jest.mock('../../../utils/EntityUtils', () => {
  const LINEAGE_TABS_SET = new Set([
    'apiEndpoint',
    'chart',
    'container',
    'dashboard',
    'dashboardDataModel',
    'directory',
    'mlmodel',
    'pipeline',
    'searchIndex',
    'table',
    'topic',
  ]);
  const SCHEMA_TABS_SET = new Set([
    'apiCollection',
    'apiEndpoint',
    'container',
    'dashboard',
    'dashboardDataModel',
    'database',
    'databaseSchema',
    'pipeline',
    'searchIndex',
    'table',
    'topic',
  ]);
  const CUSTOM_PROPERTIES_TABS_SET = new Set([
    'apiCollection',
    'apiEndpoint',
    'chart',
    'container',
    'dashboard',
    'dashboardDataModel',
    'database',
    'databaseSchema',
    'dataProduct',
    'directory',
    'domain',
    'file',
    'glossaryTerm',
    'metric',
    'mlmodel',
    'pipeline',
    'searchIndex',
    'spreadsheet',
    'storedProcedure',
    'table',
    'topic',
    'worksheet',
  ]);

  return {
    getEntityLinkFromType: jest.fn().mockImplementation(() => 'link'),
    getEntityName: jest.fn().mockImplementation(() => 'displayName'),
    getEntityOverview: jest.fn().mockImplementation(() => []),
    hasLineageTab: jest.fn((entityType) => LINEAGE_TABS_SET.has(entityType)),
    hasSchemaTab: jest.fn((entityType) => SCHEMA_TABS_SET.has(entityType)),
    hasCustomPropertiesTab: jest.fn((entityType) =>
      CUSTOM_PROPERTIES_TABS_SET.has(entityType)
    ),
  };
});
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

jest.mock('../../common/OwnerUserList/OwnerUserList.component', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="owner-user-list">OwnerUserList</div>
    )),
}));

jest.mock('../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: jest.fn().mockReturnValue('/entity/link'),
    getEntityIcon: jest.fn().mockReturnValue(<span>Icon</span>),
    getEntitySummaryComponent: jest.fn().mockReturnValue(null),
  },
}));

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: jest.fn().mockReturnValue('/entity/link'),
    getEntityPatchAPI: jest.fn(),
    getEntityByFqn: jest.fn(),
    getFormattedEntityType: jest.fn((type) => type),
  },
}));

const mockOnDisplayNameUpdate = jest.fn();

jest.mock('../../common/EntityTitleSection/EntityTitleSection', () => ({
  EntityTitleSection: jest.fn().mockImplementation((props) => (
    <div data-testid="entity-title-section">
      <span data-testid="entity-display-name">
        {props.entityDisplayName ??
          props.entityDetails?.displayName ??
          props.entityDetails?.name}
      </span>
      {props.hasEditPermission &&
        props.entityType &&
        props.entityDetails?.id && (
          <button
            data-testid="edit-displayName-button"
            onClick={() => {
              if (props.onDisplayNameUpdate) {
                props.onDisplayNameUpdate('Updated Display Name');
                mockOnDisplayNameUpdate('Updated Display Name');
              }
            }}>
            Edit
          </button>
        )}
    </div>
  )),
}));

const mockGetTableDetailsByFQN = jest.fn();

jest.mock('../../../rest/tableAPI', () => ({
  getTableDetailsByFQN: (...args: unknown[]) =>
    mockGetTableDetailsByFQN(...args),
  patchTableDetails: jest.fn(),
}));

describe('EntitySummaryPanel component tests', () => {
  it('TableSummary should render for table data', async () => {
    render(
      <EntitySummaryPanel
        entityDetails={{
          details: {
            ...mockTableEntityDetails,
            entityType: EntityType.TABLE,
          },
        }}
        handleClosePanel={mockHandleClosePanel}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('TableSummary')).toBeInTheDocument();
    });

    const tableSummary = screen.getByTestId('TableSummary');

    expect(tableSummary).toBeInTheDocument();
  });

  it('TopicSummary should render for topics data', async () => {
    render(
      <EntitySummaryPanel
        entityDetails={{
          details: {
            ...mockTopicEntityDetails,
            entityType: EntityType.TOPIC,
          },
        }}
        handleClosePanel={mockHandleClosePanel}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('TopicSummary')).toBeInTheDocument();
    });

    const topicSummary = screen.getByTestId('TopicSummary');

    expect(topicSummary).toBeInTheDocument();
  });

  it('DashboardSummary should render for dashboard data', async () => {
    render(
      <EntitySummaryPanel
        entityDetails={{
          details: {
            ...mockDashboardEntityDetails,
            entityType: EntityType.DASHBOARD,
          },
        }}
        handleClosePanel={mockHandleClosePanel}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('DashboardSummary')).toBeInTheDocument();
    });

    const dashboardSummary = screen.getByTestId('DashboardSummary');

    expect(dashboardSummary).toBeInTheDocument();
  });

  it('PipelineSummary should render for pipeline data', async () => {
    render(
      <EntitySummaryPanel
        entityDetails={{
          details: {
            ...mockPipelineEntityDetails,
            entityType: EntityType.PIPELINE,
          },
        }}
        handleClosePanel={mockHandleClosePanel}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('PipelineSummary')).toBeInTheDocument();
    });

    const pipelineSummary = screen.getByTestId('PipelineSummary');

    expect(pipelineSummary).toBeInTheDocument();
  });

  it('MlModelSummary should render for mlModel data', async () => {
    render(
      <EntitySummaryPanel
        entityDetails={{
          details: {
            ...mockMlModelEntityDetails,
            entityType: EntityType.MLMODEL,
          },
        }}
        handleClosePanel={mockHandleClosePanel}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('MlModelSummary')).toBeInTheDocument();
    });

    const mlModelSummary = screen.getByTestId('MlModelSummary');

    expect(mlModelSummary).toBeInTheDocument();
  });

  it('ChartSummary should render for chart data', async () => {
    render(
      <EntitySummaryPanel
        entityDetails={{
          details: {
            ...mockMlModelEntityDetails,
            entityType: EntityType.CHART,
          },
        }}
        handleClosePanel={mockHandleClosePanel}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('ChartSummary')).toBeInTheDocument();
    });

    const chartSummary = screen.getByTestId('ChartSummary');

    expect(chartSummary).toBeInTheDocument();
  });

  it('should render for domain data without requesting invalid domains field', async () => {
    const { container } = render(
      <EntitySummaryPanel
        entityDetails={{
          details: {
            ...mockDomainEntityDetails,
            entityType: EntityType.DOMAIN,
          },
        }}
        handleClosePanel={mockHandleClosePanel}
      />
    );

    await waitFor(() => {
      expect(
        container.querySelector('.entity-summary-panel-container')
      ).toBeInTheDocument();
    });

    expect(
      container.querySelector('.entity-summary-panel-container')
    ).toBeInTheDocument();
  });

  it('should render drawer header when isSideDrawer is true', async () => {
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
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('drawer-close-icon')).toBeInTheDocument();
    });

    const closeIcon = screen.getByTestId('drawer-close-icon');

    expect(closeIcon).toBeInTheDocument();
  });

  it('should not render drawer header when isSideDrawer is false', async () => {
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
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('drawer-close-icon')).not.toBeInTheDocument();
    });

    const closeIcon = screen.queryByTestId('drawer-close-icon');

    expect(closeIcon).not.toBeInTheDocument();
  });

  it('should apply drawer-specific CSS classes when isSideDrawer is true', async () => {
    const { container } = render(
      <EntitySummaryPanel
        isSideDrawer
        entityDetails={{
          details: {
            ...mockTableEntityDetails,
            entityType: EntityType.TABLE,
          },
        }}
        handleClosePanel={mockHandleClosePanel}
      />
    );

    await waitFor(() => {
      expect(
        container.querySelector('.drawer-summary-panel-container')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.drawer-content-area')
      ).toBeInTheDocument();
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

      const { container } = render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        const loaders = container.querySelectorAll('[data-testid="loader"]');

        expect(loaders.length).toBeGreaterThan(0);
      });

      // Should show loader initially while permissions load
      const loaders = container.querySelectorAll('[data-testid="loader"]');

      expect(loaders.length).toBeGreaterThan(0);
    });

    it('should handle entity type that supports lineage', async () => {
      render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('TableSummary')).toBeInTheDocument();
      });

      // Table entity should render (tables support lineage)
      const tableSummary = screen.getByTestId('TableSummary');

      expect(tableSummary).toBeInTheDocument();
    });

    it('should handle entity type that does not support lineage gracefully', async () => {
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
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableSummary')).not.toBeInTheDocument();
      });

      // Should still render without crashing, even though USER doesn't support lineage
      expect(screen.queryByTestId('TableSummary')).not.toBeInTheDocument();
    });

    it('should handle missing lineageData gracefully', async () => {
      render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('TableSummary')).toBeInTheDocument();
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

      render(
        <EntitySummaryPanel
          entityDetails={{
            details: entityWithoutFQN,
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('TableSummary')).toBeInTheDocument();
      });

      // Should still render without crashing
      const tableSummary = screen.getByTestId('TableSummary');

      expect(tableSummary).toBeInTheDocument();
    });

    it('should handle missing entityType gracefully', async () => {
      render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              entityType: undefined as unknown as EntityType,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('entity-summary-panel-container')
        ).toBeInTheDocument();
      });

      // Should still render without crashing, even though entityType is missing
      // (component may show generic summary or error placeholder)
      const tableSummary = screen.getByTestId('permission-error-placeholder');

      expect(tableSummary).toBeInTheDocument();
    });

    it('should handle missing entityDetails gracefully', async () => {
      render(
        <EntitySummaryPanel
          entityDetails={{
            details: null as unknown as never,
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableSummary')).not.toBeInTheDocument();
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

      render(
        <EntitySummaryPanel
          entityDetails={{
            details: entityWithoutId,
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableSummary')).not.toBeInTheDocument();
      });

      // Should not crash when id is missing (component may show loader or not render summary)
      // The component should handle missing id gracefully without throwing errors
      expect(screen.queryByTestId('TableSummary')).not.toBeInTheDocument();
    });

    it('should handle entity type change correctly', async () => {
      mockGetTableDetailsByFQN.mockResolvedValue(mockTableEntityDetails);
      const { rerender } = render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('TableSummary')).toBeInTheDocument();
      });

      rerender(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockTopicEntityDetails,
              entityType: EntityType.TOPIC,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('TopicSummary')).toBeInTheDocument();
      });

      expect(screen.getByTestId('TopicSummary')).toBeInTheDocument();
    });

    it('should handle missing fullyQualifiedName gracefully', async () => {
      const entityWithoutFQN = {
        ...mockTableEntityDetails,
        fullyQualifiedName: undefined,
      };

      render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...entityWithoutFQN,
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('TableSummary')).toBeInTheDocument();
      });

      // Should still render without crashing
      const tableSummary = screen.getByTestId('TableSummary');

      expect(tableSummary).toBeInTheDocument();
    });

    it('should handle entity details change correctly', async () => {
      const { rerender } = render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              id: 'table-1',
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('TableSummary')).toBeInTheDocument();
      });

      rerender(
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
      );

      await waitFor(() => {
        expect(screen.getByTestId('TableSummary')).toBeInTheDocument();
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

      const { container } = render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        const loaders = container.querySelectorAll('[data-testid="loader"]');

        expect(loaders.length).toBeGreaterThan(0);
        expect(mockGetEntityPermission).toHaveBeenCalled();
      });

      // Should show loader while permission is loading
      const loaders = container.querySelectorAll('[data-testid="loader"]');

      expect(loaders.length).toBeGreaterThan(0);
      expect(mockGetEntityPermission).toHaveBeenCalled();
    });
  });

  describe('Display Name Update in Drawer Mode', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockOnDisplayNameUpdate.mockClear();
      mockGetTableDetailsByFQN.mockResolvedValue({
        ...mockTableEntityDetails,
        displayName: 'Fetched Display Name',
        owners: [],
        domains: [],
        tags: [],
      });
    });

    it('should render EntityTitleSection with edit button when isSideDrawer is true and has edit permission', async () => {
      (
        usePermissionProvider().getEntityPermission as jest.Mock
      ).mockResolvedValue({
        ViewBasic: true,
        EditDisplayName: true,
      });

      render(
        <EntitySummaryPanel
          isSideDrawer
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              id: 'test-table-id',
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('entity-title-section')).toBeInTheDocument();
        expect(
          screen.queryByTestId('edit-displayName-button')
        ).toBeInTheDocument();
      });

      const entityTitleSection = screen.getByTestId('entity-title-section');

      expect(entityTitleSection).toBeInTheDocument();

      const editButton = screen.queryByTestId('edit-displayName-button');

      expect(editButton).toBeInTheDocument();
    });

    it('should not render edit button when user lacks EditDisplayName permission', async () => {
      (
        usePermissionProvider().getEntityPermission as jest.Mock
      ).mockResolvedValue({
        ViewBasic: true,
        EditDisplayName: false,
      });

      render(
        <EntitySummaryPanel
          isSideDrawer
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              id: 'test-table-id',
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(
          screen.queryByTestId('edit-displayName-button')
        ).not.toBeInTheDocument();
      });

      const editButton = screen.queryByTestId('edit-displayName-button');

      expect(editButton).not.toBeInTheDocument();
    });

    it('should call onDisplayNameUpdate callback when display name is updated', async () => {
      (
        usePermissionProvider().getEntityPermission as jest.Mock
      ).mockResolvedValue({
        ViewBasic: true,
        EditDisplayName: true,
      });

      render(
        <EntitySummaryPanel
          isSideDrawer
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              id: 'test-table-id',
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('edit-displayName-button')
        ).toBeInTheDocument();
      });

      const editButton = screen.getByTestId('edit-displayName-button');

      await act(async () => {
        fireEvent.click(editButton);
      });

      expect(mockOnDisplayNameUpdate).toHaveBeenCalledWith(
        'Updated Display Name'
      );
    });

    it('should display updated displayName after update', async () => {
      (
        usePermissionProvider().getEntityPermission as jest.Mock
      ).mockResolvedValue({
        ViewBasic: true,
        EditDisplayName: true,
      });

      mockGetTableDetailsByFQN.mockResolvedValue({
        ...mockTableEntityDetails,
        displayName: 'Initial Display Name',
        owners: [],
        domains: [],
        tags: [],
      });

      render(
        <EntitySummaryPanel
          isSideDrawer
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              id: 'test-table-id',
              displayName: 'Initial Display Name',
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('entity-display-name')).toBeInTheDocument();
      });

      await waitFor(() => {
        const displayNameElement = screen.getByTestId('entity-display-name');

        expect(displayNameElement).toBeInTheDocument();
      });

      const editButton = screen.getByTestId('edit-displayName-button');

      await act(async () => {
        fireEvent.click(editButton);
      });

      await waitFor(() => {
        const displayNameElement = screen.getByTestId('entity-display-name');

        expect(displayNameElement).toHaveTextContent('Updated Display Name');
      });
    });

    it('should render entity-header-title testId in drawer mode', async () => {
      render(
        <EntitySummaryPanel
          isSideDrawer
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              id: 'test-table-id',
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('entity-title-section')).toBeInTheDocument();
      });

      const entityTitleSection = screen.getByTestId('entity-title-section');

      expect(entityTitleSection).toBeInTheDocument();
    });

    it('should pass entityDisplayName from entityData to EntityTitleSection', async () => {
      const mockEntityData = {
        ...mockTableEntityDetails,
        displayName: 'EntityData Display Name',
        owners: [],
        domains: [],
        tags: [],
      };

      mockGetTableDetailsByFQN.mockResolvedValue(mockEntityData);

      (
        usePermissionProvider().getEntityPermission as jest.Mock
      ).mockResolvedValue({
        ViewBasic: true,
        EditDisplayName: true,
      });

      render(
        <EntitySummaryPanel
          isSideDrawer
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              id: 'test-table-id',
              displayName: 'Original Display Name',
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        const displayNameElement = screen.getByTestId('entity-display-name');

        expect(displayNameElement).toHaveTextContent('EntityData Display Name');
      });
    });
  });

  describe('Fallback Patch API Mechanism', () => {
    const mockPatchAPI = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      (entityUtilClassBase.getEntityPatchAPI as jest.Mock).mockReturnValue(
        mockPatchAPI
      );
    });

    describe('Entity types that require fallback API', () => {
      it('should render GLOSSARY entity without errors', async () => {
        (
          usePermissionProvider().getEntityPermission as jest.Mock
        ).mockResolvedValue({
          ViewBasic: true,
          EditAll: true,
        });

        render(
          <EntitySummaryPanel
            entityDetails={{
              details: {
                ...mockGlossaryEntityDetails,
                entityType: EntityType.GLOSSARY,
              },
            }}
            handleClosePanel={mockHandleClosePanel}
          />
        );

        await waitFor(() => {
          expect(
            screen.getByTestId('entity-summary-panel-container')
          ).toBeInTheDocument();
        });
      });

      it('should render TAG entity without errors', async () => {
        (
          usePermissionProvider().getEntityPermission as jest.Mock
        ).mockResolvedValue({
          ViewBasic: true,
          EditAll: true,
        });

        render(
          <EntitySummaryPanel
            entityDetails={{
              details: {
                ...mockTagEntityDetails,
                entityType: EntityType.TAG,
              },
            }}
            handleClosePanel={mockHandleClosePanel}
          />
        );

        await waitFor(() => {
          expect(
            screen.getByTestId('entity-summary-panel-container')
          ).toBeInTheDocument();
        });
      });

      it('should render APPLICATION entity without errors', async () => {
        (
          usePermissionProvider().getEntityPermission as jest.Mock
        ).mockResolvedValue({
          ViewBasic: true,
          EditAll: true,
        });

        render(
          <EntitySummaryPanel
            entityDetails={{
              details: {
                ...mockApplicationEntityDetails,
                entityType: EntityType.APPLICATION,
              },
            }}
            handleClosePanel={mockHandleClosePanel}
          />
        );

        await waitFor(() => {
          expect(
            screen.getByTestId('entity-summary-panel-container')
          ).toBeInTheDocument();
        });
      });
    });

    describe('Non-fallback path verification', () => {
      it('should NOT use fallback for TABLE entity which exists in entityUpdateMap', async () => {
        (
          usePermissionProvider().getEntityPermission as jest.Mock
        ).mockResolvedValue({
          ViewBasic: true,
          EditAll: true,
        });

        render(
          <EntitySummaryPanel
            entityDetails={{
              details: {
                ...mockTableEntityDetails,
                entityType: EntityType.TABLE,
              },
            }}
            handleClosePanel={mockHandleClosePanel}
          />
        );

        await waitFor(() => {
          expect(screen.getByTestId('TableSummary')).toBeInTheDocument();
        });

        expect(entityUtilClassBase.getEntityPatchAPI).not.toHaveBeenCalled();
      });

      it('should NOT use fallback for TOPIC entity which exists in entityUpdateMap', async () => {
        (
          usePermissionProvider().getEntityPermission as jest.Mock
        ).mockResolvedValue({
          ViewBasic: true,
          EditAll: true,
        });

        render(
          <EntitySummaryPanel
            entityDetails={{
              details: {
                ...mockTopicEntityDetails,
                entityType: EntityType.TOPIC,
              },
            }}
            handleClosePanel={mockHandleClosePanel}
          />
        );

        await waitFor(() => {
          expect(screen.getByTestId('TopicSummary')).toBeInTheDocument();
        });

        expect(entityUtilClassBase.getEntityPatchAPI).not.toHaveBeenCalled();
      });

      it('should NOT use fallback for DASHBOARD entity which exists in entityUpdateMap', async () => {
        (
          usePermissionProvider().getEntityPermission as jest.Mock
        ).mockResolvedValue({
          ViewBasic: true,
          EditAll: true,
        });

        render(
          <EntitySummaryPanel
            entityDetails={{
              details: {
                ...mockDashboardEntityDetails,
                entityType: EntityType.DASHBOARD,
              },
            }}
            handleClosePanel={mockHandleClosePanel}
          />
        );

        await waitFor(() => {
          expect(screen.getByTestId('DashboardSummary')).toBeInTheDocument();
        });

        expect(entityUtilClassBase.getEntityPatchAPI).not.toHaveBeenCalled();
      });
    });
  });
});
