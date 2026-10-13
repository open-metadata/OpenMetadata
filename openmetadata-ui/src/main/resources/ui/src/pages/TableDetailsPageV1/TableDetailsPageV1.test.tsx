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
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, useParams } from 'react-router-dom';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../../components/Customization/GenericTab/GenericTab';
import { useTestCaseStore } from '../../components/DataQuality/IncidentManager/useTestCase.store';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { mockDatasetData } from '../../constants/mockTourData.constants';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { EntityTabs } from '../../enums/entity.enum';
import { ResourceEntity } from '../../enums/permissions.enum';
import { TableType } from '../../generated/entity/data/table';
import { getListTestCaseIncidentStatus } from '../../rest/incidentManagerAPI';
import { getDataQualityLineage } from '../../rest/lineageAPI';
import { getQueriesList } from '../../rest/queryAPI';
import { getTableDetailsByFQN } from '../../rest/tableAPI';
import { getListTestCaseBySearch } from '../../rest/testAPI';
import { renderWithQueryClient } from '../../test/unit/test-utils';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import tableClassBase from '../../utils/TableClassBase';
// Mocked globally in src/setupTests.js — imported here only to assert on it.
import { showErrorToast } from '../../utils/ToastUtils';
import TableDetailsPageV1 from './TableDetailsPageV1';

const mockNavigate = jest.fn();

const COMMON_API_FIELDS =
  'columns,followers,joins,tags,owners,dataModel,tableConstraints,schemaDefinition,domains,dataProducts,votes,extension';

// The page now reads permissions via useEntityPermissions rather than the raw
// PermissionProvider context, so mocking that hook (instead of the old
// getEntityPermissionByFqn REST boundary) is what drives the page's permission-gated
// behavior in these tests. mockUseEntityPermissions is asserted against directly (see
// "should fetch permissions" below) so it needs a `mock`-prefixed name to be usable inside
// the (hoisted) jest.mock factory below.
const mockUseEntityPermissions = jest.fn();

/**
 * Configures the mocked useEntityPermissions hook to return the flags derived from a raw
 * OperationPermission object — mirroring the shape tests used to hand to the mocked
 * getEntityPermissionByFqn, but run through the real {@link getDerivedPermissionFlags} so
 * the derived flags (e.g. the ViewAll fallback for an unset field-level permission) stay
 * accurate without every test having to hand-compute them.
 *
 * Deliberately does NOT merge `overrides` onto a fully-populated default (e.g.
 * DEFAULT_ENTITY_PERMISSION): getPrioritizedViewPermission/getPrioritizedEditPermission
 * fall back to ViewAll/EditAll only when the field-specific key is truly *absent* (lodash
 * `has()`), not merely `false`. The real backend response (see getOperationPermissions in
 * PermissionsUtils.ts) already omits operations a policy doesn't mention, so a partial
 * object here is the faithful mock, not a shortcut — filling in every key with `false`
 * would silently defeat the fallback (caught a real test failure during this conversion).
 *
 * Uses mockReturnValue rather than mockImplementationOnce because React re-renders can call
 * the hook more than once during a test.
 */
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

jest.mock('../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

jest.mock('../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest.fn().mockImplementation(() =>
    Promise.resolve({
      name: 'test',
      id: '123',
      columns: [],
    })
  ),
  getTableColumnsByFQN: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [],
      paging: { total: 0 },
    })
  ),
  addFollower: jest.fn(),
  patchTableDetails: jest.fn(),
  removeFollower: jest.fn(),
  restoreTable: jest.fn(),
  updateTablesVotes: jest.fn(),
}));

jest.mock('../../rest/testAPI', () => ({
  ...jest.requireActual('../../rest/testAPI'),
  getListTestCaseBySearch: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
}));

jest.mock('../../rest/incidentManagerAPI', () => ({
  ...jest.requireActual('../../rest/incidentManagerAPI'),
  getListTestCaseIncidentStatus: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
}));

jest.mock('../../rest/lineageAPI', () => ({
  ...jest.requireActual('../../rest/lineageAPI'),
  getDataQualityLineage: jest.fn().mockResolvedValue({ nodes: [], edges: [] }),
}));

