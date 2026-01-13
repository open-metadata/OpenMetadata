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
import * as reactI18next from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { TabSpecificField } from '../../../enums/entity.enum';
import { getPolicies } from '../../../rest/rolesAPIV1';
import i18n from '../../../utils/i18next/LocalUtil';
import AddRolePage from './AddRolePage';

jest.mock('../../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../../rest/rolesAPIV1', () => ({
  addRole: jest.fn().mockImplementation(() => Promise.resolve()),
  getPolicies: jest.fn().mockImplementation(() => Promise.resolve()),
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
  getRoleWithFqnPath: jest.fn(),
  getSettingPath: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children, leftPanel, rightPanel }) => (
    <div>
      {leftPanel}
      {children}
      {rightPanel}
    </div>
  ))
);

jest.mock('../../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);
jest.mock('../../../utils/CommonUtils', () => ({
  getIsErrorMatch: jest.fn(),
}));

jest.mock('../../../utils/BrandData/BrandClassBase', () => ({
  __esModule: true,
  default: {
    getPageTitle: jest.fn().mockReturnValue('OpenMetadata'),
  },
}));

const mockProps = {
  pageTitle: i18n.t('label.add-new-entity', {
    entity: i18n.t('label.role'),
  }),
};

describe('Test Add Role Page', () => {
  it('Should Render the Add Role page component', async () => {
    render(<AddRolePage {...mockProps} />, { wrapper: MemoryRouter });

    expect(getPolicies).toHaveBeenCalledWith(
      `${TabSpecificField.OWNERS},${TabSpecificField.LOCATION},${TabSpecificField.TEAMS},${TabSpecificField.ROLES}`,
      undefined,
      undefined,
      100
    );

    const container = await screen.findByTestId('add-role-container');

    const breadCrumb = await screen.findByTestId('breadcrumb');

    const formTitle = await screen.findByTestId('form-title');

    const form = await screen.findByTestId('role-form');

    expect(container).toBeInTheDocument();

    expect(breadCrumb).toBeInTheDocument();

    expect(formTitle).toBeInTheDocument();

    expect(form).toBeInTheDocument();
  });

  it('Form fields should render', async () => {
    render(<AddRolePage {...mockProps} />, { wrapper: MemoryRouter });

    const form = await screen.findByTestId('role-form');

    const nameInput = await screen.findByTestId('name');

    const policiesSelect = await screen.findByTestId('policies');

    const cancelButton = await screen.findByTestId('cancel-btn');

    const submitButton = await screen.findByTestId('submit-btn');

    expect(form).toBeInTheDocument();
    expect(nameInput).toBeInTheDocument();
    expect(policiesSelect).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
  });

  it('should render with correct brandName (OpenMetadata or Collate)', async () => {
    const mockT = jest.fn((key: string, params?: Record<string, string>) => {
      if (key === 'message.add-role-message' && params?.brandName) {
        return (
          `Roles are assigned to Users. In ${params.brandName}, Roles are a collection of Policies. ` +
          `Each Role must have at least one policy attached to it. A Role supports multiple policies ` +
          `with a one to many relationship. Ensure that the necessary policies are created before ` +
          `creating a new role. Build rich access control roles with well-defined policies based on ` +
          `conditional rules.`
        );
      }

      return key;
    });

    jest.spyOn(reactI18next, 'useTranslation').mockReturnValue({
      t: mockT,
      i18n: { language: 'en-US' },
      ready: true,
    } as any);

    const { container } = render(<AddRolePage {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const roleContainer = await screen.findByTestId('add-role-container');

    expect(roleContainer).toBeInTheDocument();
    // Verify actual brand name is rendered
    expect(container.textContent).toMatch(/OpenMetadata|Collate/);
    expect(container.textContent).not.toContain('{{brandName}}');

    // Verify translation was called with brandName
    expect(mockT).toHaveBeenCalledWith('message.add-role-message', {
      brandName: 'OpenMetadata',
    });
  });
});
