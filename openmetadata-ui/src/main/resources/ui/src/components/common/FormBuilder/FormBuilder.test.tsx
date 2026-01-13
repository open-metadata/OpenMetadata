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
import validator from '@rjsf/validator-ajv8';
import { fireEvent, render, screen } from '@testing-library/react';
import { LOADING_STATE } from '../../../enums/common.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { transformErrors } from '../../../utils/formUtils';
import FormBuilder, { Props } from './FormBuilder';

describe('FormBuilder', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  const props = {
    okText: 'Submit',
    cancelText: 'Cancel',
    serviceCategory: ServiceCategory.DASHBOARD_SERVICES,
    showFormHeader: true,
    status: 'initial',
    onCancel: mockOnCancel,
    onSubmit: mockOnSubmit,
    useSelectWidget: true,
    schema: {},
    formData: {},
    uiSchema: {},
    validator: validator,
  } as Props;

  it('should render Form Builder', () => {
    const { getByTestId } = render(
      <FormBuilder
        cancelText="Cancel"
        okText="OK"
        schema={{ type: 'object' }}
        serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
        transformErrors={transformErrors}
        validator={validator}
        onCancel={jest.fn()}
        onSubmit={jest.fn()}
      />
    );

    expect(getByTestId('buttons')).toBeInTheDocument();
    expect(getByTestId('submit-btn')).toBeInTheDocument();
  });

  it('should call onSubmit when submit button is clicked', () => {
    render(<FormBuilder {...props} />);
    fireEvent.click(screen.getByText('Submit'));

    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it('should handle cancel button click', () => {
    const { getByText } = render(
      <FormBuilder
        cancelText="Close"
        okText="OK"
        schema={{ type: 'object' }}
        serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
        validator={validator}
        onCancel={mockOnCancel}
        onSubmit={jest.fn()}
      />
    );
    const cancelButton = getByText('Close');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should display loader when status is waiting', () => {
    const { getByTestId } = render(
      <FormBuilder
        cancelText="Cancel"
        okText="OK"
        schema={{ type: 'object' }}
        serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
        status={LOADING_STATE.WAITING}
        validator={validator}
        onSubmit={jest.fn()}
      />
    );

    expect(getByTestId('loader')).toBeInTheDocument();
  });

  it('should display check icon when status is success', () => {
    const { getByRole } = render(
      <FormBuilder
        cancelText="Cancel"
        okText="OK"
        schema={{ type: 'object' }}
        serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
        status={LOADING_STATE.SUCCESS}
        validator={validator}
        onSubmit={jest.fn()}
      />
    );

    expect(getByRole('img')).toBeInTheDocument();
  });

  it('does not show form header when showFormHeader is false', () => {
    const newProps = { ...props, showFormHeader: false };
    render(<FormBuilder {...newProps} />);

    expect(screen.queryByText('Form Header')).toBeNull();
  });
});
