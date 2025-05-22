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
import { TabSpecificField } from '../../../enums/entity.enum';
import { getPolicyByName } from '../../../rest/rolesAPIV1';
import { POLICY_DATA } from '../PoliciesData.mock';
import EditRulePage from './EditRulePage';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({ fqn: 'data-consumer' }),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

jest.mock('../../../rest/rolesAPIV1', () => ({
  getPolicyByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(POLICY_DATA)),
  patchPolicy: jest.fn().mockImplementation(() => Promise.resolve(POLICY_DATA)),
}));

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () =>
    jest.fn().mockReturnValue(<div data-testid="breadcrumb">BreadCrumb</div>)
);

jest.mock('../../../components/common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>)
);

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

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

describe('Test Edit rule page Component', () => {
  it('Should render the rule form fields', async () => {
    render(<EditRulePage />);

    expect(getPolicyByName).toHaveBeenCalledWith(
      'data-consumer',
      `${TabSpecificField.OWNERS},${TabSpecificField.LOCATION},${TabSpecificField.TEAMS},${TabSpecificField.ROLES}`
    );

    const breadcrumb = await screen.findByTestId('breadcrumb');

    const title = await screen.findByTestId('edit-rule-title');

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
