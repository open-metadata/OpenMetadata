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
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { getSearchIndexDetailsByFQN } from '../../rest/SearchIndexAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import SearchIndexDetailsPage from './SearchIndexDetailsPage';

const mockEntityPermissionByFqn = jest
  .fn()
  .mockImplementation(() => DEFAULT_ENTITY_PERMISSION);

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: mockEntityPermissionByFqn,
  })),
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

jest.mock('../../components/common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockImplementation(() => <p>testDescriptionV1</p>);
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

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <p>{children}</p>);
});

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
  useParams: jest
    .fn()
    .mockImplementation(() => ({ fqn: 'fqn', tab: 'fields' })),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <>testLoader</>);
});

jest.mock('./SearchIndexFieldsTab/SearchIndexFieldsTab', () => {
  return jest.fn().mockImplementation(() => <p>testSearchIndexFieldsTab</p>);
});

jest.mock('../../hoc/LimitWrapper', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

describe('SearchIndexDetailsPage component', () => {
  it('SearchIndexDetailsPage should fetch permissions', () => {
    render(<SearchIndexDetailsPage />);

    expect(mockEntityPermissionByFqn).toHaveBeenCalledWith(
      'searchIndex',
      'fqn'
    );
  });

  it('SearchIndexDetailsPage should not fetch search index details if permission is there', () => {
    render(<SearchIndexDetailsPage />);

    expect(getSearchIndexDetailsByFQN).not.toHaveBeenCalled();
  });

  it('SearchIndexDetailsPage should fetch search index details with basic fields', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      render(<SearchIndexDetailsPage />);
    });

    expect(getSearchIndexDetailsByFQN).toHaveBeenCalledWith('fqn', {
      fields:
        'fields,followers,tags,owners,domains,votes,dataProducts,extension',
    });
  });

  it('SearchIndexDetailsPage should render page for ViewBasic permissions', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      render(<SearchIndexDetailsPage />);
    });

    expect(getSearchIndexDetailsByFQN).toHaveBeenCalledWith('fqn', {
      fields:
        'fields,followers,tags,owners,domains,votes,dataProducts,extension',
    });

    expect(await screen.findByText('testDataAssetsHeader')).toBeInTheDocument();
    expect(await screen.findByText('label.field-plural')).toBeInTheDocument();
    expect(
      await screen.findByText('label.activity-feed-and-task-plural')
    ).toBeInTheDocument();
    expect(await screen.findByText('label.sample-data')).toBeInTheDocument();
    expect(
      await screen.findByText('label.search-index-setting-plural')
    ).toBeInTheDocument();

    expect(
      await screen.findByText('label.custom-property-plural')
    ).toBeInTheDocument();
  });

  it('SearchIndexDetailsPage should render SearchIndexFieldsTab by default', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementationOnce(() => ({
        ViewBasic: true,
      })),
    }));

    await act(async () => {
      render(<SearchIndexDetailsPage />);
    });

    expect(getSearchIndexDetailsByFQN).toHaveBeenCalledWith('fqn', {
      fields:
        'fields,followers,tags,owners,domains,votes,dataProducts,extension',
    });

    expect(
      await screen.findByText('testSearchIndexFieldsTab')
    ).toBeInTheDocument();
  });
});
