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
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs } from '../../enums/entity.enum';
import { Include } from '../../generated/type/include';
import {
  addContainerFollower,
  getContainerByName,
  getContainerChildrenByName,
} from '../../rest/storageAPI';
import { renderWithQueryClient } from '../../test/unit/test-utils';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import ContainerPage from './ContainerPage';
import {
  MOCK_CONTAINER_DATA,
  MOCK_CONTAINER_DATA_1,
} from './ContainerPage.mock';

// The page now reads permissions via useEntityPermissions rather than the raw
// PermissionProvider context — see TableDetailsPageV1.test.tsx's setMockPermissions for
// the full rationale (partial-object fidelity, mockReturnValue over mockImplementationOnce,
// the `deleted`-gating blind spot), mirrored here without repeating it.
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

jest.mock('../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
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
    default: (props: { children: ReactNode }) => (
      <div data-testid="activity-feed-provider">{props.children}</div>
    ),
  })
);

jest.mock('../../components/AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((ui) => ui),
}));

jest.mock(
  '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest.fn().mockReturnValue(<>ActivityFeedTab</>),
  })
);

jest.mock(
  '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel',
  () => jest.fn().mockImplementation(() => <>ActivityThreadPanel</>)
);

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    id: 'userid',
    selectedPersona: {
      id: 'personaid',
      name: 'persona name',
      description: 'persona description',
      type: 'persona type',
      owner: 'persona owner',
    },
  }),
}));

jest.mock(
  '../../components/common/CustomPropertyTable/CustomPropertyTable',
  () => ({
    CustomPropertyTable: jest.fn().mockReturnValue(<>CustomPropertyTable</>),
  })
);

jest.mock('../../components/common/EntityDescription/Description', () =>
  jest
    .fn()
    .mockImplementation(({ onThreadLinkSelect }) => (
      <button onClick={onThreadLinkSelect}>Description</button>
    ))
);

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(({ type, children }) => (
    <div>
      ErrorPlaceHolder
      <span>{type}</span>
      <div>{children}</div>
    </div>
  ))
);

jest.mock(
  '../../components/Container/ContainerChildren/ContainerChildren',
  () =>
    jest.fn().mockImplementation(({ isLoading }) => {
      getContainerByName(MOCK_CONTAINER_DATA_1.fullyQualifiedName, {
        fields: 'children',
      });

      return (
        <>
          <div>ContainerChildren</div>
          {isLoading && <span>ContainerChildrenLoader</span>}
        </>
      );
    })
);

jest.mock(
  '../../components/Container/ContainerDataModel/ContainerDataModel',
  () => jest.fn().mockReturnValue(<span>ContainerDataModel</span>)
);

jest.mock('../../components/Customization/GenericTab/GenericTab', () => ({
  GenericTab: jest.fn().mockImplementation(() => {
    const { getContainerByName } = jest.requireMock('../../rest/storageAPI');

    getContainerByName('s3_storage_sample.transactions', {
      fields: 'children',
    });

    return (
      <>
        <span>Description</span>
        <span>ContainerDataModel</span>
        <span>CustomPropertyTable</span>
        <span>label.glossary-term</span>
        <span>label.tag-plural</span>
        <span>label.data-product-plural</span>
        <span>ContainerChildren</span>
      </>
    );
  }),
}));

jest.mock(
  '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest
      .fn()
      .mockImplementation(({ afterDeleteAction, onFollowClick }) => (
        <div data-testid="data-asset-header">
          <button onClick={() => afterDeleteAction()}>Hard Delete</button>
          <button onClick={onFollowClick}>Follow Container</button>
        </div>
      )),
  })
);

jest.mock('../../components/Entity/EntityRightPanel/EntityRightPanel', () =>
  jest.fn().mockReturnValue(<>EntityRightPanel</>)
);

jest.mock('../../components/Lineage/Lineage.component', () =>
  jest.fn().mockReturnValue(<>EntityLineage</>)
);

jest.mock('../../context/LineageProvider/LineageProvider', () =>
  jest.fn().mockReturnValue(<>LineageProvider</>)
);

jest.mock('../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => <div data-testid="loader">Loader</div>),
  PageLoader: jest
    .fn()
    .mockImplementation(() => <div data-testid="loader">Loader</div>),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <>{children}</>)
);

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () =>
  jest.fn().mockImplementation(({ name }) => <div>{name}</div>)
);

jest.mock('../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest.fn().mockReturnValue('/container-detail-path'),
  getVersionPath: jest.fn().mockReturnValue('/version-path'),
}));

jest.mock('../../rest/storageAPI');

jest.mock('../../utils/EntityDisplayPureUtils', () => ({
  getEntityMissingError: jest.fn().mockImplementation(() => <div>Error</div>),
}));
jest.mock('../../utils/RecentActivityUtils', () => ({
  addToRecentViewed: jest.fn(),
}));
jest.mock('../../utils/FeedUtilsPure', () => ({
  fetchEntityActivityCountInto: jest.fn(),
  fetchEntityTaskCountsInto: jest.fn(),
  getFeedCounts: jest.fn().mockReturnValue(0),
}));
jest.mock('../../utils/TagsUtils', () => ({
  sortTagsCaseInsensitive: jest.fn().mockImplementation((tags) => tags),
}));

