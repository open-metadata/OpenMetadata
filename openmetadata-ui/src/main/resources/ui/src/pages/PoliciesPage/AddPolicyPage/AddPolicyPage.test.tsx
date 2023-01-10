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
import { MemoryRouter } from 'react-router-dom';
import AddPolicyPage from './AddPolicyPage';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockReturnValue({
    push: jest.fn(),
  }),
}));

jest.mock('rest/rolesAPIV1', () => ({
  addPolicy: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('components/common/rich-text-editor/RichTextEditor', () =>
  jest.fn().mockReturnValue(<div data-testid="editor">Editor</div>)
);

jest.mock('components/common/title-breadcrumb/title-breadcrumb.component', () =>
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

describe('Test Add Policy Page', () => {
  it('Should Render the Add Policy page component', async () => {
    render(<AddPolicyPage />, { wrapper: MemoryRouter });

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
    render(<AddPolicyPage />, { wrapper: MemoryRouter });

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
