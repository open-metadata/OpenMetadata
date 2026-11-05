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

import {
  act,
  findByTestId,
  findByText,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import {
  getDatabaseDetailsByFQN,
  patchDatabaseDetails,
  updateDatabaseVotes,
} from '../../rest/databaseAPI';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../test/unit/test-utils';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import DatabaseDetailsPage from './DatabaseDetailsPage';

// React Query notifies its observers on a timer, which the suite's global fake timers hold
// back. With this in place, a read that resolves inside an awaited `act` is on screen when
// the `act` returns — needed for the voting tests, which assert the header's post-vote state.
runQueryNotificationsSynchronously();

const mockDatabase = {
  id: 'b705cc69-55fd-4338-aa45-86f34b655ae6',
  type: 'database',
  name: 'bigquery_gcp.ecommerce_db',
  description:
    'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
  deleted: false,
  href: 'http://localhost:8585/api/v1/databases/b705cc69-55fd-4338-aa45-86f34b655ae6',

  service: {
    id: 'bc13e95f-83ac-458a-9528-f4ca26657568',
    type: 'databaseService',
    name: 'bigquery_gcp',
    description: '',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/databaseServices/bc13e95f-83ac-458a-9528-f4ca26657568',
  },
};

// Full-fields entity, matching what the server returns for the page's default fields
// `owners,tags,domains,votes,extension,dataProducts,followers` — i.e. the entry the React
// Query cache is keyed on. Used to assert voting does NOT wipe these fields.
const mockFullDatabase = {
  ...mockDatabase,
  version: 0.1,
  serviceType: 'BigQuery',
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
      href: 'http://localhost:8585/api/v1/dataProducts/dp-1',
    },
  ],
};

// Narrow-fields entity: mirrors the server's `clearFieldsInternal` behaviour — a GET that
// requests only `owners,tags,votes` returns every other relationship-backed field (`domains`,
// `followers`, `extension`, `dataProducts`) as null. Used to prove that the pre-fix path
// (narrow GET + `setDatabase`) would wipe the header state.
const mockNarrowDatabase = {
  ...mockFullDatabase,
  domains: null,
  followers: null,
  extension: null,
  dataProducts: null,
};

const mockSchemaData = {
  data: [
    {
      id: 'ed2c5f5e-e0d7-4b90-9efe-d50b3ecd645f',
      name: 'shopify',
      fullyQualifiedName: 'bigquery_gcp.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      version: 0.1,
      updatedAt: 1649411380854,
      updatedBy: 'anonymous',
      href: 'http://localhost:8585/api/v1/databases/ed2c5f5e-e0d7-4b90-9efe-d50b3ecd645f',
      service: {
        id: 'bc13e95f-83ac-458a-9528-f4ca26657568',
        type: 'databaseService',
        name: 'bigquery_gcp',
        description: '',
        deleted: false,
        href: 'http://localhost:8585/api/v1/services/databaseServices/bc13e95f-83ac-458a-9528-f4ca26657568',
      },
      serviceType: 'BigQuery',
      database: {
        id: 'b705cc69-55fd-4338-aa45-86f34b655ae6',
        type: 'database',
        name: 'bigquery_gcp.ecommerce_db',
        description:
          'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/databases/b705cc69-55fd-4338-aa45-86f34b655ae6',
      },
      usageSummary: {
        dailyStats: {
          count: 0,
          percentileRank: 0,
        },
        weeklyStats: {
          count: 0,
          percentileRank: 0,
        },
        monthlyStats: {
          count: 0,
          percentileRank: 0,
        },
        date: '2022-04-08',
      },
      deleted: false,
    },
  ],
  paging: { after: 'ZMbpLOqQQsREk_7DmEOr', total: 12 },
};

const mockNavigate = jest.fn();
const mockGetServiceDataAssetsTabPath = jest
  .fn()
  .mockReturnValue('/service/databaseServices/bigquery/databases');

jest.mock('../../utils/ConnectionsRouterClassBase', () => ({
  __esModule: true,
  default: {
    getServiceDataAssetsTabPath: (...args: unknown[]) =>
      mockGetServiceDataAssetsTabPath(...args),
  },
}));

