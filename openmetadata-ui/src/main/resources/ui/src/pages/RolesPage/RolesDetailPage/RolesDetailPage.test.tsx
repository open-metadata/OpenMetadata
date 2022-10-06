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

import { render, screen } from '@testing-library/react';
import { ColumnsType } from 'antd/lib/table';
import React from 'react';
import { getRoleByName } from '../../../axiosAPIs/rolesAPIV1';
import { Column } from '../../../generated/api/data/createTable';
import { Role } from '../../../generated/entity/teams/role';
import { ROLE_DATA } from '../Roles.mock';
import RolesDetailPage from './RolesDetailPage';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockReturnValue({
    push: jest.fn(),
  }),
  useParams: jest.fn().mockReturnValue({ fqn: 'data-consumer' }),
  Link: jest.fn().mockImplementation(({ to }) => <a href={to}>link</a>),
}));

jest.mock('../../../axiosAPIs/rolesAPIV1', () => ({
  getRoleByName: jest.fn().mockImplementation(() => Promise.resolve(ROLE_DATA)),
  patchRole: jest.fn().mockImplementation(() => Promise.resolve(ROLE_DATA)),
}));

jest.mock('../../../components/common/description/Description', () =>
  jest.fn().mockReturnValue(<div data-testid="description">Description</div>)
);

jest.mock(
  '../../../components/common/rich-text-editor/RichTextEditorPreviewer',
  () => jest.fn().mockReturnValue(<div data-testid="previewer">Previewer</div>)
);

jest.mock(
  '../../../components/common/title-breadcrumb/title-breadcrumb.component',
  () =>
    jest.fn().mockReturnValue(<div data-testid="breadcrumb">Breadcrumb</div>)
);

jest.mock('../../../components/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>)
);

jest.mock('../../../constants/constants', () => ({
  getUserPath: jest.fn(),
}));

jest.mock('../../../utils/CommonUtils', () => ({
  getEntityName: jest.fn(),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getPolicyWithFqnPath: jest.fn(),
  getSettingPath: jest.fn(),
  getTeamsWithFqnPath: jest.fn(),
}));

jest.mock('../../../components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest.fn().mockReturnValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    }),
  }),
}));

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Table: jest.fn().mockImplementation(({ columns, dataSource }) => (
    <table data-testid="list-table">
      <thead>
        <tr>
          {(columns as ColumnsType<Role>).map((col) => (
            <th key={col.key}>{col.title}</th>
          ))}
        </tr>
      </thead>
      <tbody key="tbody">
        {dataSource.map((row: Column, i: number) => (
          <tr key={i}>
            {(columns as ColumnsType<Role>).map((col, index) => (
              <td key={col.key}>
                {col.render ? col.render(row, dataSource, index) : 'alt'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )),
}));

describe('Test Roles Details Page', () => {
  it('Should render the detail component', async () => {
    render(<RolesDetailPage />);

    const container = await screen.findByTestId('role-details-container');

    const description = await screen.findByTestId('description');
    const breadCrumb = await screen.findByTestId('breadcrumb');

    const tabs = await screen.findByTestId('tabs');

    const policiesTab = await screen.findByText('Policies');
    const teamsTab = await screen.findByText('Teams');
    const usersTab = await screen.findByText('Users');

    expect(container).toBeInTheDocument();

    expect(description).toBeInTheDocument();
    expect(breadCrumb).toBeInTheDocument();

    expect(tabs).toBeInTheDocument();

    expect(policiesTab).toBeInTheDocument();
    expect(teamsTab).toBeInTheDocument();
    expect(usersTab).toBeInTheDocument();
  });

  it('Should render the no-data component in there is no-data', async () => {
    (getRoleByName as jest.Mock).mockImplementation(() => Promise.reject());
    render(<RolesDetailPage />);

    const container = await screen.findByTestId('role-details-container');

    const noData = await screen.findByTestId('no-data');

    expect(container).toBeInTheDocument();

    expect(noData).toBeInTheDocument();
  });
});
