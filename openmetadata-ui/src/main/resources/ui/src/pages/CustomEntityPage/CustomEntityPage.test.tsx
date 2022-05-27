/*
 *  Copyright 2021 Collate
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

import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getTypeListByCategory } from '../../axiosAPIs/metadataTypeAPI';
import CustomEntityPage from './CustomEntityPage';

const mockData = {
  id: '32f81349-d7d7-4a6a-8fc7-d767f233b674',
  name: 'table',
  fullyQualifiedName: 'table',
  displayName: 'table',
  description:
    // eslint-disable-next-line max-len
    '"This schema defines the Table entity. A Table organizes data in rows and columns and is defined by a Schema. OpenMetadata does not have a separate abstraction for Schema. Both Table and Schema are captured in this entity."',
  category: 'entity',
  nameSpace: 'data',
  schema: '',
  version: 0.1,
  updatedAt: 1653626359971,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/metadata/types/32f81349-d7d7-4a6a-8fc7-d767f233b674',
};

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    entityTypeFQN: 'table',
  }),
}));

jest.mock('../../axiosAPIs/metadataTypeAPI', () => ({
  getTypeListByCategory: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: { data: [mockData] } })),
}));

jest.mock('../../components/CustomEntityDetail/CustomEntityDetail', () => {
  return jest
    .fn()
    .mockReturnValue(
      <div data-testid="CustomEntityDetail">CustomEntityDetail</div>
    );
});

jest.mock('../../components/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>)
);

const mockGetTypeListByCategory = getTypeListByCategory as jest.Mock;

describe('Test CustomEntity Page Component', () => {
  it('Should render Custom Entity Detail Component', async () => {
    const { findByTestId } = render(<CustomEntityPage />, {
      wrapper: MemoryRouter,
    });

    const detailComponent = await findByTestId('CustomEntityDetail');

    expect(detailComponent).toBeInTheDocument();
  });

  it('Should render error Component if API fails', async () => {
    mockGetTypeListByCategory.mockImplementationOnce(() => Promise.reject());

    const { findByTestId } = render(<CustomEntityPage />, {
      wrapper: MemoryRouter,
    });

    const errorComponent = await findByTestId('error');

    expect(errorComponent).toBeInTheDocument();
  });
});