// DatabaseDetailsPage now fetches its own permissions via useEntityPermissions (Task 8
// batch-final, two-call split — DatabaseSchemaPage.test.tsx precedent) rather than an
// imperative usePermissionProvider().getEntityPermissionByFqn call — mock the hook
// directly. Sticky (mockReturnValue, not mockReturnValueOnce): the hook is called twice
// per render (view-tier + edit-tier).
const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (
  overrides: Partial<OperationPermission> = DEFAULT_ENTITY_PERMISSION
) => {
  const permissions = overrides as OperationPermission;
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, false),
  });
};

jest.mock('../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

setMockPermissions({
  Create: true,
  Delete: true,
  ViewAll: true,
  EditAll: true,
  EditDescription: true,
  EditDisplayName: true,
  EditCustomFields: true,
});

jest.mock(
  '../../components/common/RichTextEditor/RichTextEditorPreviewerV1',
  () => {
    return jest.fn().mockImplementation(({ markdown }) => <p>{markdown}</p>);
  }
);

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ search: '?schema=sales' }));
});

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p data-testid="link">{children}</p>
    )),
  useParams: jest.fn().mockReturnValue({
    fqn: 'bigquery.shopify',
  }),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useLocation: jest.fn().mockImplementation(() => ({ pathname: 'mockPath' })),
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

jest.mock('../../rest/databaseAPI', () => ({
  getDatabaseDetailsByFQN: jest
    .fn()
    .mockImplementation((_fqn: string, params) => {
      // Mirror the server's `clearFieldsInternal`: a request that does NOT ask for `domains`
      // (or `followers`/`extension`/`dataProducts`) gets them back null. The page's default
      // fields include `domains`, so the full cache fetch keeps the populated entity; the
      // pre-fix narrow GET (`owners,tags,votes`) would return the nulled variant.
      const fields = (params?.fields ?? '') as string;
      const isFullFields =
        String(fields).includes('domains') &&
        String(fields).includes('followers') &&
        String(fields).includes('extension') &&
        String(fields).includes('dataProducts');

      return Promise.resolve(
        isFullFields ? mockFullDatabase : mockNarrowDatabase
      );
    }),
  patchDatabaseDetails: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockFullDatabase)),

  getDatabaseSchemas: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockSchemaData)),

  updateDatabaseVotes: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../utils/TablePureUtils', () => ({
  getUsagePercentile: jest.fn().mockReturnValue('Medium - 45th pctile'),
  getTierTags: jest.fn().mockImplementation(() => ({})),
  getTagsWithoutTier: jest.fn().mockImplementation(() => []),
  extractColumnsFromData: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/TableUtils', () => ({
  getTableExpandableConfig: jest.fn().mockReturnValue({}),
}));

jest.mock('../../components/common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockReturnValue(<div>NextPrevious</div>);
});

jest.mock('../../components/Tag/TagsContainerV2/TagsContainerV2', () => {
  return jest.fn().mockReturnValue(<div>TagsContainerV2</div>);
});

jest.mock('../../utils/TagsUtils', () => ({
  getTableTags: jest.fn().mockReturnValue([
    {
      labelType: 'Manual',
      state: 'Confirmed',
      tagFQN: 'PersonalData.Personal',
    },
  ]),
}));
jest.mock('../../components/common/TabsLabel/TabsLabel.component', () => {
  return jest
    .fn()
    .mockImplementation(({ name, id }) => <div data-testid={id}>{name}</div>);
});

jest.mock(
  '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest
      .fn()
      .mockReturnValue(<p>ModalWithMarkdownEditor</p>),
  })
);

jest.mock('../../components/common/EntityDescription/Description', () => {
  return jest.fn().mockReturnValue(<p>Description</p>);
});

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => children)
);

jest.mock(
  '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => {
    return jest.fn().mockReturnValue(<p>ActivityFeedTab</p>);
  }
);

jest.mock(
  '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel',
  () => {
    return jest.fn().mockReturnValue(<p>ActivityThreadPanel</p>);
  }
);
jest.mock(
  '../../components/common/SearchBarComponent/SearchBar.component',
  () => {
    return jest.fn().mockReturnValue(<p>Searchbar.component</p>);
  }
);

