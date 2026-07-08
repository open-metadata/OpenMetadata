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
import { render, screen } from '@testing-library/react';
import { FC } from 'react';
import { useForm } from 'react-hook-form';
import { TestDefinitionFormValues } from './TestDefinitionForm.interface';
import TestDefinitionFormBody from './TestDefinitionFormBody';

jest.mock('../../Database/SchemaEditor/CodeEditor', () => ({
  __esModule: true,
  default: () => <div data-testid="code-editor" />,
}));

const Harness: FC<{ isEditMode?: boolean; isReadOnlyField?: boolean }> = ({
  isEditMode = false,
  isReadOnlyField = false,
}) => {
  const form = useForm<TestDefinitionFormValues>({ mode: 'onChange' });

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
});
