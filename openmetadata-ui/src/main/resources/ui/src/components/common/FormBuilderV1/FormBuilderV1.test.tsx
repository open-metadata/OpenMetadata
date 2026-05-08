/*
 *  Copyright 2026 Collate.
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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import FormBuilderV1 from './FormBuilderV1';

const mockForm = jest.fn();
const mockFormatFormDataForRender = jest.fn(
  (data: Record<string, unknown> = {}) => ({
    ...data,
    formatted: true,
  })
);

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest.fn(
    ({
      children,
      isDisabled,
      onClick,
      type,
      ...props
    }: {
      children: React.ReactNode;
      isDisabled?: boolean;
      onClick?: () => void;
      type?: 'button' | 'submit';
    }) => (
      <button disabled={isDisabled} type={type} onClick={onClick} {...props}>
        {children}
      </button>
    )
  ),
}));

jest.mock('@rjsf/core', () => {
  const React = require('react');

  const MockForm = (props: Record<string, unknown>) => {
    mockForm(props);

    return React.createElement(
      'form',
      {
        'data-testid': 'rjsf-form',
        onSubmit: (event: React.FormEvent) => {
          event.preventDefault();
          (props.onSubmit as ((data: unknown) => void) | undefined)?.({
            formData: props.formData,
          });
        },
      },
      props.children
    );
  };

  return {
    __esModule: true,
    default: MockForm,
  };
});

jest.mock('../../../utils/JSONSchemaFormUtils', () => ({
  formatFormDataForRender: jest.fn((...args) =>
    mockFormatFormDataForRender(...args)
  ),
}));

jest.mock('../../../utils/formUtils', () => ({
  transformErrors: jest.fn(),
}));

describe('FormBuilderV1', () => {
  const schema = {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string' as const,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with formatted form data and default actions', () => {
    render(<FormBuilderV1 formData={{ name: 'value' }} schema={schema} />);

    expect(mockFormatFormDataForRender).toHaveBeenCalledWith({ name: 'value' });

    const lastFormProps = mockForm.mock.calls.at(-1)![0];

    expect(lastFormProps.formData).toEqual({
      name: 'value',
      formatted: true,
    });
    expect(screen.getByRole('button', { name: 'label.cancel' })).toBeVisible();
    expect(screen.getByTestId('submit-btn')).toHaveTextContent('label.submit');
  });

  it('resets local form data and calls onCancel', async () => {
    const onCancel = jest.fn();

    render(
      <FormBuilderV1
        formData={{ name: 'initial' }}
        schema={schema}
        onCancel={onCancel}
      />
    );

    act(() => {
      mockForm.mock.calls.at(-1)![0].onChange({
        formData: {
          name: 'changed',
        },
      });
    });

    await waitFor(() => {
      expect(mockForm.mock.calls.at(-1)![0].formData).toEqual({
        name: 'changed',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));

    expect(onCancel).toHaveBeenCalled();

    await waitFor(() => {
      expect(mockForm.mock.calls.at(-1)![0].formData).toEqual({
        name: 'initial',
        formatted: true,
      });
    });
  });

  it('forwards form changes and submit events', () => {
    const onChange = jest.fn();
    const onSubmit = jest.fn();

    render(
      <FormBuilderV1
        formData={{ name: 'initial' }}
        schema={schema}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    const changeEvent = {
      formData: {
        name: 'updated',
      },
    };

    act(() => {
      mockForm.mock.calls.at(-1)![0].onChange(changeEvent);
    });

    expect(onChange).toHaveBeenCalledWith(changeEvent);

    const submittedFormData = mockForm.mock.calls.at(-1)![0].formData;

    fireEvent.submit(screen.getByTestId('rjsf-form'));

    expect(onSubmit).toHaveBeenCalledWith({
      formData: submittedFormData,
    });
  });

  it('supports custom labels and submit button states', () => {
    const { rerender } = render(
      <FormBuilderV1
        cancelText="Discard"
        formData={{}}
        okText="Save"
        schema={schema}
      />
    );

    expect(screen.getByRole('button', { name: 'Discard' })).toBeVisible();
    expect(screen.getByTestId('submit-btn')).toHaveTextContent('Save');

    rerender(
      <FormBuilderV1 isLoading formData={{}} schema={schema} status="waiting" />
    );

    expect(screen.getByTestId('submit-btn')).toBeDisabled();
    expect(screen.getByTestId('submit-btn')).toHaveTextContent(
      'label.submitting'
    );
  });

  it('syncs localFormData when the formData prop changes', async () => {
    const { rerender } = render(
      <FormBuilderV1 formData={{ name: 'initial' }} schema={schema} />
    );

    expect(mockForm.mock.calls.at(-1)![0].formData).toEqual({
      name: 'initial',
      formatted: true,
    });

    rerender(<FormBuilderV1 formData={{ name: 'updated' }} schema={schema} />);

    await waitFor(() => {
      expect(mockForm.mock.calls.at(-1)![0].formData).toEqual({
        name: 'updated',
        formatted: true,
      });
    });
  });

  it('hides the cancel button when requested', () => {
    render(<FormBuilderV1 hideCancelButton formData={{}} schema={schema} />);

    expect(
      screen.queryByRole('button', { name: 'label.cancel' })
    ).not.toBeInTheDocument();
  });
});
