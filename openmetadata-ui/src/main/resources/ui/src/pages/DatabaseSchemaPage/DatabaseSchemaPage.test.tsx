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

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ResourceEntity } from '../../enums/permissions.enum';
import {
  getDatabaseSchemaDetailsByFQN,
  updateDatabaseSchemaVotes,
} from '../../rest/databaseAPI';
import { getStoredProceduresList } from '../../rest/storedProceduresAPI';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../test/unit/test-utils';
import { fetchEntityTaskCountsInto } from '../../utils/FeedUtilsPure';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import DatabaseSchemaPageComponent from './DatabaseSchemaPage.component';
import {
  mockGetDatabaseSchemaDetailsByFQNData,
  mockPatchDatabaseSchemaDetailsData,
} from './mocks/DatabaseSchemaPage.mock';

// React Query notifies its observers on a timer, which the suite's global fake timers hold
// back. With this in place, a read that resolves inside an awaited `act` is on screen when
// the `act` returns — needed for the voting tests, which assert the header's post-vote state.
runQueryNotificationsSynchronously();

// Full-fields entity, matching what the server returns for the page's default fields
// `owners,tags,domains,votes,extension,followers,dataProducts` — i.e. the entry the React
// Query cache is keyed on. Used to assert voting does NOT wipe these fields.
const mockFullDatabaseSchema = {
  ...mockGetDatabaseSchemaDetailsByFQNData,
  version: 0.1,
  owners: [
    { id: 'owner-1', type: 'user', name: 'admin', displayName: 'admin' },
  ],
  tags: [],
  votes: {
    upVotes: 0,
    downVotes: 0,
    totalVotes: 0,
    upVoters: [],
    downVoters: [],
  },
  domains: [
    {
      id: 'domain-1',
      type: 'domain',
      name: 'Sales',
      fullyQualifiedName: 'Sales',
      displayName: 'Sales',
    },
  ],
  followers: [
    { id: 'user-1', type: 'user', name: 'admin', displayName: 'admin' },
  ],
  extension: { customProperty: 'value' },
  dataProducts: [
    {
      id: 'dp-1',
      type: 'dataProduct',
      name: 'revenue-product',
      fullyQualifiedName: 'revenue-product',
    },
  ],
};

// Narrow-fields entity: mirrors the server's `clearFieldsInternal` behaviour — a GET that
// requests only `owners,tags,votes` returns every other relationship-backed field (`domains`,
// `followers`, `extension`, `dataProducts`) as null. Used to prove that the pre-fix path
// (narrow GET + `setDatabaseSchema`) would wipe the header state.
const mockNarrowDatabaseSchema = {
  ...mockFullDatabaseSchema,
  domains: null,
  followers: null,
  extension: null,
  dataProducts: null,
};

// Permissions now come from useEntityPermissions (Task 8 Batch 10) rather than an
// imperative usePermissionProvider().getEntityPermissionByFqn call — mock the hook
// directly, mirroring DataModelPage.test.tsx's approach.
const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (
  overrides: Partial<OperationPermission> = DEFAULT_ENTITY_PERMISSION,
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

// Establishes the sticky base return value (all-false, matching the old top-level
// `mockEntityPermissionByFqn` default) before any test renders. Individual tests below
// override it explicitly via `setMockPermissions(...)` where they need a different value —
// none rely on an automatic revert-to-default between tests, so this sticky base is safe.
setMockPermissions();

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
  '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest
      .fn()
      .mockImplementation(() => <>testActivityFeedTab</>),
  })
);

jest.mock(
  '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel',
  () => {
    return jest.fn().mockImplementation(() => <p>testActivityThreadPanel</p>);
  }
);