jest.mock('../../rest/suggestionsAPI', () => ({
  getSuggestionsList: jest.fn().mockImplementation(() => Promise.resolve([])),
}));

jest.mock('../../utils/RecentActivityUtils', () => ({
  ...jest.requireActual('../../utils/RecentActivityUtils'),
  addToRecentViewed: jest.fn(),
}));
jest.mock('../../utils/FeedUtilsPure', () => ({
  fetchEntityActivityCountInto: jest.fn(),
  fetchEntityTaskCountsInto: jest.fn(),
  getFeedCounts: jest.fn(),
}));
jest.mock('../../utils/FqnUtils', () => ({
  getPartialNameFromTableFQN: jest.fn().mockImplementation(() => 'fqn'),
  getTableFQNFromColumnFQN: jest.fn(),
}));
jest.mock('../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest.fn().mockReturnValue('/table/fqn/sample_data'),
  getVersionPath: jest.fn(),
  refreshPage: jest.fn(),
}));
jest.mock('../../utils/TagsUtils', () => ({
  sortTagsCaseInsensitive: jest.fn(),
}));

jest.mock('../../rest/queryAPI', () => ({
  getQueriesList: jest.fn(),
}));

jest.mock(
  '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest
      .fn()
      .mockImplementation(() => <p>testActivityFeedTab</p>),
  })
);

jest.mock(
  '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel',
  () => {
    return jest.fn().mockImplementation(() => <p>testActivityThreadPanel</p>);
  }
);

jest.mock('../../components/common/EntityDescription/Description', () => {
  return jest.fn().mockImplementation(() => <p>testDescription</p>);
});
jest.mock(
  '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => {
    return jest.fn().mockImplementation(() => <p>testErrorPlaceHolder</p>);
  }
);

// Distinct sentinel so permission-loading (this) and entity-loading (mocked PageLoader
// below) are unambiguous in assertions — both real components render
// data-testid="loader", which would make "no loader" assertions ambiguous between the two.
jest.mock('./TableDetailsPageSkeleton.component', () => {
  return jest.fn().mockImplementation(() => <p>testPermissionSkeleton</p>);
});

jest.mock('../../components/common/QueryViewer/QueryViewer.component', () => {
  return jest.fn().mockImplementation(() => <p>testQueryViewer</p>);
});

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <p>{children}</p>);
});

jest.mock(
  '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest
      .fn()
      .mockImplementation(({ badge, breadcrumbData }) => (
        <div>
          testDataAssetsHeader
          {badge}
          <span data-testid="header-breadcrumb-data">
            {JSON.stringify(breadcrumbData)}
          </span>
        </div>
      )),
  })
);

jest.mock('../../components/Lineage/Lineage/Lineage', () => ({
  Lineage: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('../../components/Lineage/Lineage.component', () => {
  return jest
    .fn()
    .mockImplementation(({ hasEditAccess }: { hasEditAccess: boolean }) => (
      <p data-has-edit-access={String(hasEditAccess)}>testEntityLineage</p>
    ));
});

jest.mock(
  '../../components/Database/SampleDataTable/SampleDataTable.component',
  () => {
    return jest.fn().mockImplementation(() => <p>testSampleDataTable</p>);
  }
);

// Mock removed - TableProfiler component doesn't exist as a single file anymore
// jest.mock(
//   '../../components/Database/Profiler/TableProfiler/TableProfiler',
//   () => {
//     return jest.fn().mockImplementation(() => <p>testTableProfiler</p>);
//   }
// );

jest.mock('../../components/Database/TableQueries/TableQueries', () => {
  return jest.fn().mockImplementation(() => <p>testTableQueries</p>);
});

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () => {
  return jest.fn().mockImplementation(({ name }) => <p>{name}</p>);
});

jest.mock('../../components/Tag/TagsContainerV2/TagsContainerV2', () => {
  return jest.fn().mockImplementation(() => <p>testTagsContainerV2</p>);
});

jest.mock('./FrequentlyJoinedTables/FrequentlyJoinedTables.component', () => ({
  FrequentlyJoinedTables: jest
    .fn()
    .mockImplementation(() => <p>testFrequentlyJoinedTables</p>),
}));

jest.mock('./FrequentlyJoinedTables/FrequentlyJoinedTables.component', () => ({
  FrequentlyJoinedTables: jest
    .fn()
    .mockImplementation(() => <p>testFrequentlyJoinedTables</p>),
}));

jest.mock(
  '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest.fn().mockImplementation(() => ({
      postFeed: jest.fn(),
      deleteFeed: jest.fn(),
      updateFeed: jest.fn(),
    })),
    __esModule: true,
    default: 'ActivityFeedProvider',
  })
);

