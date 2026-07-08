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
import { act, render, screen, waitFor } from '@testing-library/react';
import { FC } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { TestPlatform } from '../../../generated/tests/testDefinition';
import { TestDefinitionFormValues } from './TestDefinitionForm.interface';
import TestDefinitionFormBody from './TestDefinitionFormBody';

jest.mock('../../Database/SchemaEditor/CodeEditor', () => ({
  __esModule: true,
  default: () => <div data-testid="code-editor" />,
}));

let formRef: UseFormReturn<TestDefinitionFormValues> | undefined;

const Harness: FC<{
  isEditMode?: boolean;
  isReadOnlyField?: boolean;
  defaultValues?: Partial<TestDefinitionFormValues>;
}> = ({ isEditMode = false, isReadOnlyField = false, defaultValues }) => {
  const form = useForm<TestDefinitionFormValues>({
    mode: 'onChange',
    defaultValues: defaultValues as TestDefinitionFormValues,
  });
  formRef = form;

  return (
    <HookForm form={form} onSubmit={jest.fn()}>
      <TestDefinitionFormBody
        form={form}
        isEditMode={isEditMode}
        isReadOnlyField={isReadOnlyField}
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
