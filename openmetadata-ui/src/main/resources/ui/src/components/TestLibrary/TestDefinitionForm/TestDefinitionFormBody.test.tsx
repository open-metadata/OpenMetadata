/*
 *  Copyright 2025 Collate.
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
import { HookForm } from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { FC } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { TestPlatform } from '../../../generated/tests/testDefinition';
import { TestDefinitionFormValues } from './TestDefinitionForm.interface';
import TestDefinitionFormBody from './TestDefinitionFormBody';

jest.mock('../../Database/SchemaEditor/CodeEditor', () => ({
  __esModule: true,
  default: () => <div data-testid="code-editor" />,
}));

jest.mock('../../../utils/DataQuality/FormFieldDocs', () => ({
  loadFormFieldDocs: jest.fn().mockResolvedValue({}),
}));

let formRef: UseFormReturn<TestDefinitionFormValues> | undefined;

const Harness: FC<{
  isEditMode?: boolean;
  isReadOnlyField?: boolean;
  defaultValues?: Partial<TestDefinitionFormValues>;
  errorMessage?: string;
  onErrorDismiss?: () => void;
  onActiveFieldChange?: (fieldId: string) => void;
}> = ({
  isEditMode = false,
  isReadOnlyField = false,
  defaultValues,
  errorMessage,
  onErrorDismiss,
  onActiveFieldChange,
}) => {
  const form = useForm<TestDefinitionFormValues>({
    mode: 'onChange',
    defaultValues: defaultValues as TestDefinitionFormValues,
  });
  formRef = form;

  return (
    <HookForm form={form} onSubmit={jest.fn()}>
      <TestDefinitionFormBody
        errorMessage={errorMessage}
        form={form}
        isEditMode={isEditMode}
        isReadOnlyField={isReadOnlyField}
        onActiveFieldChange={onActiveFieldChange}
        onErrorDismiss={onErrorDismiss}
      />
    </HookForm>
  );
};

describe('TestDefinitionFormBody', () => {
  it('renders the core fields', async () => {
    render(<Harness />);

    expect(screen.getByTestId('test-definition-name')).toBeInTheDocument();
    expect(screen.getByTestId('entity-type')).toBeInTheDocument();
    expect(screen.getByTestId('test-platforms')).toBeInTheDocument();
    expect(await screen.findByTestId('code-editor')).toBeInTheDocument();
  });

  it('shows the enabled toggle only in edit mode', () => {
    const { rerender } = render(<Harness isEditMode={false} />);

    expect(screen.queryByTestId('enabled-toggle')).not.toBeInTheDocument();

    rerender(<Harness isEditMode />);

    expect(screen.getByTestId('enabled-toggle')).toBeInTheDocument();
  });

  it('disables the enabled toggle for a read-only definition in edit mode', () => {
    render(<Harness isEditMode isReadOnlyField />);

    expect(
      screen.getByTestId('enabled-toggle').querySelector('input')
    ).toBeDisabled();
  });

  it('renders an Add Parameter control when not read-only', () => {
    render(<Harness />);

    expect(screen.getByTestId('add-parameter-button')).toBeInTheDocument();
  });

  it('disables the name input in edit mode', () => {
    render(<Harness isEditMode />);

    const nameInput = screen
      .getByTestId('test-definition-name')
      .querySelector('input');

    expect(nameInput).toBeDisabled();
  });

  it('disables fields and hides add/remove parameter controls when read-only', () => {
    render(
      <Harness
        isReadOnlyField
        defaultValues={{
          parameterDefinition: [{ name: 'existing_param' }],
        }}
      />
    );

    const nameInput = screen
      .getByTestId('test-definition-name')
      .querySelector('input');

    expect(nameInput).toBeDisabled();
    expect(
      screen.queryByTestId('add-parameter-button')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('remove-parameter-0')).not.toBeInTheDocument();
  });

  it('keeps display name and description editable when read-only (parity with the legacy form)', () => {
    render(<Harness isReadOnlyField />);

    expect(
      screen.getByTestId('display-name').querySelector('input')
    ).not.toBeDisabled();
    expect(
      screen.getByTestId('description').querySelector('textarea')
    ).not.toBeDisabled();
  });

  it('adds a parameter row when the Add Parameter control is clicked', () => {
    render(<Harness />);

    expect(screen.queryByTestId('parameter-name-0')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-parameter-button'));

    expect(screen.getByTestId('parameter-name-0')).toBeInTheDocument();
    expect(screen.getByTestId('remove-parameter-0')).toBeInTheDocument();
  });

  it('renders the inline error alert when an error message is provided', () => {
    render(<Harness errorMessage="Something went wrong" />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  describe('supportedDataTypes conditional required', () => {
    it('flags supportedDataTypes required when testPlatforms includes OpenMetadata and it is empty', async () => {
      render(<Harness />);

      await act(async () => {
        formRef?.setValue('testPlatforms', [
          { id: TestPlatform.OpenMetadata, label: TestPlatform.OpenMetadata },
        ]);
        formRef?.setValue('supportedDataTypes', []);
      });

      let isValid = true;
      await act(async () => {
        isValid = await formRef!.trigger('supportedDataTypes');
      });

      expect(isValid).toBe(false);

      await waitFor(() => {
        expect(
          formRef?.getFieldState('supportedDataTypes').error?.message
        ).toBeDefined();
      });
    });

    it('does not flag supportedDataTypes when testPlatforms excludes OpenMetadata', async () => {
      render(<Harness />);

      await act(async () => {
        formRef?.setValue('testPlatforms', [
          { id: TestPlatform.Soda, label: TestPlatform.Soda },
        ]);
        formRef?.setValue('supportedDataTypes', []);
      });

      let isValid = false;
      await act(async () => {
        isValid = await formRef!.trigger('supportedDataTypes');
      });

      expect(isValid).toBe(true);
      expect(
        formRef?.getFieldState('supportedDataTypes').error
      ).toBeUndefined();
    });
  });
});