jest.mock(
  '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest.fn().mockImplementation(
      ({
        afterDeleteAction,
        onUpdateVote,
        dataAsset,
      }: {
        afterDeleteAction: (isSoftDelete?: boolean) => void;
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
          <p>DataAssetsHeader</p>
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
          <button
            data-testid="hard-delete"
            onClick={() => afterDeleteAction(false)}>
            hardDelete
          </button>
          <button
            data-testid="soft-delete"
            onClick={() => afterDeleteAction(true)}>
            softDelete
          </button>
        </div>
      )
    ),
  })
);

jest.mock('../../components/AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((Some) => Some),
}));

jest.mock(
  '../../components/Database/DatabaseSchema/DatabaseSchemaTable/DatabaseSchemaTable',
  () => ({
    DatabaseSchemaTable: jest
      .fn()
      .mockImplementation(() => <>testDatabaseSchemaTable</>),
  })
);

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

describe('Test DatabaseDetails page', () => {
  beforeEach(() => {
    setMockPermissions({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    });
  });

  it('Component should render', async () => {
    const { container } = renderWithQueryClient(
      <MemoryRouter>
        <DatabaseDetailsPage />
      </MemoryRouter>
    );

    const entityHeader = await findByText(container, 'DataAssetsHeader');
    const descriptionContainer = await findByText(container, 'Description');
    const databaseTable = await findByText(
      container,
      'testDatabaseSchemaTable'
    );

    expect(getDatabaseDetailsByFQN).toHaveBeenCalledWith('bigquery.shopify', {
      fields: 'owners,tags,domains,votes,extension,dataProducts,followers',
      include: 'all',
    });
    expect(entityHeader).toBeInTheDocument();
    expect(descriptionContainer).toBeInTheDocument();
    expect(databaseTable).toBeInTheDocument();
  });

  it('Should render error placeholder if getDatabase Details Api fails', async () => {
    (getDatabaseDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        response: {
          data: {
            message: 'Error!',
          },
        },
      })
    );
    const { container } = renderWithQueryClient(
      <MemoryRouter>
        <DatabaseDetailsPage />
      </MemoryRouter>
    );

    const errorPlaceholder = await findByTestId(
      container,
      'no-data-placeholder'
    );

    expect(errorPlaceholder).toBeInTheDocument();
  });

  it('Should render database component if patchDatabaseDetails Api fails', async () => {
    (patchDatabaseDetails as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        response: {
          data: {
            message: 'Error!',
          },
        },
      })
    );
    const { container } = renderWithQueryClient(
      <MemoryRouter>
        <DatabaseDetailsPage />
      </MemoryRouter>
    );

    const entityHeader = await findByText(container, 'DataAssetsHeader');
    const descriptionContainer = await findByText(container, 'Description');
    const databaseTable = await findByText(
      container,
      'testDatabaseSchemaTable'
    );

    expect(entityHeader).toBeInTheDocument();
    expect(descriptionContainer).toBeInTheDocument();
    expect(databaseTable).toBeInTheDocument();
  });

  it('should pass entity name as pageTitle to PageLayoutV1', async () => {
    renderWithQueryClient(
      <MemoryRouter>
        <DatabaseDetailsPage />
      </MemoryRouter>
    );

    await findByText(document.body, 'DataAssetsHeader');

    expect(PageLayoutV1).toHaveBeenCalledWith(
      expect.objectContaining({
        pageTitle: 'bigquery_gcp.ecommerce_db',
      }),
      expect.anything()
    );
  });

  it('should render the permission placeholder and skip the entity fetch when view access is denied', async () => {
    // canViewBasic (view-tier) is what the entity query's `enabled` — and the page's own
    // render gate — depend on; ViewAll alone (without ViewBasic present) still grants it via
    // the getPrioritizedViewPermission fallback the old code used, so deny both explicitly.
    setMockPermissions({ ViewBasic: false, ViewAll: false });
    (getDatabaseDetailsByFQN as jest.Mock).mockClear();

    const { container } = renderWithQueryClient(
      <MemoryRouter>
        <DatabaseDetailsPage />
      </MemoryRouter>
    );

    const errorPlaceholder = await findByTestId(
      container,
      'permission-error-placeholder'
    );

    expect(errorPlaceholder).toBeInTheDocument();
    expect(getDatabaseDetailsByFQN).not.toHaveBeenCalled();
  });

  it('should navigate to the parent service asset tab after a hard delete', async () => {
    mockNavigate.mockClear();
    mockGetServiceDataAssetsTabPath.mockClear();

    const { container } = renderWithQueryClient(
      <MemoryRouter>
        <DatabaseDetailsPage />
      </MemoryRouter>
    );

    const hardDeleteButton = await findByTestId(container, 'hard-delete');
    fireEvent.click(hardDeleteButton);

    expect(mockGetServiceDataAssetsTabPath).toHaveBeenCalledWith(
      'databaseServices',
      'bigquery'
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      '/service/databaseServices/bigquery/databases'
    );
  });

  it('should not navigate away after a soft delete', async () => {
    mockNavigate.mockClear();

    const { container } = renderWithQueryClient(
      <MemoryRouter>
        <DatabaseDetailsPage />
      </MemoryRouter>
    );

    const softDeleteButton = await findByTestId(container, 'soft-delete');
    fireEvent.click(softDeleteButton);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should refresh votes by invalidating the cache with the full default fields instead of a narrow GET + replace', async () => {
    const { container } = renderWithQueryClient(
      <MemoryRouter>
        <DatabaseDetailsPage />
      </MemoryRouter>
    );

    // Wait for the initial full-fields fetch to settle.
    await findByText(container, 'DataAssetsHeader');
    await waitFor(() => {
      expect(getDatabaseDetailsByFQN).toHaveBeenCalledWith('bigquery.shopify', {
        fields: 'owners,tags,domains,votes,extension,dataProducts,followers',
        include: 'all',
      });
    });
    (getDatabaseDetailsByFQN as jest.Mock).mockClear();
    (updateDatabaseVotes as jest.Mock).mockClear();

    const voteButton = await findByTestId(container, 'vote-up');
    await act(async () => {
      fireEvent.click(voteButton);
    });

    // The vote mutation is recorded against the loaded entity's id with the chosen vote type.
    await waitFor(() => {
      expect(updateDatabaseVotes).toHaveBeenCalledWith(mockFullDatabase.id, {
        updatedVoteType: 'votedUp',
      });
    });

    // The post-vote fetch is the full-default-fields refetch produced by cache invalidation,
    // NOT the narrow `owners,tags,votes` GET the pre-fix handler issued (which the server
    // answers with `domains`/`followers`/`extension`/`dataProducts` null).
    await waitFor(() => {
      expect(getDatabaseDetailsByFQN).toHaveBeenCalledWith('bigquery.shopify', {
        fields: 'owners,tags,domains,votes,extension,dataProducts,followers',
        include: 'all',
      });
    });

    expect(getDatabaseDetailsByFQN).not.toHaveBeenCalledWith(
      'bigquery.shopify',
      {
        fields: ['owners', 'tags', 'votes'],
        include: 'all',
      }
    );
  });

  it('should not wipe domains, followers, extension or dataProducts from the header after voting', async () => {
    const { container } = renderWithQueryClient(
      <MemoryRouter>
        <DatabaseDetailsPage />
      </MemoryRouter>
    );

    await findByText(container, 'DataAssetsHeader');

    // Initial header carries all four fields from the full-fields fetch.
    expect(await findByTestId(container, 'header-domains')).toHaveTextContent(
      'has-domains'
    );
    expect(await findByTestId(container, 'header-followers')).toHaveTextContent(
      'has-followers'
    );
    expect(await findByTestId(container, 'header-extension')).toHaveTextContent(
      'has-extension'
    );
    expect(
      await findByTestId(container, 'header-data-products')
    ).toHaveTextContent('has-data-products');

    const voteButton = await findByTestId(container, 'vote-up');
    await act(async () => {
      fireEvent.click(voteButton);
    });

    // The cache invalidation re-runs the full-fields fetch (previous test), keeping the
    // four fields intact instead of overwriting them with a narrow-GET response — which is
    // the user-visible bug (domain label drops, follow state resets, custom properties tab
    // empties).
    await waitFor(() => {
      expect(updateDatabaseVotes).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="header-domains"]')
      ).toHaveTextContent('has-domains');
    });

    expect(
      container.querySelector('[data-testid="header-followers"]')
    ).toHaveTextContent('has-followers');
    expect(
      container.querySelector('[data-testid="header-extension"]')
    ).toHaveTextContent('has-extension');
    expect(
      container.querySelector('[data-testid="header-data-products"]')
    ).toHaveTextContent('has-data-products');
  });
});