jest.mock('../../utils/EntityDisplayPureUtils', () => ({
  getEntityMissingError: jest.fn().mockImplementation(() => <div>Error</div>),
}));

jest.mock('../../utils/RecentActivityUtils', () => ({
  addToRecentViewed: jest.fn(),
}));

jest.mock('../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    currentPage: 1,
    showPagination: true,
    pageSize: 10,
    handlePageChange: jest.fn(),
    handlePagingChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
  }),
}));

jest.mock('../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.name ?? 'entityName'),
}));
jest.mock('../../utils/EntityPureUtils', () => ({
  getEntityFeedLink: jest.fn(),
}));
jest.mock('../../utils/EntitySortUtils', () => ({
  getColumnSorter: jest.fn(),
}));

jest.mock('../../utils/StringUtils', () => ({
  getDecodedFqn: jest.fn().mockImplementation((fqn) => fqn),
  getEncodedFqn: jest.fn().mockImplementation((fqn) => fqn),
  stringToHTML: jest.fn().mockImplementation((str) => str),
  getErrorText: jest
    .fn()
    .mockImplementation(
      (error: Error, defaultMessage: string) =>
        error?.message || defaultMessage || 'Error'
    ),
}));

jest.mock('../../utils/TableUtils', () => {
  const actual = jest.requireActual('../../utils/TableUtils');

  return {
    ...actual,
    getTagsWithoutTier: jest.fn().mockReturnValue([]),
    getTierTags: jest.fn().mockReturnValue([]),
  };
});

jest.mock('../../utils/TagsUtils', () => ({
  createTagObject: jest.fn().mockImplementation((tagObject) => tagObject),
  updateTierTag: jest.fn().mockImplementation((tagObject) => tagObject),
  getTagPlaceholder: jest.fn().mockReturnValue(''),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../components/Customization/GenericProvider/GenericProvider',
  () => ({
    GenericProvider: jest
      .fn()
      .mockImplementation(({ children }) => <>{children}</>),
    useGenericContext: jest.fn().mockReturnValue({
      data: {},
      permissions: {
        EditAll: true,
        EditDescription: true,
        EditGlossaryTerms: true,
        EditTags: true,
      },
      isVersionView: false,
      deleted: false,
    }),
  })
);

const mockUseParams = jest.fn().mockReturnValue({
  fqn: MOCK_CONTAINER_DATA.fullyQualifiedName,
  tab: 'schema',
});

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useParams: jest.fn().mockImplementation(() => mockUseParams()),
  useLocation: jest.fn().mockImplementation(() => ({
    pathname: 'mockPath',
    search: '',
    hash: '',
    state: null,
    key: 'default',
  })),
}));

jest.mock('../../hoc/LimitWrapper', () => {
  return jest.fn().mockImplementation(({ children }) => <>{children}</>);
});

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

