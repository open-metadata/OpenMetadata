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
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ReactNode } from 'react';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs } from '../../enums/entity.enum';
import { Include } from '../../generated/type/include';
import {
  addContainerFollower,
  getContainerByName,
} from '../../rest/storageAPI';
import ContainerPage from './ContainerPage';
import {
  MOCK_CONTAINER_DATA,
  MOCK_CONTAINER_DATA_1,
} from './ContainerPage.mock';

const mockGetEntityPermissionByFqn = jest.fn().mockResolvedValue({
  ViewBasic: true,
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

jest.mock('../../components/common/EntityDescription/DescriptionV1', () =>
  jest
    .fn()
    .mockImplementation(({ onThreadLinkSelect }) => (
      <button onClick={onThreadLinkSelect}>DescriptionV1</button>
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

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <>{children}</>)
);

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
  })),
}));

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () =>
  jest.fn().mockImplementation(({ name }) => <div>{name}</div>)
);

jest.mock('../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest.fn().mockReturnValue('/container-detail-path'),
  getVersionPath: jest.fn().mockReturnValue('/version-path'),
}));

jest.mock('../../rest/feedsAPI', () => ({
  postThread: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../rest/storageAPI');

jest.mock('../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getEntityMissingError: jest.fn().mockImplementation(() => <div>Error</div>),
  getFeedCounts: jest.fn().mockReturnValue(0),
  sortTagsCaseInsensitive: jest.fn().mockImplementation((tags) => tags),
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

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.name ?? 'entityName'),
  getEntityFeedLink: jest.fn(),
  getColumnSorter: jest.fn(),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  DEFAULT_ENTITY_PERMISSION: {},
  getPrioritizedEditPermission: jest.fn().mockReturnValue(true),
  getPrioritizedViewPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../utils/StringsUtils', () => ({
  getDecodedFqn: jest.fn().mockImplementation((fqn) => fqn),
}));

jest.mock('../../utils/TableUtils', () => ({
  getTagsWithoutTier: jest.fn().mockReturnValue([]),
  getTierTags: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/TagsUtils', () => ({
  createTagObject: jest.fn().mockImplementation((tagObject) => tagObject),
  updateTierTag: jest.fn().mockImplementation((tagObject) => tagObject),
  getTagPlaceholder: jest.fn().mockReturnValue(''),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockUseParams = jest.fn().mockReturnValue({
  fqn: MOCK_CONTAINER_DATA.fullyQualifiedName,
  tab: 'schema',
});

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
    replace: mockReplace,
  })),
  useParams: jest.fn().mockImplementation(() => mockUseParams()),
}));

jest.mock('../../hoc/LimitWrapper', () => {
  return jest.fn().mockImplementation(({ children }) => <>{children}</>);
});

describe('Container Page Component', () => {
  beforeEach(() => {
    const { getPrioritizedEditPermission, getPrioritizedViewPermission } =
      jest.requireMock('../../utils/PermissionsUtils');
    getPrioritizedEditPermission.mockReturnValue(true);
    getPrioritizedViewPermission.mockReturnValue(true);
  });

  it('should show error-placeholder, if not have view permission', async () => {
    mockGetEntityPermissionByFqn.mockResolvedValueOnce({
      ViewBasic: false,
    });

    const { getPrioritizedViewPermission } = jest.requireMock(
      '../../utils/PermissionsUtils'
    );
    getPrioritizedViewPermission.mockReturnValue(false);

    await act(async () => {
      render(<ContainerPage />);

      expect(screen.getByText('Loader')).toBeVisible();
    });

    expect(mockGetEntityPermissionByFqn).toHaveBeenCalled();

    expect(getContainerByName).not.toHaveBeenCalled();

    expect(
      screen.getByText(ERROR_PLACEHOLDER_TYPE.PERMISSION)
    ).toBeInTheDocument();
  });

  it('fetch container data, if have view permission', async () => {
    await act(async () => {
      render(<ContainerPage />);

      expect(screen.getByText('Loader')).toBeVisible();
    });

    expect(mockGetEntityPermissionByFqn).toHaveBeenCalled();
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
          'domain',
          'dataProducts',
          'votes',
        ],
        include: Include.All,
      }
    );
  });

  it('show ErrorPlaceHolder if container data fetch fail', async () => {
    (getContainerByName as jest.Mock).mockRejectedValueOnce(
      'failed to fetch container data'
    );

    await act(async () => {
      render(<ContainerPage />);

      expect(screen.getByText('Loader')).toBeVisible();
    });

    expect(mockGetEntityPermissionByFqn).toHaveBeenCalled();
    expect(getContainerByName).toHaveBeenCalled();

    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('should render the page container data, with the schema tab selected', async () => {
    (getContainerByName as jest.Mock).mockResolvedValueOnce(
      MOCK_CONTAINER_DATA
    );
    await act(async () => {
      render(<ContainerPage />);

      expect(screen.getByText('Loader')).toBeVisible();
    });

    expect(mockGetEntityPermissionByFqn).toHaveBeenCalled();
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
          'domain',
          'dataProducts',
          'votes',
        ],
        include: 'all',
      }
    );

    expect(screen.getByTestId('data-asset-header')).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');

    expect(tabs).toHaveLength(5);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('DescriptionV1')).toBeVisible();
    expect(screen.getByText('ContainerDataModel')).toBeVisible();
    expect(screen.getByText('CustomPropertyTable')).toBeVisible();
    expect(screen.getByText('label.glossary-term')).toBeVisible();
    expect(screen.getByText('label.tag-plural')).toBeVisible();
    expect(screen.getByText('label.data-product-plural')).toBeVisible();
  });

  it('onClick of follow container should call addContainerFollower', async () => {
    (getContainerByName as jest.Mock).mockResolvedValueOnce(
      MOCK_CONTAINER_DATA
    );
    await act(async () => {
      render(<ContainerPage />);

      expect(screen.getByText('Loader')).toBeVisible();
    });

    const followButton = screen.getByRole('button', {
      name: 'Follow Container',
    });

    userEvent.click(followButton);

    expect(addContainerFollower).toHaveBeenCalled();
  });

  it('tab switch should work', async () => {
    (getContainerByName as jest.Mock).mockResolvedValueOnce(
      MOCK_CONTAINER_DATA
    );
    await act(async () => {
      render(<ContainerPage />);

      expect(screen.getByText('Loader')).toBeVisible();
    });

    const childrenTab = screen.getByRole('tab', {
      name: 'label.children',
    });

    userEvent.click(childrenTab);

    expect(mockReplace).toHaveBeenCalled();
  });

  it('children should render on children tab', async () => {
    (getContainerByName as jest.Mock).mockResolvedValueOnce(
      MOCK_CONTAINER_DATA_1
    );
    mockUseParams.mockReturnValue({
      fqn: MOCK_CONTAINER_DATA_1.fullyQualifiedName,
      tab: EntityTabs.CHILDREN,
    });

    await act(async () => {
      render(<ContainerPage />);

      expect(screen.getByText('Loader')).toBeVisible();
    });

    const childrenTab = screen.getByRole('tab', { name: 'label.children' });

    expect(childrenTab).toHaveAttribute('aria-selected', 'true');

    expect(screen.getByText('ContainerChildren')).toBeVisible();

    expect(getContainerByName).toHaveBeenCalledWith(
      MOCK_CONTAINER_DATA_1.fullyQualifiedName,
      {
        fields: 'children',
      }
    );
  });
});
