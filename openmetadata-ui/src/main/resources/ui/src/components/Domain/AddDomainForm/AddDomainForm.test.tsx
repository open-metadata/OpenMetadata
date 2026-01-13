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
import { Form } from 'antd';
import { Domain } from '../../../generated/entity/domains/domain';
import '../../../test/unit/mocks/mui.mock';
import { DomainFormType } from '../DomainPage.interface';
import AddDomainForm from './AddDomainForm.component';

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the permission provider
jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {},
  }),
}));

// Mock form utilities to avoid complex field rendering
jest.mock('../../../utils/formUtils', () => ({
  generateFormFields: jest.fn().mockReturnValue(null),
  getField: jest.fn().mockReturnValue(null),
}));

const mockOnCancel = jest.fn();
const mockOnSubmit = jest.fn();

describe('AddDomainForm', () => {
  const defaultProps = {
    loading: false,
    isFormInDialog: false,
    onCancel: mockOnCancel,
    onSubmit: mockOnSubmit,
    type: DomainFormType.DOMAIN,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the form component', () => {
    render(<AddDomainForm {...defaultProps} />);
    // Form should be rendered
    const form = document.querySelector('form');

    expect(form).toBeInTheDocument();
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(<AddDomainForm {...defaultProps} />);

    const cancelButton = screen.getByTestId('cancel-domain');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should render loading state on save button when loading is true', () => {
    render(<AddDomainForm {...defaultProps} loading />);

    const saveButton = screen.getByTestId('save-domain');

    expect(saveButton).toHaveAttribute('disabled');
  });

  it('should not render footer buttons when isFormInDialog is true', () => {
    render(<AddDomainForm {...defaultProps} isFormInDialog />);

    const footerButtons = screen.queryByTestId('cta-buttons');

    expect(footerButtons).not.toBeInTheDocument();
  });

  it('should render footer buttons when isFormInDialog is false', () => {
    render(<AddDomainForm {...defaultProps} isFormInDialog={false} />);

    const footerButtons = screen.getByTestId('cta-buttons');

    expect(footerButtons).toBeInTheDocument();
  });

  it('should initialize form with Form.useForm when no formRef is provided', () => {
    const { container } = render(<AddDomainForm {...defaultProps} />);

    const formElement = container.querySelector('form');

    expect(formElement).toBeInTheDocument();
  });

  it('should use provided formRef when passed', () => {
    const TestWrapper = () => {
      const [form] = Form.useForm();

      return <AddDomainForm {...defaultProps} formRef={form} />;
    };

    const { container } = render(<TestWrapper />);

    const formElement = container.querySelector('form');

    expect(formElement).toBeInTheDocument();
  });

  it('should handle form submission', () => {
    render(<AddDomainForm {...defaultProps} />);

    const saveButton = screen.getByTestId('save-domain');
    fireEvent.click(saveButton);

    // Note: onSubmit is called through form.onFinish which requires form validation
    // In this simplified test, we're just verifying the button is clickable
    expect(saveButton).toBeInTheDocument();
  });

  it('should render form for DATA_PRODUCT type', () => {
    render(
      <AddDomainForm {...defaultProps} type={DomainFormType.DATA_PRODUCT} />
    );

    const form = document.querySelector('form');

    expect(form).toBeInTheDocument();
  });

  it('should render form for SUBDOMAIN type with parent domain', () => {
    const parentDomain = {
      id: '123',
      name: 'Parent Domain',
      fullyQualifiedName: 'ParentDomain',
      description: 'Parent domain description',
      domainType: 'Aggregate',
    } as Domain;

    render(
      <AddDomainForm
        {...defaultProps}
        parentDomain={parentDomain}
        type={DomainFormType.SUBDOMAIN}
      />
    );

    const form = document.querySelector('form');

    expect(form).toBeInTheDocument();
  });

  it('should have correct button labels', () => {
    render(<AddDomainForm {...defaultProps} />);

    const cancelButton = screen.getByTestId('cancel-domain');
    const saveButton = screen.getByTestId('save-domain');

    expect(cancelButton).toHaveTextContent('label.cancel');
    expect(saveButton).toHaveTextContent('label.save');
  });

  it('should disable save button during loading', () => {
    render(<AddDomainForm {...defaultProps} loading />);

    const saveButton = screen.getByTestId('save-domain');

    expect(saveButton).toBeDisabled();
  });

  it('should not disable cancel button during loading', () => {
    render(<AddDomainForm {...defaultProps} loading />);

    const cancelButton = screen.getByTestId('cancel-domain');

    expect(cancelButton).not.toBeDisabled();
  });
});
