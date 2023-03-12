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
import { POLICY_DATA } from '../policies.mock';
import AddRulePage from './AddRulePage';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockReturnValue({
    push: jest.fn(),
  }),
  useParams: jest.fn().mockReturnValue({ fqn: 'data-consumer' }),
}));

jest.mock('rest/rolesAPIV1', () => ({
  getPolicyByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(POLICY_DATA)),
  patchPolicy: jest.fn().mockImplementation(() => Promise.resolve(POLICY_DATA)),
}));

jest.mock('components/common/title-breadcrumb/title-breadcrumb.component', () =>
  jest.fn().mockReturnValue(<div data-testid="breadcrumb">BreadCrumb</div>)
);

jest.mock('components/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>)
);

jest.mock('../../../constants/GlobalSettings.constants', () => ({
  GlobalSettingOptions: {
    POLICIES: 'policies',
  },
}));

jest.mock('../../../utils/CommonUtils', () => ({
  getEntityName: jest.fn(),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getPath: jest.fn(),
  getPolicyWithFqnPath: jest.fn(),
  getSettingPath: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../RuleForm/RuleForm', () =>
  jest.fn().mockReturnValue(<div data-testid="rule-form-fields">RuleForm</div>)
);

describe('Test Add rule page Component', () => {
  it('Should render the rule form fields', async () => {
    render(<AddRulePage />);

    const breadcrumb = await screen.findByTestId('breadcrumb');

    const title = await screen.findByTestId('add-rule-title');

    const ruleForm = await screen.findByTestId('rule-form-fields');

    const cancelButton = await screen.findByTestId('cancel-btn');

    const submitButton = await screen.findByTestId('submit-btn');

    expect(breadcrumb).toBeInTheDocument();
    expect(title).toBeInTheDocument();
    expect(ruleForm).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
  });
});
