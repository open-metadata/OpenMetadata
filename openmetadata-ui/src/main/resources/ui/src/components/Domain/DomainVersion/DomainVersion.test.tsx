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
import { MOCK_DOMAIN } from '../../../mocks/Domains.mock';
import DomainVersion from './DomainVersion.component';

/* eslint-disable max-len */
const MOCK_VERSIONS_LIST = {
  entityType: 'domain',
  versions: [
    '{"id":"353a1cf3-1608-4405-b2e9-58bfe52fa8d2","domainType":"Source-aligned","name":"Domain1","fullyQualifiedName":"Domain1","displayName":"Domain1","description":"Domain1","version":0.4,"updatedAt":1694584150825,"updatedBy":"admin","children":[],"owner":{"id":"118caaa4-e172-4602-a2bb-6a8956127175","type":"team","name":"Sales","fullyQualifiedName":"Sales","deleted":false},"experts":[{"id":"35fcf658-d2e3-4579-bb57-e6bb5b526b0a","type":"user","name":"aaron.singh2","fullyQualifiedName":"\\"aaron.singh2\\"","displayName":"Aaron Singh","deleted":false},{"id":"20a3e1ab-d557-4972-b9a4-10605c02e2cf","type":"user","name":"aaron_johnson0","fullyQualifiedName":"aaron_johnson0","displayName":"Aaron Johnson","deleted":false}],"changeDescription":{"fieldsAdded":[],"fieldsUpdated":[{"name":"domainType","oldValue":"Consumer-aligned","newValue":"Source-aligned"}],"fieldsDeleted":[],"previousVersion":0.3}}',
    '{"id": "353a1cf3-1608-4405-b2e9-58bfe52fa8d2", "name": "Domain1", "owner": {"id": "118caaa4-e172-4602-a2bb-6a8956127175", "name": "Sales", "type": "team", "deleted": false, "fullyQualifiedName": "Sales"}, "experts": [{"id": "35fcf658-d2e3-4579-bb57-e6bb5b526b0a", "name": "aaron.singh2", "type": "user", "deleted": false, "displayName": "Aaron Singh", "fullyQualifiedName": "\\"aaron.singh2\\""}, {"id": "20a3e1ab-d557-4972-b9a4-10605c02e2cf", "name": "aaron_johnson0", "type": "user", "deleted": false, "displayName": "Aaron Johnson", "fullyQualifiedName": "aaron_johnson0"}], "version": 0.3, "children": [], "updatedAt": 1694584129937, "updatedBy": "admin", "domainType": "Consumer-aligned", "description": "Domain1", "displayName": "Domain1", "changeDescription": {"fieldsAdded": [{"name": "experts", "newValue": "[{\\"id\\":\\"20a3e1ab-d557-4972-b9a4-10605c02e2cf\\",\\"type\\":\\"user\\",\\"name\\":\\"aaron_johnson0\\",\\"displayName\\":\\"Aaron Johnson\\"},{\\"id\\":\\"35fcf658-d2e3-4579-bb57-e6bb5b526b0a\\",\\"type\\":\\"user\\",\\"name\\":\\"aaron.singh2\\",\\"displayName\\":\\"Aaron Singh\\"}]"}], "fieldsDeleted": [], "fieldsUpdated": [], "previousVersion": 0.2}, "fullyQualifiedName": "Domain1"}',
    '{"id": "353a1cf3-1608-4405-b2e9-58bfe52fa8d2", "name": "Domain1", "owner": {"id": "118caaa4-e172-4602-a2bb-6a8956127175", "name": "Sales", "type": "team", "deleted": false, "fullyQualifiedName": "Sales"}, "experts": [], "version": 0.2, "children": [], "updatedAt": 1694584078766, "updatedBy": "admin", "domainType": "Consumer-aligned", "description": "Domain1", "displayName": "Domain1", "changeDescription": {"fieldsAdded": [{"name": "owner", "newValue": "{\\"id\\":\\"118caaa4-e172-4602-a2bb-6a8956127175\\",\\"type\\":\\"team\\",\\"name\\":\\"Sales\\",\\"fullyQualifiedName\\":\\"Sales\\",\\"deleted\\":false}"}], "fieldsDeleted": [], "fieldsUpdated": [], "previousVersion": 0.1}, "fullyQualifiedName": "Domain1"}',
    '{"id": "353a1cf3-1608-4405-b2e9-58bfe52fa8d2", "name": "Domain1", "experts": [], "version": 0.1, "children": [], "updatedAt": 1694584038601, "updatedBy": "admin", "domainType": "Consumer-aligned", "description": "Domain1", "displayName": "Domain1", "fullyQualifiedName": "Domain1"}',
  ],
};

const MOCK_VERSION = {
  id: '353a1cf3-1608-4405-b2e9-58bfe52fa8d2',
  domainType: 'Source-aligned',
  name: 'Domain1',
  fullyQualifiedName: 'Domain1',
  displayName: 'Domain1',
  description: 'Domain1',
  version: 0.4,
  updatedAt: 1694584150825,
  updatedBy: 'admin',
  children: [],
  owner: {
    id: '118caaa4-e172-4602-a2bb-6a8956127175',
    type: 'team',
    name: 'Sales',
    fullyQualifiedName: 'Sales',
    deleted: false,
  },
  experts: [
    {
      id: '35fcf658-d2e3-4579-bb57-e6bb5b526b0a',
      type: 'user',
      name: 'aaron.singh2',
      fullyQualifiedName: '"aaron.singh2"',
      displayName: 'Aaron Singh',
      deleted: false,
    },
    {
      id: '20a3e1ab-d557-4972-b9a4-10605c02e2cf',
      type: 'user',
      name: 'aaron_johnson0',
      fullyQualifiedName: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      deleted: false,
    },
  ],
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [
      {
        name: 'domainType',
        oldValue: 'Consumer-aligned',
        newValue: 'Source-aligned',
      },
    ],
    fieldsDeleted: [],
    previousVersion: 0.3,
  },
};

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockReturnValue({
    fqn: 'Domain1',
    version: 0.4,
  }),
}));

jest.mock('../../../rest/domainAPI', () => ({
  getDomainVersionsList: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_VERSIONS_LIST)),
  getDomainVersionData: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_VERSION)),
  getDomainByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_DOMAIN)),
}));

jest.mock(
  '../../../components/Domain/DomainDetailsPage/DomainDetailsPage.component',
  () => {
    return jest.fn().mockReturnValue(<>Domain component</>);
  }
);

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../Entity/EntityVersionTimeLine/EntityVersionTimeLine', () => {
  return jest.fn().mockReturnValue(<>Version timeline</>);
});

describe('DomainVersion', () => {
  it('renders domain version', async () => {
    await act(async () => {
      render(<DomainVersion />, { wrapper: MemoryRouter });
    });

    // Check that the version data is displayed
    expect(await screen.findByText('Domain component')).toBeInTheDocument();

    // Check that the version timeline is displayed
    expect(screen.getByText('Version timeline')).toBeInTheDocument();
  });
});
