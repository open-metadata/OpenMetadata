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

import { act, render, screen, waitFor } from '@testing-library/react';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { getDatabaseSchemaDetailsByFQN } from '../../rest/databaseAPI';
import { getStoredProceduresList } from '../../rest/storedProceduresAPI';
import { getFeedCounts } from '../../utils/CommonUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import DatabaseSchemaPageComponent from './DatabaseSchemaPage.component';
import {
  mockGetDatabaseSchemaDetailsByFQNData,
  mockPatchDatabaseSchemaDetailsData,
  mockPostThreadData,
} from './mocks/DatabaseSchemaPage.mock';

const mockEntityPermissionByFqn = jest
  .fn()
  .mockImplementation(() => DEFAULT_ENTITY_PERMISSION);

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: mockEntityPermissionByFqn,
  })),
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
    DataAssetsHeader: jest
      .fn()
      .mockImplementation(() => <p>testDataAssetsHeader</p>),
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

jest.mock('../../pages/StoredProcedure/StoredProcedureTab', () => {
  return jest.fn().mockImplementation(() => <div>testStoredProcedureTab</div>);
});

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <p>{children}</p>);
});

jest.mock('../../utils/StringsUtils', () => ({
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

jest.mock('../../utils/CommonUtils', () => ({
  getEntityMissingError: jest.fn().mockImplementation((error) => error),
  getFeedCounts: jest.fn().mockImplementation(() => FEED_COUNT_INITIAL_DATA),
  sortTagsCaseInsensitive: jest.fn(),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getDatabaseSchemaVersionPath: jest.fn().mockImplementation((path) => path),
}));

jest.mock('../../utils/TableUtils', () => ({
  getTierTags: jest.fn(),
  getTagsWithoutTier: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  showSuccessToast: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>testLoader</div>)
);

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <p>ErrorPlaceHolder</p>)
);

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: mockEntityPermissionByFqn,
  })),
}));

jest.mock('../../rest/feedsAPI', () => ({
  postThread: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockPostThreadData)),
}));

jest.mock('../../rest/databaseAPI', () => ({
  getDatabaseSchemaDetailsByFQN: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(mockGetDatabaseSchemaDetailsByFQNData)
    ),
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
    .mockImplementation(() =>
      Promise.resolve(mockPatchDatabaseSchemaDetailsData)
    ),
}));

jest.mock('../../utils/EntityUtilClassBase', () => {
  return {
    getManageExtraOptions: jest.fn().mockReturnValue([]),
  };
});

const mockParams = {
  fqn: 'sample_data.ecommerce_db.shopify',
  tab: 'table',
};

const API_FIELDS = [
  'owners',
  'usageSummary',
  'tags',
  'domain',
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

describe('Tests for DatabaseSchemaPage', () => {
  it('DatabaseSchemaPage should fetch permissions', () => {
    render(<DatabaseSchemaPageComponent />);

    expect(mockEntityPermissionByFqn).toHaveBeenCalledWith(
      'databaseSchema',
      mockParams.fqn
    );
  });

  it('DatabaseSchemaPage should not fetch details if permission is there', () => {
    render(<DatabaseSchemaPageComponent />);

    expect(getDatabaseSchemaDetailsByFQN).not.toHaveBeenCalled();
    expect(getStoredProceduresList).not.toHaveBeenCalled();
  });

  it('DatabaseSchemaPage should render permission placeholder if not have required permission', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: false,
      })),
    }));

    await act(async () => {
      render(<DatabaseSchemaPageComponent />);
    });

    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('DatabaseSchemaPage should fetch details with basic fields', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      render(<DatabaseSchemaPageComponent />);
    });

    expect(getDatabaseSchemaDetailsByFQN).toHaveBeenCalledWith(mockParams.fqn, {
      fields: API_FIELDS.join(','),
      include: 'all',
    });
  });

  it('DatabaseSchemaPage should fetch storedProcedure with basic fields', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      render(<DatabaseSchemaPageComponent />);
    });

    expect(getStoredProceduresList).toHaveBeenCalledWith({
      databaseSchema: mockParams.fqn,
      limit: 0,
    });
  });

  it('DatabaseSchemaPage should render page for ViewBasic permissions', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      render(<DatabaseSchemaPageComponent />);
    });

    expect(getDatabaseSchemaDetailsByFQN).toHaveBeenCalledWith(mockParams.fqn, {
      fields: API_FIELDS.join(','),
      include: 'all',
    });

    expect(await screen.findByText('testDataAssetsHeader')).toBeInTheDocument();
    expect(await screen.findByTestId('tabs')).toBeInTheDocument();
    expect(await screen.findByText('testSchemaTablesTab')).toBeInTheDocument();
  });

  it('DatabaseSchemaPage should render tables by default', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      render(<DatabaseSchemaPageComponent />);
    });

    expect(getDatabaseSchemaDetailsByFQN).toHaveBeenCalledWith(mockParams.fqn, {
      fields: API_FIELDS.join(','),
      include: 'all',
    });

    expect(await screen.findByText('testSchemaTablesTab')).toBeInTheDocument();
  });

  it('should refetch data when decodedDatabaseSchemaFQN changes', async () => {
    const mockUseParams = jest.requireMock('react-router-dom').useParams;
    mockUseParams.mockReturnValue({
      fqn: 'sample_data.ecommerce_db.shopify',
      tab: 'table',
    });

    (usePermissionProvider as jest.Mock).mockImplementation(() => ({
      getEntityPermissionByFqn: jest.fn().mockResolvedValue({
        ViewBasic: true,
      }),
    }));

    const { rerender } = render(<DatabaseSchemaPageComponent />);

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
      expect(getFeedCounts).toHaveBeenCalledWith(
        'databaseSchema',
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
      expect(getFeedCounts).toHaveBeenCalledWith(
        'databaseSchema',
        'Glue.default.information_schema',
        expect.any(Function)
      );
    });
  });
});
