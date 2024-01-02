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
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import DomainExperts from './DomainExperts.component';

const MOCK_DATA_PRODUCT: DataProduct = {
  id: '601fdef5-47c5-4efc-b1a5-44989f0cc150',
  name: 'DataProduct1',
  fullyQualifiedName: 'Domain1.DataProduct1',
  displayName: 'Banking Data Product 1234',
  description: 'DataProduct1',
  version: 0.7,
  updatedAt: 1694601122681,
  updatedBy: 'admin',
  domain: {
    id: '353a1cf3-1608-4405-b2e9-58bfe52fa8d2',
    type: 'domain',
    name: 'Domain1',
    fullyQualifiedName: 'Domain1',
    description: 'Domain1',
    displayName: 'Domain1',
    href: 'http://localhost:8585/api/v1/domains/353a1cf3-1608-4405-b2e9-58bfe52fa8d2',
  },
  href: 'http://localhost:8585/api/v1/dataProducts/601fdef5-47c5-4efc-b1a5-44989f0cc150',
  owner: {
    id: '35fcf658-d2e3-4579-bb57-e6bb5b526b0a',
    type: 'user',
    name: 'aaron.singh2',
    fullyQualifiedName: '"aaron.singh2"',
    displayName: 'Aaron Singh',
    deleted: false,
    href: 'http://localhost:8585/api/v1/users/35fcf658-d2e3-4579-bb57-e6bb5b526b0a',
  },
  experts: [
    {
      id: '35fcf658-d2e3-4579-bb57-e6bb5b526b0a',
      type: 'user',
      name: 'aaron.singh2',
      fullyQualifiedName: '"aaron.singh2"',
      displayName: 'Aaron Singh',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/35fcf658-d2e3-4579-bb57-e6bb5b526b0a',
    },
    {
      id: 'be3adb15-e5e9-460a-8163-dc22bbc3c2a6',
      type: 'user',
      name: 'aaron.warren5',
      fullyQualifiedName: '"aaron.warren5"',
      displayName: 'Aaron Warren',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/be3adb15-e5e9-460a-8163-dc22bbc3c2a6',
    },
    {
      id: '20a3e1ab-d557-4972-b9a4-10605c02e2cf',
      type: 'user',
      name: 'aaron_johnson0',
      fullyQualifiedName: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/20a3e1ab-d557-4972-b9a4-10605c02e2cf',
    },
  ],
  changeDescription: {
    fieldsAdded: [
      {
        name: 'experts',
        newValue:
          '[{"id":"35fcf658-d2e3-4579-bb57-e6bb5b526b0a","type":"user","name":"aaron.singh2","displayName":"Aaron Singh"}]',
      },
    ],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 0.6,
  },
};

jest.mock('../../../components/common/ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockImplementation(() => <>testProfilePicture</>);
});

describe('DomainExperts', () => {
  it('renders experts in normal view', async () => {
    const entity = MOCK_DATA_PRODUCT;
    const { getByText } = render(
      <DomainExperts editPermission entity={entity} isVersionsView={false} />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(getByText('Aaron Johnson')).toBeInTheDocument();
    expect(getByText('Aaron Warren')).toBeInTheDocument();
  });

  it('renders experts in versions view', async () => {
    const updatedEntity = {
      ...MOCK_DATA_PRODUCT,
      changeDescription: {
        fieldsAdded: [
          {
            name: 'experts',
            newValue:
              '[{"id":"35fcf658-d2e3-4579-bb57-e6bb5b526b0a","type":"user","name":"aaron.singh2","displayName":"Aaron Singh"}]',
          },
        ],
        fieldsUpdated: [],
        fieldsDeleted: [],
        previousVersion: 0.6,
      },
    };

    const { getByText } = render(
      <DomainExperts editPermission isVersionsView entity={updatedEntity} />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(getByText('Aaron Johnson')).toBeInTheDocument();
    expect(getByText('Aaron Warren')).toBeInTheDocument();
    expect(getByText('Aaron Singh')).toBeInTheDocument();
  });
});
