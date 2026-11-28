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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { ResourceEntity } from '../../../enums/permissions.enum';
import { Include } from '../../../generated/type/include';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import searchClassBase from '../../../utils/SearchClassBase';
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

// Chip styles are looked up through React Query; these tests do not cover
// chip styling and render without a QueryClientProvider.
jest.mock('../../../hooks/governance/domain/useDomainStyles', () => ({
  useDomainStyles: jest.fn().mockReturnValue(new Map()),
}));

const mockHandleClosePanel = jest.fn();

jest.mock('../../../utils/EntityLinkUtils', () => ({
  getEntityLinkFromType: jest.fn().mockImplementation(() => 'link'),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockImplementation(() => 'displayName'),
}));

jest.mock('../../../utils/EntityPermissionUtils', () => {
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
    hasLineageTab: jest.fn((entityType) => LINEAGE_TABS_SET.has(entityType)),
    hasSchemaTab: jest.fn((entityType) => SCHEMA_TABS_SET.has(entityType)),
    hasCustomPropertiesTab: jest.fn((entityType) =>
      CUSTOM_PROPERTIES_TABS_SET.has(entityType)
    ),
  };
});

jest.mock('../../../utils/DataAssetSummaryPanelUtils', () => ({
  getEntityOverview: jest.fn().mockImplementation(() => []),
}));
jest.mock('../../../utils/EntityPureUtils', () => ({
  DRAWER_NAVIGATION_OPTIONS: [],
}));
jest.mock('../../../utils/StringUtils', () => ({
  getEncodedFqn: jest.fn().mockImplementation((fqn) => fqn),
  bytesToSize: jest.fn(),
  ordinalize: jest.fn(),
}));

jest.mock('../../../utils/RichTextStringUtils', () => ({
  stringToHTML: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => ({ tab: 'table' })),
  Link: jest.fn().mockImplementation(({ children }) => <>{children}</>),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

// The panel now reads permissions via useEntityPermissions rather than the raw
// PermissionProvider context — see TableDetailsPageV1.test.tsx's setMockPermissions for the
// full rationale (partial-object fidelity, mockReturnValue over mockImplementationOnce, the
// `deleted`-gating blind spot), mirrored here without repeating it. Default grants ViewBasic
// + ViewCustomFields, matching the old global usePermissionProvider mock's default return
// value — most tests below don't care about permissions specifics and rely on this.
const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (
  overrides: Partial<OperationPermission> = {},
  {
    isLoading = false,
    error = null as unknown,
  }: { isLoading?: boolean; error?: unknown } = {}
) => {
  const permissions = overrides as OperationPermission;
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading,
    error,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, false),
  });
};