jest.mock(
  '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest.fn().mockImplementation(
      ({
        onUpdateVote,
        dataAsset,
      }: {
        onUpdateVote?: (
          data: { updatedVoteType: string },
          id: string
        ) => Promise<void>;
        dataAsset?: {
          id?: string;
          domains?: unknown;
          followers?: unknown;
          extension?: unknown;
          dataProducts?: unknown;
        };
      }) => (
        <div>
          <p>testDataAssetsHeader</p>
          <span data-testid="header-domains">
            {dataAsset?.domains ? 'has-domains' : 'no-domains'}
          </span>
          <span data-testid="header-followers">
            {dataAsset?.followers ? 'has-followers' : 'no-followers'}
          </span>
          <span data-testid="header-extension">
            {dataAsset?.extension ? 'has-extension' : 'no-extension'}
          </span>
          <span data-testid="header-data-products">
            {dataAsset?.dataProducts ? 'has-data-products' : 'no-data-products'}
          </span>
          <button
            data-testid="vote-up"
            onClick={() =>
              onUpdateVote?.(
                { updatedVoteType: 'votedUp' },
                dataAsset?.id ?? ''
              )
            }>
            voteUp
          </button>
        </div>
      )
    ),
  })
);

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () =>
  jest.fn().mockImplementation(({ name }) => <div>{name}</div>)
);

jest.mock('../../components/Tag/TagsContainerV2/TagsContainerV2', () => {
  return jest.fn().mockImplementation(() => <p>testTagsContainerV2</p>);
});

jest.mock('./SchemaTablesTab', () => {
  return jest.fn().mockReturnValue(<p>testSchemaTablesTab</p>);
});

jest.mock('../../components/Customization/GenericTab/GenericTab', () => ({
  GenericTab: jest.fn().mockImplementation(() => <p>testSchemaTablesTab</p>),
}));

jest.mock('../../pages/StoredProcedure/StoredProcedureTab', () => {
  return jest.fn().mockImplementation(() => <div>testStoredProcedureTab</div>);
});

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <p>{children}</p>)
);

jest.mock('../../utils/StringUtils', () => ({
  getDecodedFqn: jest.fn().mockImplementation((fqn) => fqn),
}));

jest.mock('../../rest/storedProceduresAPI', () => ({
  getStoredProceduresList: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ data: [], paging: { total: 2 } })
    ),
}));

jest.mock('../../rest/tableAPI', () => ({
  getTableList: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ data: [], paging: { total: 0 } })
    ),
}));

jest.mock('../../utils/EntityDisplayPureUtils', () => ({
  getEntityMissingError: jest.fn().mockImplementation((error) => error),
}));

jest.mock('../../utils/FeedUtilsPure', () => ({
  fetchEntityActivityCountInto: jest.fn(),
  fetchEntityTaskCountsInto: jest.fn(),
  getFeedCounts: jest.fn().mockImplementation(() => FEED_COUNT_INITIAL_DATA),
}));

jest.mock('../../utils/TagsUtils', () => ({
  sortTagsCaseInsensitive: jest.fn(),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getDatabaseSchemaVersionPath: jest.fn().mockImplementation((path) => path),
}));

jest.mock('../../utils/TablePureUtils', () => ({
  getTierTags: jest.fn(),
  getTagsWithoutTier: jest.fn(),
  extractColumnsFromData: jest.fn().mockReturnValue([]),
  findFieldByFQN: jest.fn(),
  normalizeTags: jest.fn().mockImplementation((tags) => tags),
  updateFieldDescription: jest.fn(),
  updateFieldTags: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  showSuccessToast: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => <div data-testid="loader">Loader</div>),
  PageLoader: jest
    .fn()
    .mockImplementation(() => <div data-testid="loader">Loader</div>),
}));

jest.mock('../../rest/databaseAPI', () => ({
  getDatabaseSchemaDetailsByFQN: jest
    .fn()
    .mockImplementation((_fqn: string, params) => {
      // Mirror the server's `clearFieldsInternal`: a request that does NOT ask for `domains`
      // (or `followers`/`extension`/`dataProducts`) gets them back null. The page's default
      // fields include `domains`, so the full cache fetch keeps the populated entity; the
      // pre-fix narrow GET (`owners,tags,votes`) would return the nulled variant.
      const fields = String(params?.fields ?? '');
      const isFullFields =
        fields.includes('domains') &&
        fields.includes('followers') &&
        fields.includes('extension') &&
        fields.includes('dataProducts');

      return Promise.resolve(
        isFullFields ? mockFullDatabaseSchema : mockNarrowDatabaseSchema
      );
    }),
  patchDatabaseSchemaDetails: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(mockPatchDatabaseSchemaDetailsData)
    ),
  restoreDatabaseSchema: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(mockPatchDatabaseSchemaDetailsData)
    ),
  updateDatabaseSchemaVotes: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../utils/EntityUtilClassBase', () => {
  return {
    getManageExtraOptions: jest.fn().mockReturnValue([]),
    getFqnParts: jest
      .fn()
      .mockImplementation((fqn) => ({ entityFqn: fqn, columnFqn: '' })),
  };
});