describe('Container Page Component', () => {
  beforeEach(() => {
    // ViewAll/EditAll: true grants every named view/edit flag via the real
    // getDerivedPermissionFlags fallback (see setMockPermissions) — the equivalent of the
    // old blanket getPrioritizedEditPermission/getPrioritizedViewPermission === true stubs.
    setMockPermissions({ ViewAll: true, EditAll: true });
    mockUseParams.mockReturnValue({
      fqn: MOCK_CONTAINER_DATA.fullyQualifiedName,
      tab: 'schema',
    });

    (getContainerChildrenByName as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
  });

  // Guardrail for the two-call pattern (see the comment on setMockPermissions and the
  // early/late useEntityPermissions call sites in ContainerPage.tsx). Unlike
  // TableDetailsPageV1's stable tableFqn, ContainerPage's identifier (resolvedEntityFqn)
  // legitimately changes ACROSS renders (empty on first paint, then the resolved FQN, then
  // possibly a parent FQN on a column-deep-link fallback) — so this checks each render's
  // PAIR of calls against each other, not every call against the very first.
  afterEach(() => {
    const calls = mockUseEntityPermissions.mock.calls;
    for (let i = 0; i + 1 < calls.length; i += 2) {
      const [resource, identifier] = calls[i];
      const [laterResource, laterIdentifier] = calls[i + 1];

      expect(laterResource).toBe(resource);
      expect(laterIdentifier).toBe(identifier);
    }
  });

  it('should show error-placeholder, if not have view permission', async () => {
    setMockPermissions({ ViewBasic: false, ViewAll: false });

    (getContainerByName as jest.Mock).mockResolvedValue({});

    renderWithQueryClient(
      <MemoryRouter>
        <ContainerPage />
      </MemoryRouter>
    );

    // No transient Loader assertion here: unlike the old async
    // usePermissionProvider().getEntityPermissionByFqn round-trip, the mocked
    // useEntityPermissions resolves synchronously, and a denied view permission disables
    // the container useQuery outright (never fetches) — so the page goes straight from
    // first render to the permission ErrorPlaceHolder with no loading frame to observe.
    await waitFor(() => expect(mockUseEntityPermissions).toHaveBeenCalled());

    expect(
      await screen.findByText(ERROR_PLACEHOLDER_TYPE.PERMISSION)
    ).toBeInTheDocument();
  });

  it('fetch container data, if have view permission', async () => {
    renderWithQueryClient(
      <MemoryRouter>
        <ContainerPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Loader')).toBeVisible();

    expect(screen.getByText('Loader')).toBeVisible();

    (getContainerByName as jest.Mock).mockResolvedValue(MOCK_CONTAINER_DATA);

    await waitFor(() =>
      expect(mockUseEntityPermissions).toHaveBeenCalled()
    );

    await waitFor(() =>
      expect(getContainerByName).toHaveBeenCalledWith(
        MOCK_CONTAINER_DATA.fullyQualifiedName,
        {
          fields: [
            'parent',
            'dataModel',
            'owners',
            'tags',
            'followers',
            'extension',
            'domains',
            'dataProducts',
            'votes',
          ],
          include: Include.All,
        }
      )
    );
  });

  it('show ErrorPlaceHolder if container data fetch fail', async () => {
    (getContainerByName as jest.Mock).mockRejectedValue(
      'failed to fetch container data'
    ); // For fetch

    renderWithQueryClient(
      <MemoryRouter>
        <ContainerPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Loader')).toBeVisible();

    await waitFor(() =>
      expect(mockUseEntityPermissions).toHaveBeenCalled()
    );

    await waitFor(() => expect(getContainerByName).toHaveBeenCalledTimes(1));

    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('should render the page container data, with the schema tab selected', async () => {
    (getContainerByName as jest.Mock).mockResolvedValue(MOCK_CONTAINER_DATA);

    renderWithQueryClient(
      <MemoryRouter>
        <ContainerPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Loader')).toBeVisible();

    await waitFor(() =>
      expect(mockUseEntityPermissions).toHaveBeenCalled()
    );

    await waitFor(() =>
      expect(getContainerByName).toHaveBeenCalledWith(
        's3_storage_sample.transactions',
        {
          fields: [
            'parent',
            'dataModel',
            'owners',
            'tags',
            'followers',
            'extension',
            'domains',
            'dataProducts',
            'votes',
          ],
          include: 'all',
        }
      )
    );

    expect(screen.getByTestId('data-asset-header')).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');

    expect(tabs).toHaveLength(7);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Description')).toBeVisible();
    expect(screen.getByText('ContainerDataModel')).toBeVisible();
    expect(screen.getByText('CustomPropertyTable')).toBeVisible();
    expect(screen.getByText('label.glossary-term')).toBeVisible();
    expect(screen.getByText('label.tag-plural')).toBeVisible();
    expect(screen.getByText('label.data-product-plural')).toBeVisible();
  });

  it('onClick of follow container should call addContainerFollower', async () => {
    (getContainerByName as jest.Mock).mockResolvedValue(MOCK_CONTAINER_DATA);

    renderWithQueryClient(
      <MemoryRouter>
        <ContainerPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Loader')).toBeVisible();

    const followButton = await screen.findByRole('button', {
      name: 'Follow Container',
    });

    userEvent.click(followButton);

    await waitFor(() => expect(addContainerFollower).toHaveBeenCalled());
  });

  it('tab switch should work', async () => {
    (getContainerByName as jest.Mock).mockResolvedValue(MOCK_CONTAINER_DATA);

    renderWithQueryClient(
      <MemoryRouter>
        <ContainerPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Loader')).toBeVisible();

    const childrenTab = await screen.findByRole('tab', {
      name: 'label.container-plural',
    });

    userEvent.click(childrenTab);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        { pathname: '/container-detail-path' },
        { replace: true }
      )
    );
  });

  it('children should render on children tab', async () => {
    (getContainerByName as jest.Mock).mockResolvedValue(MOCK_CONTAINER_DATA_1);
    mockUseParams.mockReturnValue({
      fqn: MOCK_CONTAINER_DATA_1.fullyQualifiedName,
      tab: EntityTabs.CHILDREN,
    });

    renderWithQueryClient(
      <MemoryRouter>
        <ContainerPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Loader')).toBeVisible();

    const childrenTab = await screen.findByRole('tab', {
      name: 'label.container-plural',
    });

    expect(childrenTab).toHaveAttribute('aria-selected', 'true');

    expect(screen.getByText('ContainerChildren')).toBeVisible();

    expect(getContainerByName).toHaveBeenCalledWith(
      MOCK_CONTAINER_DATA_1.fullyQualifiedName,
      {
        fields: 'children',
      }
    );
  });

  it('should pass entity name as pageTitle to PageLayoutV1', async () => {
    (getContainerByName as jest.Mock).mockResolvedValue(MOCK_CONTAINER_DATA);

    renderWithQueryClient(
      <MemoryRouter>
        <ContainerPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(getContainerByName).toHaveBeenCalled());

    await waitFor(() =>
      expect(PageLayoutV1).toHaveBeenCalledWith(
        expect.objectContaining({
          pageTitle: MOCK_CONTAINER_DATA.name,
        }),
        expect.anything()
      )
    );
  });
});
