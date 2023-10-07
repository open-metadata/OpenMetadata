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
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getUserById } from '../../../rest/userAPI';
import { MyDataWidget } from './MyDataWidget.component';

const userDetails = {
  id: '123',
};

jest.mock('../../../rest/userAPI', () => ({
  getUserById: jest.fn().mockImplementation(() =>
    Promise.resolve({
      owns: [],
    })
  ),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockImplementation((obj) => obj.name),
}));

jest.mock('../../../utils/TableUtils', () => ({
  getEntityLink: jest.fn().mockImplementation((link) => link),
  getEntityIcon: jest.fn().mockImplementation((obj) => obj.name),
}));

jest.mock('./../../../AppState', () => ({
  getCurrentUserDetails: jest.fn().mockImplementation(() => {
    return userDetails;
  }),
}));

jest.mock(
  '../../../components/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component',
  () => {
    return jest.fn().mockImplementation(({ children }) => <>{children}</>);
  }
);

describe('MyDataWidget component', () => {
  it('should fetch data', () => {
    act(() => {
      render(<MyDataWidget />, { wrapper: MemoryRouter });
    });

    expect(getUserById).toHaveBeenCalledWith('123', 'owns');
  });

  it.skip('should render header', () => {
    act(() => {
      render(
        <MemoryRouter>
          <MyDataWidget />
        </MemoryRouter>
      );
    });

    expect(screen.getByText('label.my-data')).toBeInTheDocument();
  });

  it('should not render view all for 0 length data', () => {
    act(() => {
      render(
        <MemoryRouter>
          <MyDataWidget />
        </MemoryRouter>
      );
    });

    expect(screen.queryByTestId('view-all-link')).not.toBeInTheDocument();
  });

  it('should render view all for data present', async () => {
    (getUserById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        owns: [
          {
            id: '1',
            name: 'test 1',
            fullyQualifiedName: 'test-1',
            type: 'table',
          },
          {
            id: '2',
            name: 'test 2',
            fullyQualifiedName: 'test-2',
            type: 'table',
          },
        ],
      })
    );
    act(() => {
      render(
        <MemoryRouter>
          <MyDataWidget />
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('label.view-all')).toBeInTheDocument();
  });

  it('should render table names', async () => {
    (getUserById as jest.Mock).mockResolvedValueOnce({
      owns: [
        {
          id: '1',
          name: 'test 1',
          fullyQualifiedName: 'test-1',
          type: 'table',
        },
        {
          id: '2',
          name: 'test 2',
          fullyQualifiedName: 'test-2',
          type: 'table',
        },
      ],
    });
    act(() => {
      render(
        <MemoryRouter>
          <MyDataWidget />
        </MemoryRouter>
      );
    });

    expect(await screen.findByText('test 1')).toBeInTheDocument();
    expect(await screen.findByText('test 2')).toBeInTheDocument();
  });
});
