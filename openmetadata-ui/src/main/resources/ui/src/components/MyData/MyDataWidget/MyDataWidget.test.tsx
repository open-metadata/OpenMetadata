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
import { User } from '../../../generated/entity/teams/user';
import { searchData } from '../../../rest/miscAPI';
import { MyDataWidget } from './MyDataWidget.component';

const mockUserData: User = {
  name: 'testUser1',
  email: 'testUser1@email.com',
  id: '113',
};

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

jest.mock('../../../rest/miscAPI', () => ({
  searchData: jest.fn().mockImplementation(() =>
    Promise.resolve({
      owns: [],
    })
  ),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockImplementation((obj) => obj.name),
}));

jest.mock('../../../utils/SearchClassBase', () => ({
  getEntityIcon: jest.fn().mockImplementation((obj) => obj.name),
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

describe('MyDataWidget component', () => {
  it('should fetch data', async () => {
    await act(async () => {
      render(<MyDataWidget widgetKey="widgetKey" />, { wrapper: MemoryRouter });
    });

    expect(searchData).toHaveBeenCalledWith(
      '',
      1,
      10,
      '(owners.id:113)',
      '',
      '',
      'all'
    );
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

  it('should render view all for data present', async () => {
    (searchData as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockSearchAPIResponse)
    );
    await act(async () => {
      render(
        <MemoryRouter>
          <MyDataWidget widgetKey="widgetKey" />
        </MemoryRouter>
      );
    });

    expect(
      await screen.findByText('label.view-more-capital')
    ).toBeInTheDocument();
  });

  it('should render table names', async () => {
    (searchData as jest.Mock).mockResolvedValueOnce(mockSearchAPIResponse);
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
});