jest.mock(
  '../../components/Suggestions/SuggestionsProvider/SuggestionsProvider',
  () => ({
    useSuggestionsContext: jest.fn().mockImplementation(() => ({
      suggestions: [],
      suggestionsByUser: new Map(),
      selectedUserSuggestions: [],
      entityFqn: 'fqn',
      loading: false,
      allSuggestionsUsers: [],
      onUpdateActiveUser: jest.fn(),
      fetchSuggestions: jest.fn(),
      acceptRejectSuggestion: jest.fn(),
    })),
    __esModule: true,
    default: 'SuggestionsProvider',
  })
);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest
    .fn()
    .mockImplementation(() => ({ fqn: 'fqn', tab: 'schema' })),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../context/TourProvider/TourProvider', () => ({
  useTourProvider: jest.fn().mockImplementation(() => ({
    isTourOpen: false,
    activeTabForTourDatasetPage: 'schema',
    isTourPage: false,
  })),
}));

jest.mock('../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <>testLoader</>),
  PageLoader: jest
    .fn()
    .mockImplementation(() => <div data-testid="loader">Loader</div>),
}));

jest.useFakeTimers();

jest.mock('../../hoc/LimitWrapper', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => <>LimitWrapper{children}</>);
});

jest.mock('../../components/Customization/GenericTab/GenericTab', () => ({
  GenericTab: jest.fn().mockImplementation(() => <>GenericTab</>),
}));

jest.mock(
  '../../context/RuleEnforcementProvider/RuleEnforcementProvider',
  () => ({
    useRuleEnforcementProvider: jest.fn().mockImplementation(() => ({
      fetchRulesForEntity: jest.fn(),
      getRulesForEntity: jest.fn(),
      getEntityRuleValidation: jest.fn(),
    })),
  })
);

