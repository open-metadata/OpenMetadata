/*
 *  Copyright 2024 Collate.
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
import { fireEvent, render, screen } from '@testing-library/react';
import { DomainFormType } from '../DomainPage.interface';
import AddDomainForm from './AddDomainForm.component';

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Button: jest
    .fn()
    .mockImplementation(({ loading, children, ...rest }) => (
      <button {...rest}>{loading ? 'Loader.Button' : children}</button>
    )),
}));

jest.mock('../../../components/common/UserTag/UserTag.component', () => ({
  UserTag: jest.fn().mockImplementation(() => <p>UserTag</p>),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      glossary: {
        Create: true,
      },
    },
  }),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('getEntityName'),
}));

jest.mock('../../../utils/DomainUtils', () => ({
  domainTypeTooltipDataRender: jest
    .fn()
    .mockReturnValue(<p>domainTypeTooltipDataRender</p>),
}));

jest.mock('../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

const mockOnCancel = jest.fn();
const mockOnSubmit = jest.fn();

const mockProps = {
  loading: false,
  isFormInDialog: false,
  onCancel: mockOnCancel,
  onSubmit: mockOnSubmit,
  type: DomainFormType.DOMAIN,
};

describe('Test Add Domain component', () => {
  it('Should render content of form', async () => {
    render(<AddDomainForm {...mockProps} />);

    expect(screen.getByText('label.name')).toBeInTheDocument();
    expect(screen.getByTestId('name')).toBeInTheDocument();
    expect(screen.getByText('label.display-name')).toBeInTheDocument();
    expect(screen.getByTestId('display-name')).toBeInTheDocument();
    expect(screen.getByText('label.description')).toBeInTheDocument();
    expect(screen.getByTestId('editor')).toBeInTheDocument();
    expect(screen.getByText('label.icon-url')).toBeInTheDocument();
    expect(screen.getByTestId('icon-url')).toBeInTheDocument();
    expect(screen.getByText('label.color')).toBeInTheDocument();
    expect(screen.getByTestId('color-color-picker')).toBeInTheDocument();
    expect(screen.getByTestId('color-color-input')).toBeInTheDocument();
    expect(screen.getByText('label.domain-type')).toBeInTheDocument();
    expect(screen.getAllByTestId('helper-icon')).toHaveLength(2);
    expect(screen.getByText('label.owner-plural')).toBeInTheDocument();
    expect(screen.getByTestId('add-owner')).toBeInTheDocument();
    expect(screen.getByText('label.expert-plural')).toBeInTheDocument();
    expect(screen.getByTestId('add-experts')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-domain')).toBeInTheDocument();
    expect(screen.getByTestId('save-domain')).toBeInTheDocument();
  });

  it('Should show loading button', async () => {
    render(<AddDomainForm {...mockProps} loading />);

    expect(screen.getByText('Loader.Button')).toBeInTheDocument();
  });

  it('Should trigger onCancel', async () => {
    render(<AddDomainForm {...mockProps} />);
    fireEvent.click(screen.getByText('label.cancel'));

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('Should not show footer button if form is in dialog box', async () => {
    render(<AddDomainForm {...mockProps} isFormInDialog />);

    expect(screen.queryByTestId('cta-buttons')).not.toBeInTheDocument();
  });

  it('Should not trigger onSubmit if required element are not filled', async () => {
    render(<AddDomainForm {...mockProps} />);
    fireEvent.click(screen.getByTestId('save-domain'));

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('Should not show domain type if type is not DOMAIN', async () => {
    render(<AddDomainForm {...mockProps} type={DomainFormType.DATA_PRODUCT} />);

    expect(screen.queryByText('label.domain-type')).not.toBeInTheDocument();
  });
});
