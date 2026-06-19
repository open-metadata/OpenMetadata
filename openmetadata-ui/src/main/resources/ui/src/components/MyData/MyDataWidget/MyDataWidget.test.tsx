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
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { applySortToData } from '../../../constants/Widgets.constant';
import { SearchIndex } from '../../../enums/search.enum';
import { User } from '../../../generated/entity/teams/user';
import { searchQuery } from '../../../rest/searchAPI';
import { MyDataWidget } from './MyDataWidget.component';

const mockUserData: User = {
  name: 'testUser1',
  email: 'testUser1@email.com',
  id: '113',
};
let mockCurrentUser: User | undefined = mockUserData;

const mockSearchAPIResponse = {
  data: {
    hits: {
      hits: [
        {
          _source: {
            id: '1',
            name: 'test 1',
            fullyQualifiedName: 'test-1',
            type: 'table',
          },
        },
        {
          _source: {
            id: '2',
            name: 'test 2',
            fullyQualifiedName: 'test-2',
            type: 'table',
          },
        },
      ],
      total: {
        value: 2,
      },
    },
  },
};

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockImplementation(() =>
    Promise.resolve({
      hits: {
        hits: [],
        total: {
          value: 0,
        },
      },
    })
  ),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockImplementation((obj) => obj.name),
}));

jest.mock('../../../utils/EntityLinkUtils', () => ({
  getEntityLinkFromType: jest.fn().mockReturnValue('/entity/test'),
}));

jest.mock('../../../utils/SearchClassBase', () => ({
  getEntityIcon: jest.fn().mockImplementation((obj) => obj.name),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getDomainPath: jest.fn().mockReturnValue('/domain/test'),
  getUserPath: jest.fn().mockReturnValue('/user/test'),
}));

jest.mock('../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockImplementation(() => <span>OwnerLabel</span>),
}));

jest.mock('../../../constants/Widgets.constant', () => ({
  getSortField: jest.fn().mockReturnValue('updatedAt'),
  getSortOrder: jest.fn().mockReturnValue('desc'),
  applySortToData: jest.fn().mockImplementation((data) => data),
  MY_DATA_WIDGET_FILTER_OPTIONS: [],
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: mockCurrentUser,
  })),
}));

jest.mock(
  '../../common/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component',
  () => {
    return jest.fn().mockImplementation(({ children, loading }) => (
      <div data-loading={loading} data-testid="entity-list-skeleton">
        {children}
      </div>
    ));
  }
);

describe('MyDataWidget component', () => {
  beforeEach(() => {
    mockCurrentUser = mockUserData;
    jest.clearAllMocks();
  });

  it('should fetch data', async () => {
    await act(async () => {
      render(<MyDataWidget widgetKey="widgetKey" />, { wrapper: MemoryRouter });
    });

    expect(searchQuery).toHaveBeenCalledWith({
      query: '',
      pageNumber: INITIAL_PAGING_VALUE,
      pageSize: PAGE_SIZE_MEDIUM,
      queryFilter: {
        query: {
          bool: {
            should: [
              {
                nested: {
                  path: 'owners',
                  query: { term: { 'owners.id': '113' } },
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
      },
      sortField: 'updatedAt',
      sortOrder: 'desc',
      searchIndex: SearchIndex.ALL,
    });
  });

  it('should render header', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <MyDataWidget widgetKey="widgetKey" />
        </MemoryRouter>
      );
    });

    expect(screen.getByText('label.my-data')).toBeInTheDocument();
  });

  it('should not fetch data or stay loading when current user is unavailable', async () => {
    mockCurrentUser = undefined;

    await act(async () => {
      render(
        <MemoryRouter>
          <MyDataWidget widgetKey="widgetKey" />
        </MemoryRouter>
      );
    });

    expect(searchQuery).not.toHaveBeenCalled();
    expect(screen.getByTestId('entity-list-skeleton')).toHaveAttribute(
      'data-loading',
      'false'
    );
    expect(screen.getByText('label.no-records')).toBeInTheDocument();
  });

  it('should not render view all for 0 length data', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <MyDataWidget widgetKey="widgetKey" />
        </MemoryRouter>
      );
    });

    expect(screen.queryByTestId('view-more-link')).not.toBeInTheDocument();
  });

  it('should render table names', async () => {
    (searchQuery as jest.Mock).mockResolvedValueOnce(
      mockSearchAPIResponse.data
    );
    await act(async () => {
      render(
        <MemoryRouter>
          <MyDataWidget widgetKey="widgetKey" />
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('test 1')).toBeInTheDocument();
    expect(await screen.findByText('test 2')).toBeInTheDocument();
  });

  it('should treat missing search hits as an empty result set', async () => {
    (searchQuery as jest.Mock).mockResolvedValueOnce({});

    await act(async () => {
      render(
        <MemoryRouter>
          <MyDataWidget widgetKey="widgetKey" />
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(applySortToData).toHaveBeenCalledWith([], expect.any(String));
    });
    expect(screen.getByTestId('entity-list-skeleton')).toHaveAttribute(
      'data-loading',
      'false'
    );
    expect(screen.getByText('label.no-records')).toBeInTheDocument();
  });
});
