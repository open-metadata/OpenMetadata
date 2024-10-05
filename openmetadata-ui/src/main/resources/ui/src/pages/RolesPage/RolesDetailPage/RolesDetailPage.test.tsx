/*
 *  Copyright 2022 Collate.
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
import React from 'react';
import { getRoleByName } from '../../../rest/rolesAPIV1';
import { ROLE_DATA } from '../Roles.mock';
import RolesDetailPage from './RolesDetailPage';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockReturnValue({
    push: jest.fn(),
  }),
  useParams: jest.fn().mockReturnValue({ fqn: 'data-consumer' }),
  Link: jest.fn().mockImplementation(({ to }) => <a href={to}>link</a>),
}));

jest.mock('../../../rest/rolesAPIV1', () => ({
  getRoleByName: jest.fn().mockImplementation(() => Promise.resolve(ROLE_DATA)),
  patchRole: jest.fn().mockImplementation(() => Promise.resolve(ROLE_DATA)),
}));

jest.mock('../../../components/common/EntityDescription/DescriptionV1', () =>
  jest.fn().mockReturnValue(<div data-testid="description">Description</div>)
);

jest.mock(
  '../../../components/common/RichTextEditor/RichTextEditorPreviewer',
  () => jest.fn().mockReturnValue(<div data-testid="previewer">Previewer</div>)
);

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () =>
    jest.fn().mockReturnValue(<div data-testid="breadcrumb">Breadcrumb</div>)
);

jest.mock('../../../components/common/Loader/Loader', () =>
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

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

describe('Test Roles Details Page', () => {
  it('Should render the detail component', async () => {
    render(<RolesDetailPage />);

    const container = await screen.findByTestId('role-details-container');

    const description = await screen.findByTestId('description');
    const breadCrumb = await screen.findByTestId('breadcrumb');

    const tabs = await screen.findByTestId('tabs');

    const policiesTab = await screen.findByText('label.policy-plural');
    const teamsTab = await screen.findByText('label.team-plural');
    const usersTab = await screen.findByText('label.user-plural');

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

    const noData = await screen.findByTestId('no-data-placeholder');

    expect(container).toBeInTheDocument();

    expect(noData).toBeInTheDocument();
  });
});