describe('TestDetailsPageV1 component', () => {
  beforeEach(() => {
    setMockPermissions();
  });

  it('TableDetailsPageV1 should fetch permissions', () => {
    renderWithQueryClient(
      <MemoryRouter>
        <TableDetailsPageV1 />
      </MemoryRouter>
    );

    expect(mockUseEntityPermissions).toHaveBeenCalledWith(
      ResourceEntity.TABLE,
      'fqn',
      { enabled: true }
    );
  });

  it('TableDetailsPageV1 should not fetch table details if permission is there', () => {
    renderWithQueryClient(
      <MemoryRouter>
        <TableDetailsPageV1 />
      </MemoryRouter>
    );

    expect(getTableDetailsByFQN).not.toHaveBeenCalled();
  });

  // Covers the hand-written (not generated by the recipe's destructure) bits of the
  // conversion: the loading gate, the error-toast effect, and the tour-mode bypass of that
  // loading gate. These are exactly the pieces a mechanical destructure-swap could get
  // wrong without a test catching it, so every conversion copying this template should
  // carry an equivalent trio.
  describe('permission hook loading/error/tour states', () => {
    // The tour test below sets a persistent (not "once") useTourProvider implementation —
    // see its comment for why — so restore the module-level default afterward regardless
    // of whether the test passed, or a failure would leak isTourOpen: true into every
    // later test in this file.
    afterEach(() => {
      (useTourProvider as jest.Mock).mockImplementation(() => ({
        isTourOpen: false,
        activeTabForTourDatasetPage: 'schema',
        isTourPage: false,
      }));
    });

    it('renders the permission-loading skeleton while isLoading is true', () => {
      setMockPermissions({}, { isLoading: true });

      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );

      expect(screen.getByText('testPermissionSkeleton')).toBeInTheDocument();
      expect(
        screen.queryByText('testDataAssetsHeader')
      ).not.toBeInTheDocument();
    });

    it('shows the permission-fetch error toast when the hook reports an error', async () => {
      setMockPermissions({}, { error: new Error('permission fetch failed') });

      await act(async () => {
        renderWithQueryClient(
          <MemoryRouter>
            <TableDetailsPageV1 />
          </MemoryRouter>
        );
      });

      // t() is globally mocked to the identity function (see src/setupTests.js), so the
      // interpolated `entity` option collapses out and only the outer key survives.
      expect(showErrorToast).toHaveBeenCalledWith(
        'server.fetch-entity-permissions-error'
      );
    });

    it('does not show the permission-loading skeleton in tour mode, even while isLoading is true', () => {
      // mockImplementationOnce would only override the FIRST call to useTourProvider() —
      // TableDetailsPageV1 is wrapped in withSuggestions(withActivityFeed(...)), and those
      // wrappers (or providers they render) may call the hook before the inner component
      // does, silently consuming the "once" override before it reaches this test's target.
      // A persistent mockImplementation, explicitly restored after, doesn't depend on call
      // order.
      (useTourProvider as jest.Mock).mockImplementation(() => ({
        isTourOpen: true,
        activeTabForTourDatasetPage: 'schema',
        isTourPage: false,
      }));
      setMockPermissions({}, { isLoading: true });

      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );

      expect(
        screen.queryByText('testPermissionSkeleton')
      ).not.toBeInTheDocument();
    });

    it('uses tour permissions for the Queries tab when permission fetching is disabled', async () => {
      (useTourProvider as jest.Mock).mockImplementation(() => ({
        isTourOpen: true,
        activeTabForTourDatasetPage: EntityTabs.TABLE_QUERIES,
        isTourPage: false,
        tourMockDatasetData: mockDatasetData,
      }));
      setMockPermissions({}, { isLoading: true });

      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );

      expect(await screen.findByText('testTableQueries')).toBeInTheDocument();
      expect(
        screen.queryByText('testErrorPlaceHolder')
      ).not.toBeInTheDocument();
      expect(mockUseEntityPermissions).toHaveBeenCalledWith(
        ResourceEntity.TABLE,
        'fqn',
        { enabled: false }
      );
    });

    it('uses tour permissions for Lineage edit access', async () => {
      (useTourProvider as jest.Mock).mockImplementation(() => ({
        isTourOpen: true,
        activeTabForTourDatasetPage: EntityTabs.LINEAGE,
        isTourPage: false,
        tourMockDatasetData: mockDatasetData,
      }));
      setMockPermissions({}, { isLoading: true });

      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );

      expect(await screen.findByText('testEntityLineage')).toHaveAttribute(
        'data-has-edit-access',
        'true'
      );
    });
  });

  // The tab strip is the one piece of TableDetailsPageV1 that historically gated on
  // `isTourOpen` alone (selectedKey + handleTabChange) instead of the union
  // `isTourOpen || isTourPage` the rest of the page uses (e.g. mock-data seeding). On
  // /tour there is no :fqn or :tab, so on an X-close (isTourOpen → false while
  // isTourPage stays true) the displayed tab snapped to Schema and a tab click
  // navigated to /table//<tab> (an empty-FQN route that renders blank). These tests
  // cover the post-X-close split state that the tour-mode tests above never reach.
  describe('tab-strip tour-mode gating on /tour', () => {
    const setTourState = (tourState: {
      isTourOpen: boolean;
      isTourPage: boolean;
      activeTabForTourDatasetPage: EntityTabs;
    }) => {
      (useTourProvider as jest.Mock).mockImplementation(() => ({
        isTourOpen: tourState.isTourOpen,
        isTourPage: tourState.isTourPage,
        activeTabForTourDatasetPage: tourState.activeTabForTourDatasetPage,
        tourMockDatasetData: mockDatasetData,
      }));
    };

    beforeEach(() => {
      setMockPermissions();
      mockNavigate.mockClear();
      // /tour carries no :fqn or :tab, so both route params are absent — making
      // tableFqn '' and activeTab undefined, the exact state the bug exploits.
      (useParams as jest.Mock).mockImplementation(() => ({}));
    });

    afterEach(() => {
      (useTourProvider as jest.Mock).mockImplementation(() => ({
        isTourOpen: false,
        activeTabForTourDatasetPage: 'schema',
        isTourPage: false,
      }));
      (useParams as jest.Mock).mockImplementation(() => ({
        fqn: 'fqn',
        tab: 'schema',
      }));
    });

    it('keeps the tour-controlled tab selected after X-close while still on /tour', async () => {
      setTourState({
        isTourOpen: false, // X-close dismissed the overlay…
        isTourPage: true, // …but the user is still on /tour
        activeTabForTourDatasetPage: EntityTabs.SAMPLE_DATA,
      });

      await act(async () => {
        renderWithQueryClient(
          <MemoryRouter>
            <TableDetailsPageV1 />
          </MemoryRouter>
        );
      });

      // Sample Data stays selected (does not snap to Schema): the tour-controlled
      // panel renders while the Schema panel does not.
      expect(
        await screen.findByText('testSampleDataTable')
      ).toBeInTheDocument();
      expect(screen.queryByText('GenericTab')).not.toBeInTheDocument();
    });

    it('does not navigate when a tab is clicked after X-close while still on /tour', async () => {
      setTourState({
        isTourOpen: false,
        isTourPage: true,
        activeTabForTourDatasetPage: EntityTabs.SAMPLE_DATA,
      });

      await act(async () => {
        renderWithQueryClient(
          <MemoryRouter>
            <TableDetailsPageV1 />
          </MemoryRouter>
        );
      });

      await screen.findByText('testSampleDataTable');
      fireEvent.click(screen.getByText('label.lineage'));

      // Navigation stays suppressed: no /table//<tab> transition off the demo.
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('TableDetailsPageV1 should fetch table details with basic fields', async () => {
    setMockPermissions({ ViewBasic: true });

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(getTableDetailsByFQN).toHaveBeenCalledWith('fqn', {
      fields: COMMON_API_FIELDS,
    });
  });

  it('TableDetailsPageV1 should fetch table details with all the permitted fields', async () => {
    setMockPermissions({ ViewAll: true, ViewBasic: true, ViewUsage: true });

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(getTableDetailsByFQN).toHaveBeenCalledWith('fqn', {
      fields: `${COMMON_API_FIELDS},usageSummary,testSuite`,
    });
  });

  it('TableDetailsPageV1 should render page for ViewBasic permissions', async () => {
    setMockPermissions({ ViewBasic: true });

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(getTableDetailsByFQN).toHaveBeenCalledWith('fqn', {
      fields: COMMON_API_FIELDS,
    });

    expect(await screen.findByText('testDataAssetsHeader')).toBeInTheDocument();
    expect(await screen.findByText('label.column-plural')).toBeInTheDocument();
    expect(
      await screen.findByText('label.activity-feed-and-task-plural')
    ).toBeInTheDocument();
    expect(await screen.findByText('label.sample-data')).toBeInTheDocument();
    expect(await screen.findByText('label.query-plural')).toBeInTheDocument();
    expect(await screen.findByText('label.lineage')).toBeInTheDocument();

    expect(
      await screen.findByText('label.custom-property-plural')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('label.data-observability')
    ).toBeInTheDocument();
  });

  it('TableDetailsPageV1 should dbt tab if data is present', async () => {
    setMockPermissions({ ViewBasic: true });

    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        name: 'test',
        id: '123',
        tableFqn: 'fqn',
        dataModel: { sql: 'somequery' },
        columns: [],
      })
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('label.dbt-lowercase')).toBeInTheDocument();
    expect(screen.queryByText('label.view-definition')).not.toBeInTheDocument();
  });

  it('TableDetailsPageV1 should dbt tab for rawSql, when sql is empty', async () => {
    setMockPermissions({ ViewBasic: true });

    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        name: 'test',
        id: '123',
        tableFqn: 'fqn',
        dataModel: { sql: '', rawSql: 'rawSql' },
        columns: [],
      })
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('label.dbt-lowercase')).toBeInTheDocument();
    expect(screen.queryByText('label.view-definition')).not.toBeInTheDocument();
  });

  it('TableDetailsPageV1 should dbt tab for rawSql, when there is no sql available', async () => {
    setMockPermissions({ ViewBasic: true });

    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        name: 'test',
        id: '123',
        tableFqn: 'fqn',
        dataModel: { rawSql: 'rawSql' },
        columns: [],
      })
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('label.dbt-lowercase')).toBeInTheDocument();
    expect(screen.queryByText('label.view-definition')).not.toBeInTheDocument();
  });

  it('TableDetailsPageV1 should show dbt tab when path is available without sql', async () => {
    setMockPermissions({ ViewBasic: true });

    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        name: 'test',
        id: '123',
        tableFqn: 'fqn',
        dataModel: { path: 'data/seeds/my_seed.csv' },
        columns: [],
      })
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('label.dbt-lowercase')).toBeInTheDocument();
    expect(screen.queryByText('label.view-definition')).not.toBeInTheDocument();
  });

  it('TableDetailsPageV1 should show dbt tab when dbtSourceProject is available without sql', async () => {
    setMockPermissions({ ViewBasic: true });

    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        name: 'test',
        id: '123',
        tableFqn: 'fqn',
        dataModel: { dbtSourceProject: 'my_dbt_project' },
        columns: [],
      })
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('label.dbt-lowercase')).toBeInTheDocument();
    expect(screen.queryByText('label.view-definition')).not.toBeInTheDocument();
  });

  it('TableDetailsPageV1 should render schema definition tab table type is not view', async () => {
    setMockPermissions({ ViewBasic: true });

    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        name: 'test',
        id: '123',
        schemaDefinition: 'schemaDefinition query',
        columns: [],
      })
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    // useQuery resolves its promise on a microtask after the initial render — use findByText
    // (waits up to the testing-library default timeout) rather than getByText, which would
    // otherwise race the cache settle. The act-wrapper flushes effects but not the chained
    // promise inside react-query's internal scheduler.
    expect(
      await screen.findByText('label.schema-definition')
    ).toBeInTheDocument();
    expect(screen.queryByText('label.dbt-lowercase')).not.toBeInTheDocument();
  });

  it('TableDetailsPageV1 should render view definition tab if table type is view', async () => {
    setMockPermissions({ ViewBasic: true });

    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        name: 'test',
        id: '123',
        schemaDefinition: 'viewDefinition query',
        tableType: TableType.View,
        columns: [],
      })
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(
      await screen.findByText('label.view-definition')
    ).toBeInTheDocument();
  });

  it('TableDetailsPageV1 should render schemaTab by default', async () => {
    setMockPermissions({ ViewBasic: true });

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(getTableDetailsByFQN).toHaveBeenCalledWith('fqn', {
      fields: COMMON_API_FIELDS,
    });

    expect(await screen.findByText('GenericTab')).toBeInTheDocument();
    expect(GenericTab).toHaveBeenCalledWith({ type: 'Table' }, {});
  });

  it('should pass entity name as pageTitle to PageLayoutV1', async () => {
    const mockTableData = {
      name: 'test-table',
      id: '123',
      columns: [],
    };

    setMockPermissions({ ViewBasic: true });

    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockTableData)
    );

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    // Same reason as the schema-definition test above — useQuery's data is available on a
    // subsequent render, not immediately after `act` flushes. waitFor polls until the page
    // re-renders with the resolved title.
    await waitFor(() =>
      expect(PageLayoutV1).toHaveBeenCalledWith(
        expect.objectContaining({
          pageTitle: 'test-table',
        }),
        expect.anything()
      )
    );
  });

  it('should preserve the table suite breadcrumb in the header and tab navigation', async () => {
    const breadcrumbData = [
      {
        name: 'Test Suites',
        url: '/data-quality/test-suites/table-suites',
      },
      {
        name: 'orders',
        url: '/table/service.database.schema.orders/profiler/data-quality',
      },
    ];

    setMockPermissions({ ViewBasic: true });
    mockNavigate.mockClear();

    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/table/fqn/profiler/data-quality',
              state: { breadcrumbData },
            },
          ]}>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });

    expect(
      await screen.findByTestId('header-breadcrumb-data')
    ).toHaveTextContent(JSON.stringify(breadcrumbData));

    fireEvent.click(screen.getByText('label.sample-data'));

    expect(mockNavigate).toHaveBeenCalledWith('/table/fqn/sample_data', {
      replace: true,
      state: { breadcrumbData },
    });
  });

  describe('Queries tab count', () => {
    const getQueriesTabProps = () =>
      (TabsLabel as unknown as jest.Mock).mock.calls
        .map(([props]) => props)
        .filter((props) => props.id === EntityTabs.TABLE_QUERIES);

    const getLatestQueriesTabProps = () => getQueriesTabProps().pop();

    const renderOnSchemaTab = async () => {
      setMockPermissions({ ViewBasic: true });

      await act(async () => {
        renderWithQueryClient(
          <MemoryRouter>
            <TableDetailsPageV1 />
          </MemoryRouter>
        );
      });
    };

    beforeEach(() => {
      (TabsLabel as unknown as jest.Mock).mockClear();
      (getQueriesList as jest.Mock).mockClear();
    });

    it('should fetch the count on mount without activating the Queries tab', async () => {
      (getQueriesList as jest.Mock).mockResolvedValue({
        paging: { total: 7 },
      });

      await renderOnSchemaTab();

      // tableDetails resolves on a later render, so the count query starts after the act
      // flush — poll rather than asserting synchronously.
      await waitFor(() =>
        expect(getQueriesList).toHaveBeenCalledWith({
          limit: 0,
          entityId: '123',
        })
      );

      await waitFor(() =>
        expect(getLatestQueriesTabProps()).toEqual(
          expect.objectContaining({ count: 7, isLoading: false })
        )
      );
    });

    it('should render the skeleton instead of a count while the request is in flight', async () => {
      let resolveCount: (value: { paging: { total: number } }) => void = () =>
        undefined;
      (getQueriesList as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCount = resolve;
          })
      );

      await renderOnSchemaTab();

      await waitFor(() => expect(getQueriesList).toHaveBeenCalled());

      // Every render so far, not just the latest — one frame with isLoading false is the
      // 0 flash this guards against.
      expect(getQueriesTabProps()).not.toHaveLength(0);
      expect(
        getQueriesTabProps().every((props) => props.isLoading)
      ).toBeTruthy();

      await act(async () => {
        // eslint-disable-next-line sonarjs/no-extra-arguments -- deferred test resolver
        resolveCount({ paging: { total: 7 } });
      });

      await waitFor(() =>
        expect(getLatestQueriesTabProps()).toEqual(
          expect.objectContaining({ count: 7, isLoading: false })
        )
      );
    });

    it('should fall back to 0 when the count request fails', async () => {
      (getQueriesList as jest.Mock).mockRejectedValue(new Error('failed'));

      await renderOnSchemaTab();

      await waitFor(() => expect(getQueriesList).toHaveBeenCalled());

      await waitFor(() =>
        expect(getLatestQueriesTabProps()).toEqual(
          expect.objectContaining({ count: 0, isLoading: false })
        )
      );
    });
  });
});