jest.mock('../../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

// Not converted by this task, and NOT the panel's own permission source (that's the mock
// above) — DataAssetSummaryPanelV1 is a real, unmocked child this suite renders (the
// default overview component, per searchClassBase.getEntitySummaryPanelComponents()'s empty
// mock below) and it still calls usePermissionProvider().getEntityPermission() internally.
// Kept only so that untouched component doesn't crash when actually rendered.
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
    getEntitySummaryPanelComponents: jest.fn().mockReturnValue({}),
    getEntitySummaryPanelType: jest.fn((entityType: string) => entityType),
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

const mockGetLineageDataByFQN = jest.fn();

jest.mock('../../../rest/lineageAPI', () => ({
  ...jest.requireActual('../../../rest/lineageAPI'),
  getLineageDataByFQN: (...args: unknown[]) => mockGetLineageDataByFQN(...args),
}));

const mockGetListTestCaseBySearch = jest.fn();

jest.mock('../../../rest/testAPI', () => ({
  ...jest.requireActual('../../../rest/testAPI'),
  getListTestCaseBySearch: (...args: unknown[]) =>
    mockGetListTestCaseBySearch(...args),
}));

const mockGetTableDetailsByFQN = jest.fn();

const mockGetColumnByFQN = jest.fn();
const mockPatchTableDetails = jest.fn();
const mockUpdateTableColumn = jest.fn();
jest.mock('../../../rest/tableAPI', () => ({
  getColumnByFQN: (...args: unknown[]) => mockGetColumnByFQN(...args),
  getTableDetailsByFQN: (...args: unknown[]) =>
    mockGetTableDetailsByFQN(...args),
  patchTableDetails: (...args: unknown[]) => mockPatchTableDetails(...args),
  updateTableColumn: (...args: unknown[]) => mockUpdateTableColumn(...args),
}));

const mockGetTypeByFQN = jest.fn();
jest.mock('../../../rest/metadataTypeAPI', () => ({
  getTypeByFQN: (...args: unknown[]) => mockGetTypeByFQN(...args),
}));

// The global setupTests.js mock only stubs showErrorToast; the panel's
// post-PATCH handler also calls showSuccessToast, so stub it here too.
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

// The custom-properties tab is only rendered when the user switches to it, so
// this mock is inert for every existing test (which stays on the Overview tab).
// It lets the extension-persistence test drive `onExtensionUpdate` without
// standing up the real CustomPropertyListItem / type-detail machinery.
jest.mock('./CustomPropertiesSection/CustomPropertiesSection', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(
      (props: {
        entityData?: { extension?: unknown };
        onExtensionUpdate?: (ext: Record<string, unknown>) => void;
      }) => (
        <div data-testid="custom-properties-section-mock">
          <span data-testid="captured-extension">
            {JSON.stringify(props.entityData?.extension ?? {})}
          </span>
          <button
            data-testid="trigger-extension-update"
            onClick={() => props.onExtensionUpdate?.({ foo: 'bar' })}>
            Update
          </button>
        </div>
      )
    ),
}));

