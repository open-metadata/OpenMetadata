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
import { MemoryRouter } from 'react-router-dom';
import AddPolicyPage from './AddPolicyPage';

jest.mock('../../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../../rest/rolesAPIV1', () => ({
  addPolicy: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../components/common/RichTextEditor/RichTextEditor', () =>
  jest.fn().mockReturnValue(<div data-testid="editor">Editor</div>)
);

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () =>
    jest.fn().mockReturnValue(<div data-testid="breadcrumb">BreadCrumb</div>)
);

jest.mock('../../../utils/RouterUtils', () => ({
  getPath: jest.fn(),
  getPolicyWithFqnPath: jest.fn(),
  getSettingPath: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);

const mockProps = {
  pageTitle: 'add-policy',
};
jest.mock('../../../utils/CommonUtils', () => ({
  getIsErrorMatch: jest.fn(),
}));

describe('Test Add Policy Page', () => {
  it('Should Render the Add Policy page component', async () => {
    render(<AddPolicyPage {...mockProps} />, { wrapper: MemoryRouter });

    const container = await screen.findByTestId('add-policy-container');

    const breadCrumb = await screen.findByTestId('breadcrumb');

    const formTitle = await screen.findByTestId('form-title');

    const form = await screen.findByTestId('policy-form');

    expect(container).toBeInTheDocument();

    expect(breadCrumb).toBeInTheDocument();

    expect(formTitle).toBeInTheDocument();

    expect(form).toBeInTheDocument();
  });

  it('Form fields should render', async () => {
    render(<AddPolicyPage {...mockProps} />, { wrapper: MemoryRouter });

    const form = await screen.findByTestId('policy-form');

    const nameInput = await screen.findByTestId('policy-name');

    const divider = await screen.findByTestId('add-rule-divider');

    const ruleName = await screen.findByTestId('rule-name');

    const resources = await screen.findByTestId('resources');
    const operations = await screen.findByTestId('operations');

    const effect = await screen.findByTestId('effect');

    const condition = await screen.findByTestId('condition');

    const cancelButton = await screen.findByTestId('cancel-btn');

    const submitButton = await screen.findByTestId('submit-btn');

    expect(form).toBeInTheDocument();
    expect(nameInput).toBeInTheDocument();
    expect(divider).toBeInTheDocument();
    expect(ruleName).toBeInTheDocument();
    expect(resources).toBeInTheDocument();
    expect(operations).toBeInTheDocument();
    expect(effect).toBeInTheDocument();
    expect(condition).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
  });
});