const mockParams = {
  fqn: 'sample_data.ecommerce_db.shopify',
  tab: 'table',
};

const API_FIELDS = [
  'owners',
  'tags',
  'domains',
  'votes',
  'extension',
  'followers',
  'dataProducts',
];

const mockLocationPathname =
  '/databaseSchema/sample_data.ecommerce_db.shopify/table';

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockImplementation(() => ({
    pathname: mockLocationPathname,
  })),
  useParams: jest.fn().mockImplementation(() => mockParams),
  useNavigate: jest.fn(),
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

jest.mock('../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockImplementation(() => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  })),
}));

jest.mock(
  '../../components/Customization/GenericProvider/GenericProvider',
  () => {
    const React = require('react');

    return {
      GenericProvider: jest
        .fn()
        .mockImplementation(({ children }) =>
          React.createElement('div', null, children)
        ),
    };
  }
);

jest.mock(
  '../../components/Customization/GenericProvider/GenericContext',
  () => {
    return {
      useGenericContext: jest.fn().mockReturnValue({
        data: {},
        permissions: DEFAULT_ENTITY_PERMISSION,
        layout: [
          {
            i: 'Tables.1',
            x: 0,
            y: 0,
            w: 8,
            h: 10,
          },
        ],
        updateWidgetHeight: jest.fn(),
      }),
    };
  }
);