describe('EntitySummaryPanel component tests', () => {
  beforeEach(() => {
    setMockPermissions({ ViewBasic: true, ViewCustomFields: true });
  });

  afterEach(() => {
    (
      searchClassBase.getEntitySummaryPanelComponents as jest.Mock
    ).mockReturnValue({});
    (searchClassBase.getEntitySummaryPanelType as jest.Mock).mockImplementation(
      (entityType: string) => entityType
    );
  });

  // No same-args guardrail here (unlike every other file in this batch): both the resource
  // AND the identifier legitimately vary within a single test in this suite — see "should
  // handle entity type change correctly" and "should handle entity details change
  // correctly" below, which each `rerender()` with a genuinely different selected entity
  // inside one `it`. Coverage instead comes from the dedicated identifier-assertion tests in
  // the "Permission identifier resolution" describe below (one per precedence branch:
  // by-id, tableColumn-inherits-parent-table, and ontology-panel-by-fqn).

  it('renders a custom summary panel component when the search class provides one', async () => {
    const CustomSummaryPanel = () => (
      <div data-testid="custom-summary-panel">Custom Summary</div>
    );
    const tableEntity = {
      ...mockTableEntityDetails,
      entityType: EntityType.TABLE,
    };

    (
      searchClassBase.getEntitySummaryPanelComponents as jest.Mock
    ).mockReturnValue({
      [EntityType.TABLE]: CustomSummaryPanel,
    });
    setMockPermissions({ ViewBasic: true });
    mockGetTableDetailsByFQN.mockResolvedValueOnce(tableEntity);

    render(
      <EntitySummaryPanel
        entityDetails={{ details: tableEntity }}
        handleClosePanel={mockHandleClosePanel}
      />
    );

    expect(
      await screen.findByTestId('custom-summary-panel')
    ).toBeInTheDocument();
  });

  it('should fetch extension entities using their original entity type', async () => {
    const extensionEntityType = 'aiDashboard' as EntityType;
    const extensionEntity = {
      ...mockDashboardEntityDetails,
      entityType: extensionEntityType,
    };

    (searchClassBase.getEntitySummaryPanelType as jest.Mock).mockReturnValue(
      EntityType.ALL
    );
    (entityUtilClassBase.getEntityByFqn as jest.Mock).mockResolvedValueOnce(
      extensionEntity
    );

    render(
      <EntitySummaryPanel
        entityDetails={{ details: extensionEntity }}
        handleClosePanel={mockHandleClosePanel}
      />
    );

    await waitFor(() => {
      expect(entityUtilClassBase.getEntityByFqn).toHaveBeenCalledWith(
        extensionEntityType,
        extensionEntity.fullyQualifiedName,
        'owners,domains,tags,extension'
      );
    });
  });

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
      // Force the permission hook to report loading so we can reliably assert the initial
      // loader state.
      setMockPermissions({}, { isLoading: true });

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
      // With entityType missing, the page computes no valid ResourceEntity and passes
      // `enabled: false` to useEntityPermissions — but the mocked hook (unlike the real one)
      // doesn't know about `enabled`, so this simulates the always-denied outcome directly
      // to verify the render gate (hasViewAccess driving the permission placeholder) rather
      // than the hook's own enabled-computation, which a mocked hook can't exercise.
      setMockPermissions({ ViewBasic: false, ViewAll: false });

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
      // With no entity selected (id empty), the page passes `enabled: false` to
      // useEntityPermissions — see "should handle missing entityType gracefully" above for
      // why this is simulated directly rather than relying on the mocked hook to honor
      // `enabled`.
      setMockPermissions({ ViewBasic: false, ViewAll: false });

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
      // Same rationale as above: id is empty, so useEntityPermissions is disabled.
      setMockPermissions({ ViewBasic: false, ViewAll: false });

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
      setMockPermissions({ ViewBasic: true }, { isLoading: true });

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
        expect(mockUseEntityPermissions).toHaveBeenCalled();
      });

      // Should show loader while permission is loading
      const loaders = container.querySelectorAll('[data-testid="loader"]');

      expect(loaders.length).toBeGreaterThan(0);
      expect(mockUseEntityPermissions).toHaveBeenCalled();
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
      setMockPermissions({ ViewBasic: true, EditDisplayName: true });

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
      setMockPermissions({ ViewBasic: true, EditDisplayName: false });

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
      setMockPermissions({ ViewBasic: true, EditDisplayName: true });

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
      setMockPermissions({ ViewBasic: true, EditDisplayName: true });

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

      setMockPermissions({ ViewBasic: true, EditDisplayName: true });

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
        setMockPermissions({ ViewBasic: true, EditAll: true });

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
        setMockPermissions({ ViewBasic: true, EditAll: true });

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
        setMockPermissions({ ViewBasic: true, EditAll: true });

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
        setMockPermissions({ ViewBasic: true, EditAll: true });

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
        setMockPermissions({ ViewBasic: true, EditAll: true });

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
        setMockPermissions({ ViewBasic: true, EditAll: true });

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

  describe('entityData sync when onEntityUpdate is provided (Lineage drawer)', () => {
    it('shows the column extension from the API, not the stale search hit', async () => {
      const columnHit = {
        ...mockTableEntityDetails,
        entityType: EntityType.TABLE_COLUMN,
        table: { id: 'parent-table-id' },
        extension: {},
      };
      mockGetColumnByFQN.mockResolvedValueOnce({
        name: columnHit.name,
        extension: { helloWorld: ['hello'] },
      });

      (
        searchClassBase.getEntitySummaryPanelComponents as jest.Mock
      ).mockReturnValue({
        [EntityType.TABLE_COLUMN]: (props: {
          dataAsset?: { extension?: object; table?: object };
        }) => (
          <div data-testid="captured-column">
            {JSON.stringify({
              extension: props.dataAsset?.extension,
              table: props.dataAsset?.table,
            })}
          </div>
        ),
      });

      render(
        <EntitySummaryPanel
          entityDetails={{ details: columnHit as unknown as never }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('captured-column')).toHaveTextContent(
          JSON.stringify({
            extension: { helloWorld: ['hello'] },
            table: { id: 'parent-table-id' },
          })
        );
      });

      expect(mockGetColumnByFQN).toHaveBeenCalledWith(
        columnHit.fullyQualifiedName,
        {
          entityType: EntityType.TABLE,
          fields: 'tags,extension',
          include: Include.All,
        }
      );
    });

    it('ignores a late response for a previously selected column', async () => {
      const columnHit = (fqn: string) => ({
        ...mockTableEntityDetails,
        id: fqn,
        fullyQualifiedName: fqn,
        entityType: EntityType.TABLE_COLUMN,
        table: { id: 'parent-table-id' },
        extension: {},
      });
      let resolveFirst: (value: object) => void = jest.fn();
      mockGetColumnByFQN
        .mockImplementationOnce(
          () => new Promise((resolve) => (resolveFirst = resolve))
        )
        .mockResolvedValueOnce({ extension: { owner: 'second' } });

      (
        searchClassBase.getEntitySummaryPanelComponents as jest.Mock
      ).mockReturnValue({
        [EntityType.TABLE_COLUMN]: (props: {
          dataAsset?: { extension?: object };
        }) => (
          <div data-testid="captured-column">
            {JSON.stringify(props.dataAsset?.extension)}
          </div>
        ),
      });

      const { rerender } = render(
        <EntitySummaryPanel
          entityDetails={{
            details: columnHit('svc.db.schema.t.first') as unknown as never,
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );
      rerender(
        <EntitySummaryPanel
          entityDetails={{
            details: columnHit('svc.db.schema.t.second') as unknown as never,
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('captured-column')).toHaveTextContent(
          JSON.stringify({ owner: 'second' })
        );
      });

      await act(async () => {
        resolveFirst({ extension: { owner: 'first' } });
      });

      expect(screen.getByTestId('captured-column')).toHaveTextContent(
        JSON.stringify({ owner: 'second' })
      );
    });

    it('should refresh the rendered dataAsset immediately, not just notify onEntityUpdate', async () => {
      const mockOnEntityUpdate = jest.fn();
      const tableEntity = {
        ...mockTableEntityDetails,
        entityType: EntityType.TABLE,
        tags: [],
      };

      const CapturingSummaryPanel = jest
        .fn()
        .mockImplementation((props) => (
          <div data-testid="captured-tags-count">
            {props.dataAsset?.tags?.length ?? 0}
          </div>
        ));

      (
        searchClassBase.getEntitySummaryPanelComponents as jest.Mock
      ).mockReturnValue({
        [EntityType.TABLE]: CapturingSummaryPanel,
      });
      mockGetTableDetailsByFQN.mockResolvedValueOnce(tableEntity);

      render(
        <EntitySummaryPanel
          entityDetails={{ details: tableEntity }}
          handleClosePanel={mockHandleClosePanel}
          onEntityUpdate={mockOnEntityUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('captured-tags-count')).toHaveTextContent(
          '0'
        );
      });

      const newTag = {
        tagFQN: 'Tier.Tier1',
        source: 'Classification',
        labelType: 'Manual',
        state: 'Confirmed',
      };
      const latestProps =
        CapturingSummaryPanel.mock.calls[
          CapturingSummaryPanel.mock.calls.length - 1
        ][0];

      act(() => {
        latestProps.onTierUpdate(newTag);
      });

      // The parent (Lineage graph) still gets notified.
      expect(mockOnEntityUpdate).toHaveBeenCalledWith({ tags: [newTag] });

      // The panel's own render must reflect the update right away, without
      // waiting for a refetch (e.g. panel close/reopen).
      await waitFor(() => {
        expect(screen.getByTestId('captured-tags-count')).toHaveTextContent(
          '1'
        );
      });
    });
  });

  // Regression coverage for the Lineage-drawer edit-persistence bug: when
  // onEntityUpdate is wired, handleTagsUpdate / handleGlossaryTermsUpdate /
  // handleOwnerUpdate / handleExtensionUpdate must still PATCH the server AND
  // sync the panel's own entityData AND notify the parent — instead of the old
  // early-return that only notified the parent (no PATCH, no sync), which
  // silently dropped the edit and let a later sibling save roll it back.
  describe('Edit persistence when onEntityUpdate is wired (Lineage drawer)', () => {
    beforeEach(() => {
      mockPatchTableDetails.mockReset();
      mockUpdateTableColumn.mockReset();
      mockGetTypeByFQN.mockReset();
      mockGetTableDetailsByFQN.mockReset();
      mockGetColumnByFQN.mockReset();
    });

    const capturePanel = (
      render_: (props: {
        dataAsset?: { tags?: unknown[]; owners?: unknown[] };
      }) => JSX.Element
    ) => {
      const CapturingSummaryPanel = jest.fn().mockImplementation(render_);

      (
        searchClassBase.getEntitySummaryPanelComponents as jest.Mock
      ).mockReturnValue({
        [EntityType.TABLE]: CapturingSummaryPanel,
      });

      return CapturingSummaryPanel;
    };

    const latestProps = (Mock: jest.Mock) =>
      Mock.mock.calls[Mock.mock.calls.length - 1][0];

    it('handleTagsUpdate patches the server, syncs entityData, and notifies onEntityUpdate with the focused partial', async () => {
      const mockOnEntityUpdate = jest.fn();
      const newTag = {
        tagFQN: 'PII.Sensitive',
        source: 'Classification',
        labelType: 'Manual',
        state: 'Confirmed',
      };
      const tableEntity = {
        ...mockTableEntityDetails,
        entityType: EntityType.TABLE,
        tags: [],
      };

      const CapturingSummaryPanel = capturePanel((props) => (
        <div data-testid="captured-tags-count">
          {props.dataAsset?.tags?.length ?? 0}
        </div>
      ));
      mockGetTableDetailsByFQN.mockResolvedValueOnce(tableEntity);
      mockPatchTableDetails.mockResolvedValueOnce({
        ...tableEntity,
        tags: [newTag],
      });

      render(
        <EntitySummaryPanel
          entityDetails={{ details: tableEntity }}
          handleClosePanel={mockHandleClosePanel}
          onEntityUpdate={mockOnEntityUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('captured-tags-count')).toHaveTextContent(
          '0'
        );
      });

      await act(async () => {
        await latestProps(CapturingSummaryPanel).onTagsUpdate([newTag]);
      });

      // 1) Server PATCH happened (the bug skipped this entirely).
      expect(mockPatchTableDetails).toHaveBeenCalledWith(
        tableEntity.id,
        expect.any(Array)
      );
      // 2) Parent (Lineage graph) is notified with the focused, id-free partial
      //    so updateNodeData still matches the node by its scene id.
      expect(mockOnEntityUpdate).toHaveBeenCalledWith({ tags: [newTag] });

      // 3) The panel's own entityData is synced, so it re-renders from the
      //    server-canonical value instead of a stale snapshot.
      await waitFor(() => {
        expect(screen.getByTestId('captured-tags-count')).toHaveTextContent(
          '1'
        );
      });
    });

    it('handleGlossaryTermsUpdate patches the server, syncs entityData, and notifies onEntityUpdate', async () => {
      const mockOnEntityUpdate = jest.fn();
      const newTerm = {
        tagFQN: 'Glossary.TermA',
        source: 'Glossary',
        labelType: 'Manual',
        state: 'Confirmed',
      };
      const tableEntity = {
        ...mockTableEntityDetails,
        entityType: EntityType.TABLE,
        tags: [],
      };

      const CapturingSummaryPanel = capturePanel((props) => (
        <div data-testid="captured-tags-count">
          {props.dataAsset?.tags?.length ?? 0}
        </div>
      ));
      mockGetTableDetailsByFQN.mockResolvedValueOnce(tableEntity);
      mockPatchTableDetails.mockResolvedValueOnce({
        ...tableEntity,
        tags: [newTerm],
      });

      render(
        <EntitySummaryPanel
          entityDetails={{ details: tableEntity }}
          handleClosePanel={mockHandleClosePanel}
          onEntityUpdate={mockOnEntityUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('captured-tags-count')).toHaveTextContent(
          '0'
        );
      });

      await act(async () => {
        await latestProps(CapturingSummaryPanel).onGlossaryTermsUpdate([
          newTerm,
        ]);
      });

      expect(mockPatchTableDetails).toHaveBeenCalledWith(
        tableEntity.id,
        expect.any(Array)
      );
      expect(mockOnEntityUpdate).toHaveBeenCalledWith({ tags: [newTerm] });

      await waitFor(() => {
        expect(screen.getByTestId('captured-tags-count')).toHaveTextContent(
          '1'
        );
      });
    });

    it('handleOwnerUpdate patches the server, syncs entityData, and notifies onEntityUpdate', async () => {
      const mockOnEntityUpdate = jest.fn();
      const newOwner = {
        id: 'user-1',
        type: 'user',
        name: 'alice',
        displayName: 'Alice',
      };
      const tableEntity = {
        ...mockTableEntityDetails,
        entityType: EntityType.TABLE,
        owners: [],
      };

      const CapturingSummaryPanel = capturePanel((props) => (
        <div data-testid="captured-owners-count">
          {props.dataAsset?.owners?.length ?? 0}
        </div>
      ));
      mockGetTableDetailsByFQN.mockResolvedValueOnce(tableEntity);
      mockPatchTableDetails.mockResolvedValueOnce({
        ...tableEntity,
        owners: [newOwner],
      });

      render(
        <EntitySummaryPanel
          entityDetails={{ details: tableEntity }}
          handleClosePanel={mockHandleClosePanel}
          onEntityUpdate={mockOnEntityUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('captured-owners-count')).toHaveTextContent(
          '0'
        );
      });

      await act(async () => {
        await latestProps(CapturingSummaryPanel).onOwnerUpdate([newOwner]);
      });

      expect(mockPatchTableDetails).toHaveBeenCalledWith(
        tableEntity.id,
        expect.any(Array)
      );
      expect(mockOnEntityUpdate).toHaveBeenCalledWith({ owners: [newOwner] });

      await waitFor(() => {
        expect(screen.getByTestId('captured-owners-count')).toHaveTextContent(
          '1'
        );
      });
    });

    it('handleTagsUpdate persists via updateTableColumn for a TABLE_COLUMN entity in the Lineage drawer', async () => {
      const mockOnEntityUpdate = jest.fn();
      const newTag = {
        tagFQN: 'PII.Sensitive',
        source: 'Classification',
        labelType: 'Manual',
        state: 'Confirmed',
      };
      const columnEntity = {
        ...mockTableEntityDetails,
        entityType: EntityType.TABLE_COLUMN,
        table: { id: 'parent-table-id' },
        tags: [],
      };

      const CapturingSummaryPanel = jest
        .fn()
        .mockImplementation((props) => (
          <div data-testid="captured-tags-count">
            {props.dataAsset?.tags?.length ?? 0}
          </div>
        ));
      (
        searchClassBase.getEntitySummaryPanelComponents as jest.Mock
      ).mockReturnValue({
        [EntityType.TABLE_COLUMN]: CapturingSummaryPanel,
      });
      mockGetColumnByFQN.mockResolvedValueOnce({
        name: columnEntity.name,
        tags: [],
      });
      mockUpdateTableColumn.mockResolvedValueOnce({
        ...columnEntity,
        tags: [newTag],
      });

      render(
        <EntitySummaryPanel
          entityDetails={{
            details: columnEntity as unknown as never,
          }}
          handleClosePanel={mockHandleClosePanel}
          onEntityUpdate={mockOnEntityUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('captured-tags-count')).toHaveTextContent(
          '0'
        );
      });

      await act(async () => {
        await latestProps(CapturingSummaryPanel).onTagsUpdate([newTag]);
      });

      // TABLE_COLUMN takes the column API, not the entityUpdateMap PATCH.
      expect(mockUpdateTableColumn).toHaveBeenCalledWith(
        columnEntity.fullyQualifiedName,
        { tags: [newTag] }
      );
      expect(mockOnEntityUpdate).toHaveBeenCalledWith({ tags: [newTag] });

      await waitFor(() => {
        expect(screen.getByTestId('captured-tags-count')).toHaveTextContent(
          '1'
        );
      });
    });

    it('handleExtensionUpdate patches the server, syncs entityData, and notifies onEntityUpdate (Custom Properties tab)', async () => {
      const mockOnEntityUpdate = jest.fn();
      const tableEntity = {
        ...mockTableEntityDetails,
        entityType: EntityType.TABLE,
        extension: {},
      };

      const CapturingSummaryPanel = jest
        .fn()
        .mockImplementation(() => (
          <div data-testid="overview-summary">overview</div>
        ));
      (
        searchClassBase.getEntitySummaryPanelComponents as jest.Mock
      ).mockReturnValue({
        [EntityType.TABLE]: CapturingSummaryPanel,
      });
      // The Custom Properties tab re-fires the entity fetch, so the table
      // details must resolve for every call, not just the first.
      mockGetTableDetailsByFQN.mockResolvedValue(tableEntity);
      mockGetTypeByFQN.mockResolvedValue({ customProperties: [] });
      mockPatchTableDetails.mockResolvedValueOnce({
        ...tableEntity,
        extension: { foo: 'bar' },
      });

      render(
        <EntitySummaryPanel
          entityDetails={{ details: tableEntity }}
          handleClosePanel={mockHandleClosePanel}
          onEntityUpdate={mockOnEntityUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('overview-summary')).toBeInTheDocument();
      });

      // Switch to the Custom Properties tab, where onExtensionUpdate is wired.
      fireEvent.click(screen.getByTestId('custom-properties-tab'));

      await waitFor(() => {
        expect(
          screen.getByTestId('custom-properties-section-mock')
        ).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('trigger-extension-update'));
      });

      await waitFor(() => {
        expect(mockPatchTableDetails).toHaveBeenCalledWith(
          tableEntity.id,
          expect.any(Array)
        );
      });

      expect(mockOnEntityUpdate).toHaveBeenCalledWith({
        extension: { foo: 'bar' },
      });

      // The panel's own entityData.extension is synced to the server response.
      await waitFor(() => {
        expect(screen.getByTestId('captured-extension')).toHaveTextContent(
          JSON.stringify({ foo: 'bar' })
        );
      });
    });

    it('a tag edit survives a later sibling tier save in the Lineage drawer (no rollback)', async () => {
      const mockOnEntityUpdate = jest.fn();
      const tagA: TagLabel = {
        tagFQN: 'Tag.A',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      };
      const newTag: TagLabel = {
        tagFQN: 'Tag.NEW',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      };
      const tier1: TagLabel = {
        tagFQN: 'Tier.Tier1',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      };
      const tier2: TagLabel = {
        tagFQN: 'Tier.Tier2',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      };
      const tableEntity = {
        ...mockTableEntityDetails,
        entityType: EntityType.TABLE,
        tags: [tagA, tier1],
      };

      const CapturingSummaryPanel = jest.fn().mockImplementation((props) => (
        <div data-testid="captured-tags-list">
          {(props.dataAsset?.tags ?? []).map((t: { tagFQN: string }) => (
            <span data-testid={`tag-${t.tagFQN}`} key={t.tagFQN}>
              {t.tagFQN}
            </span>
          ))}
        </div>
      ));
      (
        searchClassBase.getEntitySummaryPanelComponents as jest.Mock
      ).mockReturnValue({
        [EntityType.TABLE]: CapturingSummaryPanel,
      });
      mockGetTableDetailsByFQN.mockResolvedValueOnce(tableEntity);
      mockPatchTableDetails.mockResolvedValueOnce({
        ...tableEntity,
        tags: [tier1, tagA, newTag],
      });

      render(
        <EntitySummaryPanel
          entityDetails={{ details: tableEntity }}
          handleClosePanel={mockHandleClosePanel}
          onEntityUpdate={mockOnEntityUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('tag-Tag.A')).toBeInTheDocument();
        expect(screen.getByTestId('tag-Tier.Tier1')).toBeInTheDocument();
      });

      // 1) Add a tag via the tags section: PATCH + sync entityData + notify.
      await act(async () => {
        await latestProps(CapturingSummaryPanel).onTagsUpdate([tagA, newTag]);
      });

      await waitFor(() => {
        expect(screen.getByTestId('tag-Tag.NEW')).toBeInTheDocument();
      });

      // 2) Change the tier via the tier section — a sibling save that refreshes
      //    entityData. Before the fix, entityData was never synced by the tag
      //    edit, so this rebuilt the tags from the stale pre-edit snapshot and
      //    the new tag visibly rolled back.
      act(() => {
        latestProps(CapturingSummaryPanel).onTierUpdate(tier2);
      });

      // The previously-saved tag must NOT roll back.
      expect(screen.getByTestId('tag-Tag.NEW')).toBeInTheDocument();
      // And the new tier is present, the old tier is gone.
      expect(screen.getByTestId('tag-Tier.Tier2')).toBeInTheDocument();
      expect(screen.queryByTestId('tag-Tier.Tier1')).not.toBeInTheDocument();
    });

    it('handleTagsUpdate still patches the server and calls afterEntityUpdate when onEntityUpdate is not wired (Explore path)', async () => {
      const mockAfterEntityUpdate = jest.fn();
      const newTag = {
        tagFQN: 'PII.Sensitive',
        source: 'Classification',
        labelType: 'Manual',
        state: 'Confirmed',
      };
      const tableEntity = {
        ...mockTableEntityDetails,
        entityType: EntityType.TABLE,
        tags: [],
      };

      const CapturingSummaryPanel = capturePanel((props) => (
        <div data-testid="captured-tags-count">
          {props.dataAsset?.tags?.length ?? 0}
        </div>
      ));
      mockGetTableDetailsByFQN.mockResolvedValueOnce(tableEntity);
      mockPatchTableDetails.mockResolvedValueOnce({
        ...tableEntity,
        tags: [newTag],
      });

      render(
        <EntitySummaryPanel
          afterEntityUpdate={mockAfterEntityUpdate}
          entityDetails={{ details: tableEntity }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('captured-tags-count')).toHaveTextContent(
          '0'
        );
      });

      await act(async () => {
        await latestProps(CapturingSummaryPanel).onTagsUpdate([newTag]);
      });

      expect(mockPatchTableDetails).toHaveBeenCalledWith(
        tableEntity.id,
        expect.any(Array)
      );
      // Explore path: afterEntityUpdate receives the full merged entity.
      expect(mockAfterEntityUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ tags: [newTag] })
      );
      expect(mockAfterEntityUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({ tags: [] })
      );

      await waitFor(() => {
        expect(screen.getByTestId('captured-tags-count')).toHaveTextContent(
          '1'
        );
      });
    });
  });

  // Dedicated identifier-assertion tests, one per precedence branch of the old
  // fetchResourcePermission's identifier logic (now computed as
  // permissionResourceType/permissionIdentifier and passed straight to
  // useEntityPermissions) — see this suite's top-level comment for why there's no generic
  // same-args guardrail instead.
  describe('Permission identifier resolution', () => {
    it('fetches permissions by id for a normal (non-ontology-panel) entity', async () => {
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
        expect(mockUseEntityPermissions).toHaveBeenCalledWith(
          ResourceEntity.TABLE,
          { id: mockTableEntityDetails.id },
          expect.objectContaining({ enabled: true })
        );
      });
    });

    it('fetches permissions for the parent table (not the column itself) for a tableColumn entity', async () => {
      const columnEntity = {
        ...mockTableEntityDetails,
        id: 'column-id',
        entityType: ResourceEntity.TABLE_COLUMN as unknown as EntityType,
        table: { id: 'parent-table-id' },
      };

      render(
        <EntitySummaryPanel
          entityDetails={{
            details: columnEntity as unknown as never,
          }}
          handleClosePanel={mockHandleClosePanel}
        />
      );

      await waitFor(() => {
        expect(mockUseEntityPermissions).toHaveBeenCalledWith(
          ResourceEntity.TABLE,
          { id: 'parent-table-id' },
          expect.objectContaining({ enabled: true })
        );
      });
    });

    it('fetches permissions by fqn (not id) in ontology-panel mode', async () => {
      render(
        <EntitySummaryPanel
          entityDetails={{
            details: {
              ...mockTableEntityDetails,
              entityType: EntityType.TABLE,
            },
          }}
          handleClosePanel={mockHandleClosePanel}
          panelPath="ontology-explorer"
        />
      );

      await waitFor(() => {
        expect(mockUseEntityPermissions).toHaveBeenCalledWith(
          ResourceEntity.TABLE,
          mockTableEntityDetails.fullyQualifiedName,
          expect.objectContaining({ enabled: true })
        );
      });
    });
  });
});