describe('TableDetailsPageV1 data quality indicator', () => {
  let alertGate: jest.SpyInstance;

  const renderPage = async () => {
    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <TableDetailsPageV1 />
        </MemoryRouter>
      );
    });
  };

  const openCard = () => {
    // Establish pointer modality so react-aria accepts hover events.
    fireEvent.mouseMove(document);
    fireEvent.mouseEnter(
      screen.getByTestId('dq-indicator').parentElement as HTMLElement,
      { pointerType: 'mouse' }
    );
    act(() => {
      jest.advanceTimersByTime(300);
    });
  };

  const incidentOn = (testCaseId: string) => ({
    testCaseReference: { id: testCaseId, type: 'testCase' },
  });

  beforeEach(() => {
    setMockPermissions({ ViewAll: true });
    alertGate = jest
      .spyOn(tableClassBase, 'getAlertEnableStatus')
      .mockReturnValue(true);
    (getTableDetailsByFQN as jest.Mock).mockResolvedValue({
      name: 'test',
      id: '123',
      columns: [],
      fullyQualifiedName: 'fqn',
    });
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    (getListTestCaseIncidentStatus as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    (getDataQualityLineage as jest.Mock).mockResolvedValue({
      nodes: [],
      edges: [],
    });
    useTestCaseStore.getState().setDqLineageData(undefined);
  });

  afterEach(() => {
    alertGate.mockRestore();
  });

  it('counts failing tests from paging.total, not the returned page', async () => {
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: [{ id: 'failing-1' }],
      paging: { total: 3 },
    });

    await renderPage();

    expect(await screen.findByTestId('dq-indicator')).toHaveAttribute(
      'data-level',
      'failing'
    );

    openCard();

    expect(
      screen.getByText('message.dq-failing-tests-description-plural')
    ).toBeInTheDocument();
  });

  it('does not count an open incident on a currently failing test again', async () => {
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: [{ id: 'failing-1' }],
      paging: { total: 1 },
    });
    (getListTestCaseIncidentStatus as jest.Mock).mockResolvedValue({
      data: [incidentOn('failing-1')],
      paging: { total: 1 },
    });

    await renderPage();

    const indicator = await screen.findByTestId('dq-indicator');

    expect(indicator).toHaveAttribute('data-level', 'failing');
    expect(indicator).toHaveAttribute(
      'aria-label',
      'label.data-quality-test-failing'
    );
  });

  it('stays amber for an open incident when the other calls fail', async () => {
    (getListTestCaseBySearch as jest.Mock).mockRejectedValue(
      new Error('search failed')
    );
    (getDataQualityLineage as jest.Mock).mockRejectedValue(
      new Error('lineage failed')
    );
    (getListTestCaseIncidentStatus as jest.Mock).mockResolvedValue({
      data: [incidentOn('passing-1')],
      paging: { total: 1 },
    });

    await renderPage();

    expect(await screen.findByTestId('dq-indicator')).toHaveAttribute(
      'data-level',
      'incident'
    );
    expect(useTestCaseStore.getState().dqLineageData).toBeUndefined();
  });

  it('skips the incidents request without ViewTests permission', async () => {
    setMockPermissions({ ViewBasic: true });
    (getListTestCaseIncidentStatus as jest.Mock).mockResolvedValue({
      data: [incidentOn('passing-1')],
      paging: { total: 1 },
    });

    await renderPage();

    await waitFor(() => expect(getDataQualityLineage).toHaveBeenCalled());

    expect(getListTestCaseIncidentStatus).not.toHaveBeenCalled();
    expect(screen.queryByTestId('dq-indicator')).not.toBeInTheDocument();
  });

  it('shows the upstream state and stores the lineage response', async () => {
    const lineage = {
      nodes: [{ fullyQualifiedName: 'fqn' }, { fullyQualifiedName: 'raw' }],
      edges: [],
    };
    (getDataQualityLineage as jest.Mock).mockResolvedValue(lineage);

    await renderPage();

    expect(await screen.findByTestId('dq-indicator')).toHaveAttribute(
      'data-level',
      'upstream'
    );
    expect(useTestCaseStore.getState().dqLineageData).toEqual(lineage);
  });

  it('renders no indicator and skips the requests when alerts are disabled', async () => {
    alertGate.mockReturnValue(false);
    (getListTestCaseBySearch as jest.Mock).mockClear();

    await renderPage();

    expect(await screen.findByText('testDataAssetsHeader')).toBeInTheDocument();
    expect(screen.queryByTestId('dq-indicator')).not.toBeInTheDocument();
    expect(getListTestCaseBySearch).not.toHaveBeenCalled();
  });
});
