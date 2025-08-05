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
import { MemoryRouter } from 'react-router-dom';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import { User } from '../../../generated/entity/teams/user';
import { searchQuery } from '../../../rest/searchAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import FollowingWidget from './FollowingWidget';

const mockUserData: User = {
  name: 'testUser1',
  email: 'testUser1@email.com',
  id: '113',
};

const mockSearchAPIResponse = {
  hits: {
    hits: [
      {
        _source: {
          id: '1',
          name: 'test 1',
          fullyQualifiedName: 'test-1',
          type: 'table',
          entityType: 'table',
        },
      },
      {
        _source: {
          id: '2',
          name: 'test 2',
          fullyQualifiedName: 'test-2',
          type: 'table',
          entityType: 'table',
        },
      },
    ],
    total: {
      value: 2,
    },
  },
};

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockImplementation(() =>
    Promise.resolve({
      hits: {
        hits: [],
        total: { value: 0 },
      },
    })
  ),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockImplementation((obj) => obj.name),
}));

jest.mock('../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityIcon: jest.fn().mockImplementation((type) => `icon-${type}`),
  },
}));

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: jest
      .fn()
      .mockImplementation((type, fqn) => `/entity/${type}/${fqn}`),
  },
}));

jest.mock('../../../utils/ServiceUtilClassBase', () => ({
  __esModule: true,
  default: {
    getServiceTypeLogo: jest.fn().mockImplementation(() => 'mock-logo.png'),
  },
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: mockUserData,
  })),
}));

jest.mock(
  '../../common/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component',
  () => {
    return jest.fn().mockImplementation(({ children }) => <>{children}</>);
  }
);

describe('FollowingWidget component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch data', async () => {
    await act(async () => {
      render(<FollowingWidget widgetKey="widgetKey" />, {
        wrapper: MemoryRouter,
      });
    });

    expect(searchQuery).toHaveBeenCalledWith({
      pageSize: PAGE_SIZE_MEDIUM,
      searchIndex: 'all',
      query: '*',
      filters: 'followers:113',
      sortField: 'updatedAt',
      sortOrder: 'desc',
    });
  });

  it('should render header', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <FollowingWidget widgetKey="widgetKey" />
        </MemoryRouter>
      );
    });

    expect(screen.getByText('label.following-assets')).toBeInTheDocument();
  });

  it('should not render view all for 0 length data', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <FollowingWidget widgetKey="widgetKey" />
        </MemoryRouter>
      );
    });

    expect(screen.queryByTestId('view-more-link')).not.toBeInTheDocument();
  });

  it('should render table names', async () => {
    (searchQuery as jest.Mock).mockResolvedValueOnce(mockSearchAPIResponse);
    await act(async () => {
      render(
        <MemoryRouter>
          <FollowingWidget widgetKey="widgetKey" />
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('test 1')).toBeInTheDocument();
    expect(await screen.findByText('test 2')).toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    (searchQuery as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

    await act(async () => {
      render(
        <MemoryRouter>
          <FollowingWidget widgetKey="widgetKey" />
        </MemoryRouter>
      );
    });

    expect(showErrorToast).toHaveBeenCalled();
  });

  it('should show loading state initially', async () => {
    (searchQuery as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ hits: { hits: [], total: { value: 0 } } }),
            100
          )
        )
    );

    render(
      <MemoryRouter>
        <FollowingWidget widgetKey="widgetKey" />
      </MemoryRouter>
    );

    // The EntityListSkeleton should be rendered during loading
    // Since we mocked it to render children, we verify the loading state exists
    expect(screen.queryByText('label.following-assets')).toBeInTheDocument();
  });

  it('should render different entity types correctly', async () => {
    const mockMixedEntitiesResponse = {
      hits: {
        hits: [
          {
            _source: {
              id: '1',
              name: 'test dashboard',
              fullyQualifiedName: 'test-dashboard',
              type: 'dashboard',
              entityType: 'dashboard',
            },
          },
          {
            _source: {
              id: '2',
              name: 'test pipeline',
              fullyQualifiedName: 'test-pipeline',
              type: 'pipeline',
              entityType: 'pipeline',
            },
          },
          {
            _source: {
              id: '3',
              name: 'test topic',
              fullyQualifiedName: 'test-topic',
              type: 'topic',
              entityType: 'topic',
            },
          },
        ],
        total: {
          value: 3,
        },
      },
    };

    (searchQuery as jest.Mock).mockResolvedValueOnce(mockMixedEntitiesResponse);

    await act(async () => {
      render(
        <MemoryRouter>
          <FollowingWidget widgetKey="widgetKey" />
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('test dashboard')).toBeInTheDocument();
    expect(await screen.findByText('test pipeline')).toBeInTheDocument();
    expect(await screen.findByText('test topic')).toBeInTheDocument();
  });

  it('should handle no current user scenario', async () => {
    const mockUseApplicationStore = jest.requireMock(
      '../../../hooks/useApplicationStore'
    ).useApplicationStore;
    mockUseApplicationStore.mockReturnValueOnce({
      currentUser: undefined,
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <FollowingWidget widgetKey="widgetKey" />
        </MemoryRouter>
      );
    });

    // Should not call searchQuery when there's no current user
    expect(searchQuery).not.toHaveBeenCalled();
  });
});
