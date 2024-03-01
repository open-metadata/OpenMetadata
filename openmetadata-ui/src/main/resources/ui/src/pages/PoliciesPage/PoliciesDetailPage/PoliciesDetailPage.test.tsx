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
import { POLICY_DATA } from '../PoliciesData.mock';
import PoliciesDetailPage from './PoliciesDetailPage';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockReturnValue({ fqn: 'policy' }),
}));

jest.mock('../../../rest/rolesAPIV1', () => ({
  getPolicyByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(POLICY_DATA)),
  getRoleByName: jest.fn().mockImplementation(() => Promise.resolve()),
  patchPolicy: jest.fn().mockImplementation(() => Promise.resolve()),
  patchRole: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../rest/teamsAPI', () => ({
  getTeamByName: jest.fn().mockImplementation(() => Promise.resolve()),
  patchTeamDetail: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../components/common/EntityDescription/DescriptionV1', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="description-data">Description</div>)
);

jest.mock(
  '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => jest.fn().mockReturnValue(<div>ErrorPlaceholder</div>)
);

jest.mock(
  '../../../components/common/RichTextEditor/RichTextEditorPreviewer',
  () => jest.fn().mockReturnValue(<div data-testid="previewer">Previewer</div>)
);

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () =>
    jest.fn().mockReturnValue(<div data-testid="breadcrumb">BreadCrumb</div>)
);

jest.mock('../../../components/common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

jest.mock('../../../constants/HelperTextUtil', () => ({
  NO_PERMISSION_FOR_ACTION: '',
  NO_PERMISSION_TO_VIEW: '',
}));

jest.mock('../../../utils/CommonUtils', () => ({
  getEntityName: jest.fn().mockReturnValue(''),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getAddPolicyRulePath: jest.fn(),
  getEditPolicyRulePath: jest.fn(),
  getRoleWithFqnPath: jest.fn(),
  getSettingPath: jest.fn(),
  getTeamsWithFqnPath: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn().mockReturnValue(''),
}));

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (label: string) => label,
  }),
}));

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

describe('Test Policy details page', () => {
  it('Should render the policy details page component', async () => {
    render(<PoliciesDetailPage />);

    const container = await screen.findByTestId('policy-details-container');

    const breadCrumb = await screen.findByTestId('breadcrumb');

    const description = await screen.findByTestId('description-data');

    const rulesTab = await screen.findByText('label.rule-plural');

    const rolesTab = await screen.findByText('label.role-plural');

    const teamsTab = await screen.findByText('label.team-plural');

    expect(container).toBeInTheDocument();

    expect(breadCrumb).toBeInTheDocument();

    expect(description).toBeInTheDocument();

    expect(rulesTab).toBeInTheDocument();

    expect(rolesTab).toBeInTheDocument();

    expect(teamsTab).toBeInTheDocument();
  });

  it('Should render the rule card and its attributes', async () => {
    render(<PoliciesDetailPage />);

    const ruleCard = await screen.findByTestId('rule-card');

    const ruleName = await screen.findByTestId('rule-name');

    const ruleDescription = await screen.findByTestId('description');

    const ruleResources = await screen.findByTestId('resources');

    const ruleOperations = await screen.findByTestId('operations');

    const ruleEffect = await screen.findByTestId('effect');

    const ruleCondition = await screen.findByTestId('condition');

    expect(ruleCard).toBeInTheDocument();
    expect(ruleName).toBeInTheDocument();
    expect(ruleDescription).toBeInTheDocument();
    expect(ruleResources).toBeInTheDocument();
    expect(ruleOperations).toBeInTheDocument();
    expect(ruleEffect).toBeInTheDocument();
    expect(ruleCondition).toBeInTheDocument();
  });
});
