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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { createPersona } from '../../../../../../rest/PersonaAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import PersonaAddForm from './PersonaAddForm';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../rest/PersonaAPI', () => ({
  createPersona: jest.fn(),
}));

jest.mock('../../../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../common/RichTextEditor/RichTextEditor', () =>
  React.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      getEditorContent: () => 'persona description',
    }));

    return <div data-testid="persona-description-input" />;
  })
);

jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');
  const { FormProvider, useFormContext } =
    jest.requireActual('react-hook-form');

  // Text fields register with their real rules; the user picker (a react-aria
  // Autocomplete) is replaced by a button that selects a fixed user.
  const FormFields = ({
    fields,
  }: {
    fields: Array<{
      name: string;
      props?: { 'data-testid'?: string };
      rules?: Record<string, unknown>;
      type: string;
    }>;
  }) => {
    const { formState, register, setValue } = useFormContext();

    return (
      <>
        {fields.map((field) =>
          field.type === actual.FieldTypes.TEXT ? (
            <div key={field.name}>
              <input
                data-testid={field.props?.['data-testid']}
                {...register(field.name, field.rules)}
              />
              <span>{formState.errors[field.name]?.message}</span>
            </div>
          ) : (
            <button
              data-testid={field.props?.['data-testid']}
              key={field.name}
              type="button"
              onClick={() =>
                setValue(field.name, [
                  {
                    id: 'u1',
                    label: 'alice',
                    value: { id: 'u1', name: 'alice', type: 'user' },
                  },
                ])
              }>
              pick
            </button>
          )
        )}
      </>
    );
  };

  return {
    ...actual,
    FormFields,
    HookForm: ({
      children,
      form,
    }: React.PropsWithChildren<{ form: Record<string, unknown> }>) => (
      <FormProvider {...form}>{children}</FormProvider>
    ),
  };
});

const mockOnCancel = jest.fn();
const mockOnCreated = jest.fn();

const renderForm = () =>
  render(<PersonaAddForm onCancel={mockOnCancel} onCreated={mockOnCreated} />);

const fillName = (name: string) =>
  fireEvent.change(screen.getByTestId('persona-name-input'), {
    target: { value: name },
  });

describe('PersonaAddForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createPersona as jest.Mock).mockResolvedValue({});
  });

  it('renders the name, display name, description and users fields', () => {
    renderForm();

    expect(screen.getByTestId('persona-name-input')).toBeInTheDocument();
    expect(
      screen.getByTestId('persona-display-name-input')
    ).toBeInTheDocument();
    expect(screen.getByTestId('persona-description-input')).toBeInTheDocument();
    expect(screen.getByTestId('persona-users-select')).toBeInTheDocument();
  });

  it('calls onCancel from the cancel button', () => {
    renderForm();

    fireEvent.click(screen.getByTestId('cancel-btn'));

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('requires a name before creating', async () => {
    renderForm();

    fireEvent.click(screen.getByTestId('submit-btn'));

    expect(await screen.findByText('label.field-required')).toBeInTheDocument();
    expect(createPersona).not.toHaveBeenCalled();
  });

  it('creates the persona with trimmed values and selected user ids', async () => {
    renderForm();

    fillName('  analyst  ');
    fireEvent.change(screen.getByTestId('persona-display-name-input'), {
      target: { value: ' Analyst ' },
    });
    fireEvent.click(screen.getByTestId('persona-users-select'));
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => expect(mockOnCreated).toHaveBeenCalled());

    expect(createPersona).toHaveBeenCalledWith({
      name: 'analyst',
      displayName: 'Analyst',
      description: 'persona description',
      users: ['u1'],
    });
    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.create-entity-success'
    );
  });

  it('omits a blank display name and sends no users when none are picked', async () => {
    renderForm();

    fillName('analyst');
    fireEvent.change(screen.getByTestId('persona-display-name-input'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => expect(createPersona).toHaveBeenCalled());

    expect(createPersona).toHaveBeenCalledWith({
      name: 'analyst',
      displayName: undefined,
      description: 'persona description',
      users: [],
    });
  });

  it('shows an already-exists message when the name is taken', async () => {
    (createPersona as jest.Mock).mockRejectedValueOnce({
      response: { data: { message: 'Entity already exists' } },
    });
    renderForm();

    fillName('analyst');
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith('server.entity-already-exist')
    );

    expect(mockOnCreated).not.toHaveBeenCalled();
  });

  it('passes other errors through to the error toast', async () => {
    const error = { response: { data: { message: 'boom' } } };
    (createPersona as jest.Mock).mockRejectedValueOnce(error);
    renderForm();

    fillName('analyst');
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    expect(mockOnCreated).not.toHaveBeenCalled();
  });
});