describe('Tests for DatabaseSchemaPage', () => {
  it('DatabaseSchemaPage should fetch permissions', () => {
    renderWithQueryClient(<DatabaseSchemaPageComponent />);

    expect(mockUseEntityPermissions).toHaveBeenCalledWith(
      ResourceEntity.DATABASE_SCHEMA,
      mockParams.fqn,
      expect.objectContaining({ enabled: true })
    );
  });

  it('DatabaseSchemaPage should not fetch details if permission is there', () => {
    renderWithQueryClient(<DatabaseSchemaPageComponent />);

    expect(getDatabaseSchemaDetailsByFQN).not.toHaveBeenCalled();
    expect(getStoredProceduresList).not.toHaveBeenCalled();
  });

  it('DatabaseSchemaPage should render permission placeholder if not have required permission', async () => {
    setMockPermissions({ ViewBasic: false });

    await act(async () => {
      renderWithQueryClient(<DatabaseSchemaPageComponent />);
    });

    expect(
      await screen.findByTestId(
        /(no-data|permission-error|search-error|create-error|assign-error)-placeholder/
      )
    ).toBeInTheDocument();
  });

  it('DatabaseSchemaPage should fetch details with basic fields', async () => {
    setMockPermissions({ ViewBasic: true });

    await act(async () => {
      renderWithQueryClient(<DatabaseSchemaPageComponent />);
    });

    expect(getDatabaseSchemaDetailsByFQN).toHaveBeenCalledWith(mockParams.fqn, {
      fields: API_FIELDS.join(','),
      include: 'all',
    });
  });

  it('DatabaseSchemaPage should fetch storedProcedure with basic fields', async () => {
    setMockPermissions({ ViewBasic: true });

    await act(async () => {
      renderWithQueryClient(<DatabaseSchemaPageComponent />);
    });

    expect(getStoredProceduresList).toHaveBeenCalledWith({
      databaseSchema: mockParams.fqn,
      limit: 0,
    });
  });

  it('DatabaseSchemaPage should render page for ViewBasic permissions', async () => {
    setMockPermissions({ ViewBasic: true });

    renderWithQueryClient(<DatabaseSchemaPageComponent />);

    await waitFor(() => {
      expect(getDatabaseSchemaDetailsByFQN).toHaveBeenCalledWith(
        mockParams.fqn,
        {
          fields: API_FIELDS.join(','),
          include: 'all',
        }
      );
    });

    expect(await screen.findByText('testDataAssetsHeader')).toBeInTheDocument();
    expect(await screen.findByTestId('tabs')).toBeInTheDocument();
    expect(await screen.findByText('testSchemaTablesTab')).toBeInTheDocument();
  });

  it('DatabaseSchemaPage should render tables by default', async () => {
    setMockPermissions({ ViewBasic: true });

    renderWithQueryClient(<DatabaseSchemaPageComponent />);

    await waitFor(() => {
      expect(getDatabaseSchemaDetailsByFQN).toHaveBeenCalledWith(
        mockParams.fqn,
        {
          fields: API_FIELDS.join(','),
          include: 'all',
        }
      );
    });

    expect(await screen.findByText('testSchemaTablesTab')).toBeInTheDocument();
  });

  it('should refetch data when decodedDatabaseSchemaFQN changes', async () => {
    const mockUseParams = jest.requireMock('react-router-dom').useParams;
    mockUseParams.mockReturnValue({
      fqn: 'sample_data.ecommerce_db.shopify',
      tab: 'table',
    });

    setMockPermissions({ ViewBasic: true });

    const { rerender } = renderWithQueryClient(<DatabaseSchemaPageComponent />);

    // Wait for initial API calls
    await waitFor(() => {
      expect(getDatabaseSchemaDetailsByFQN).toHaveBeenCalledWith(
        'sample_data.ecommerce_db.shopify',
        expect.any(Object)
      );
      expect(getStoredProceduresList).toHaveBeenCalledWith({
        databaseSchema: 'sample_data.ecommerce_db.shopify',
        limit: 0,
      });
      expect(fetchEntityTaskCountsInto).toHaveBeenCalledWith(
        'sample_data.ecommerce_db.shopify',
        expect.any(Function)
      );
    });

    jest.clearAllMocks();

    mockUseParams.mockReturnValue({
      fqn: 'Glue.default.information_schema',
      tab: 'table',
    });

    // Rerender with new FQN
    rerender(<DatabaseSchemaPageComponent />);

    // API calls should be made again with new FQN
    await waitFor(() => {
      expect(getDatabaseSchemaDetailsByFQN).toHaveBeenCalledWith(
        'Glue.default.information_schema',
        expect.any(Object)
      );
      expect(getStoredProceduresList).toHaveBeenCalledWith({
        databaseSchema: 'Glue.default.information_schema',
        limit: 0,
      });
      expect(fetchEntityTaskCountsInto).toHaveBeenCalledWith(
        'Glue.default.information_schema',
        expect.any(Function)
      );
    });
  });

  it('should pass entity name as pageTitle to PageLayoutV1', async () => {
    const mockSchemaData = {
      name: 'test-database-schema',
      id: '123',
    };

    (getDatabaseSchemaDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockSchemaData)
    );

    setMockPermissions({ ViewBasic: true });

    await act(async () => {
      renderWithQueryClient(<DatabaseSchemaPageComponent />);
    });

    expect(PageLayoutV1).toHaveBeenCalledWith(
      expect.objectContaining({
        pageTitle: 'test-database-schema',
      }),
      expect.anything()
    );
  });

  // Prior tests (notably "should refetch data when decodedDatabaseSchemaFQN changes")
  // override `useParams` and the entity-fetch mock's implementation and leave those overrides
  // sticky ({@code clearMocks} only clears call history). The voting tests must therefore
  // re-pin a known FQN and the full/narrow getDatabaseSchemaDetailsByFQN implementation before
  // rendering, so they don't inherit another test's FQN or a leftover `mockImplementationOnce`.
  const resetVoteTestState = () => {
    jest.requireMock('react-router-dom').useParams.mockReturnValue(mockParams);
    (getDatabaseSchemaDetailsByFQN as jest.Mock).mockImplementation(
      (_fqn: string, params) => {
        const fields = String(params?.fields ?? '');
        const isFullFields =
          fields.includes('domains') &&
          fields.includes('followers') &&
          fields.includes('extension') &&
          fields.includes('dataProducts');

        return Promise.resolve(
          isFullFields ? mockFullDatabaseSchema : mockNarrowDatabaseSchema
        );
      }
    );
    (updateDatabaseSchemaVotes as jest.Mock).mockImplementation(() =>
      Promise.resolve()
    );
    setMockPermissions({ ViewBasic: true });
  };

  it('should refresh votes by invalidating the cache with the full default fields instead of a narrow GET + replace', async () => {
    resetVoteTestState();

    await act(async () => {
      renderWithQueryClient(<DatabaseSchemaPageComponent />);
    });

    // Wait for the initial full-fields fetch to settle.
    await screen.findByText('testDataAssetsHeader');
    await waitFor(() => {
      expect(getDatabaseSchemaDetailsByFQN).toHaveBeenCalledWith(
        mockParams.fqn,
        {
          fields: API_FIELDS.join(','),
          include: 'all',
        }
      );
    });
    (getDatabaseSchemaDetailsByFQN as jest.Mock).mockClear();
    (updateDatabaseSchemaVotes as jest.Mock).mockClear();

    const voteButton = await screen.findByTestId('vote-up');
    await act(async () => {
      fireEvent.click(voteButton);
    });

    // The vote mutation is recorded against the loaded entity's id with the chosen vote type.
    await waitFor(() => {
      expect(updateDatabaseSchemaVotes).toHaveBeenCalledWith(
        mockFullDatabaseSchema.id,
        { updatedVoteType: 'votedUp' }
      );
    });

    // The post-vote fetch is the full-default-fields refetch produced by cache invalidation,
    // NOT the narrow `owners,tags,votes` GET the pre-fix handler issued (which the server
    // answers with `domains`/`followers`/`extension`/`dataProducts` null).
    await waitFor(() => {
      expect(getDatabaseSchemaDetailsByFQN).toHaveBeenCalledWith(
        mockParams.fqn,
        {
          fields: API_FIELDS.join(','),
          include: 'all',
        }
      );
    });

    expect(getDatabaseSchemaDetailsByFQN).not.toHaveBeenCalledWith(
      mockParams.fqn,
      {
        fields: ['owners', 'tags', 'votes'],
        include: 'all',
      }
    );
  });

  it('should not wipe domains, followers, extension or dataProducts from the header after voting', async () => {
    resetVoteTestState();

    await act(async () => {
      renderWithQueryClient(<DatabaseSchemaPageComponent />);
    });

    await screen.findByText('testDataAssetsHeader');

    // Initial header carries all four fields from the full-fields fetch.
    expect(await screen.findByTestId('header-domains')).toHaveTextContent(
      'has-domains'
    );
    expect(await screen.findByTestId('header-followers')).toHaveTextContent(
      'has-followers'
    );
    expect(await screen.findByTestId('header-extension')).toHaveTextContent(
      'has-extension'
    );
    expect(await screen.findByTestId('header-data-products')).toHaveTextContent(
      'has-data-products'
    );

    const voteButton = await screen.findByTestId('vote-up');
    await act(async () => {
      fireEvent.click(voteButton);
    });

    // The cache invalidation re-runs the full-fields fetch (previous test), keeping the
    // four fields intact instead of overwriting them with a narrow-GET response — which is
    // the user-visible bug (domain label drops, follow state resets, custom properties tab
    // empties).
    await waitFor(() => {
      expect(updateDatabaseSchemaVotes).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId('header-domains')).toHaveTextContent(
        'has-domains'
      );
    });

    expect(screen.getByTestId('header-followers')).toHaveTextContent(
      'has-followers'
    );
    expect(screen.getByTestId('header-extension')).toHaveTextContent(
      'has-extension'
    );
    expect(screen.getByTestId('header-data-products')).toHaveTextContent(
      'has-data-products'
    );
  });
});
