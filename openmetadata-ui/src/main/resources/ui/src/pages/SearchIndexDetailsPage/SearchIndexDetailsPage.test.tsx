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

import { act, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { getSearchIndexDetailsByFQN } from '../../rest/SearchIndexAPI';
import { renderWithQueryClient } from '../../test/unit/test-utils';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import SearchIndexDetailsPage from './SearchIndexDetailsPage';

const renderPage = () =>
  renderWithQueryClient(
    <MemoryRouter>
      <SearchIndexDetailsPage />
    </MemoryRouter>
  );

// The page now reads permissions via useEntityPermissions rather than the raw
// PermissionProvider context, so mocking that hook (instead of the old
// getEntityPermissionByFqn REST boundary) is what drives the page's permission-gated
// behavior in these tests. See TableDetailsPageV1.test.tsx's setMockPermissions for the
// full rationale (partial-object fidelity, mockReturnValue over mockImplementationOnce,
// the `deleted`-gating blind spot) — mirrored here without repeating it.
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

jest.mock('../../rest/SearchIndexAPI', () => ({
  getSearchIndexDetailsByFQN: jest.fn().mockImplementation(() =>
    Promise.resolve({
      name: 'test',
      id: '123',
    })
  ),
  addFollower: jest.fn(),
  patchSearchIndexDetails: jest.fn(),
  removeFollower: jest.fn(),
  restoreSearchIndex: jest.fn(),
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

jest.mock('../../components/common/QueryViewer/QueryViewer.component', () => {
  return jest.fn().mockImplementation(() => <p>testQueryViewer</p>);
});

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <p>{children}</p>)
);

jest.mock(
  '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest
      .fn()
      .mockImplementation(() => <p>testDataAssetsHeader</p>),
  })
);

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () => {
  return jest.fn().mockImplementation(({ name }) => <p>{name}</p>);
});

jest.mock('../../components/Tag/TagsContainerV2/TagsContainerV2', () => {
  return jest.fn().mockImplementation(() => <p>testTagsContainerV2</p>);
});

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

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest
    .fn()
    .mockImplementation(() => ({ fqn: 'fqn', tab: 'fields' })),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
  useLocation: jest.fn().mockImplementation(() => ({ pathname: 'mockPath' })),
}));

jest.mock('../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <>testLoader</>),
  PageLoader: jest
    .fn()
    .mockImplementation(() => <div data-testid="loader">Loader</div>),
}));

jest.mock('./SearchIndexFieldsTab/SearchIndexFieldsTab', () => {
  return jest.fn().mockImplementation(() => <p>testSearchIndexFieldsTab</p>);
});

jest.mock('../../hoc/LimitWrapper', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
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

jest.mock('../../hooks/useCustomPages', () => ({
  useCustomPages: jest.fn().mockImplementation(() => ({
    customizedPage: null,
    isLoading: false,
  })),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({
    entityFqn: 'test-service.test-search-index',
  })),
}));

describe('SearchIndexDetailsPage component', () => {
  beforeEach(() => {
    setMockPermissions();
  });

  // Guardrail for the two-call pattern (see the comment on setMockPermissions and the
  // early/late useEntityPermissions call sites in SearchIndexDetailsPage.tsx): the page
  // must call the hook with the IDENTICAL (resource, identifier) pair both times.
  afterEach(() => {
    const calls = mockUseEntityPermissions.mock.calls;
    if (calls.length === 0) {
      return;
    }
    const [expectedResource, expectedIdentifier] = calls[0];
    calls.forEach(([resource, identifier]) => {
      expect(resource).toBe(expectedResource);
      expect(identifier).toBe(expectedIdentifier);
    });
  });

  it('SearchIndexDetailsPage should fetch permissions', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockUseEntityPermissions).toHaveBeenCalledWith(
        ResourceEntity.SEARCH_INDEX,
        'test-service.test-search-index'
      );
    });
  });

  it('SearchIndexDetailsPage should not fetch search index details if permission is there', async () => {
    renderPage();

    await waitFor(() => {
      expect(getSearchIndexDetailsByFQN).toHaveBeenCalledTimes(0);
    });
  });

  it('renders the loader while permissions are loading', () => {
    setMockPermissions({}, { isLoading: true });

    renderPage();

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByText('testDataAssetsHeader')).not.toBeInTheDocument();
  });

  it('SearchIndexDetailsPage should fetch search index details with basic fields', async () => {
    setMockPermissions({ ViewBasic: true });

    await act(async () => {
      renderPage();
    });

    await waitFor(
      () => {
        expect(getSearchIndexDetailsByFQN).toHaveBeenCalledWith(
          'test-service.test-search-index',
          {
            fields:
              'fields,followers,tags,owners,domains,votes,dataProducts,extension',
          }
        );
      },
      { timeout: 30000 }
    );
  }, 30000);

  it('SearchIndexDetailsPage should render page for ViewBasic permissions', async () => {
    setMockPermissions({ ViewBasic: true });

    await act(async () => {
      renderPage();
    });

    await waitFor(
      () => {
        expect(getSearchIndexDetailsByFQN).toHaveBeenCalledWith(
          'test-service.test-search-index',
          {
            fields:
              'fields,followers,tags,owners,domains,votes,dataProducts,extension',
          }
        );
      },
      { timeout: 30000 }
    );

    expect(await screen.findByText('testDataAssetsHeader')).toBeInTheDocument();
    expect(await screen.findByText('label.field-plural')).toBeInTheDocument();
  }, 30000);

  it('SearchIndexDetailsPage should render SearchIndexFieldsTab by default', async () => {
    setMockPermissions({ ViewBasic: true });

    await act(async () => {
      renderPage();
    });

    await waitFor(
      () => {
        expect(getSearchIndexDetailsByFQN).toHaveBeenCalledWith(
          'test-service.test-search-index',
          {
            fields:
              'fields,followers,tags,owners,domains,votes,dataProducts,extension',
          }
        );
      },
      { timeout: 30000 }
    );

    expect(
      await screen.findByText('testSearchIndexFieldsTab')
    ).toBeInTheDocument();
  }, 30000);

  it('should pass entity name as pageTitle to PageLayoutV1', async () => {
    const mockSearchIndexData = {
      name: 'test-search-index',
      id: '123',
      fullyQualifiedName: 'test-service.test-search-index',
    };

    (getSearchIndexDetailsByFQN as jest.Mock).mockImplementation(() =>
      Promise.resolve(mockSearchIndexData)
    );

    setMockPermissions({ ViewBasic: true });

    await act(async () => {
      renderPage();
    });

    await waitFor(
      () => {
        expect(PageLayoutV1).toHaveBeenCalledWith(
          expect.objectContaining({
            pageTitle: 'test-search-index',
          }),
          expect.anything()
        );
      },
      { timeout: 30000 }
    );
  }, 30000);
});
