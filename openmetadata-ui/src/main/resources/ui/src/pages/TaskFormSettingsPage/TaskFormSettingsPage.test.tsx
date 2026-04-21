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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TaskFormSettingsPage from './TaskFormSettingsPage';

const mockListTaskFormSchemas = jest.fn();
const mockCreateTaskFormSchema = jest.fn();
const mockUpdateTaskFormSchema = jest.fn();
const mockUpdateWorkflowDefinition = jest.fn();
const mockGetWorkflowDefinitionByFQN = jest.fn();
const mockShowSuccessToast = jest.fn();
const mockShowErrorToast = jest.fn();

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn().mockImplementation(() => <div>TitleBreadcrumb.component</div>)
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock('../../components/Database/SchemaEditor/CodeEditor', () =>
  jest
    .fn()
    .mockImplementation(({ value, onChange }) => (
      <textarea
        data-testid="code-editor"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    ))
);

jest.mock('../../rest/taskFormSchemasAPI', () => ({
  createTaskFormSchema: (...args: unknown[]) =>
    mockCreateTaskFormSchema(...args),
  listTaskFormSchemas: (...args: unknown[]) => mockListTaskFormSchemas(...args),
  updateTaskFormSchema: (...args: unknown[]) =>
    mockUpdateTaskFormSchema(...args),
}));

jest.mock('../../rest/workflowDefinitionsAPI', () => ({
  updateWorkflowDefinition: (...args: unknown[]) =>
    mockUpdateWorkflowDefinition(...args),
  getWorkflowDefinitionByFQN: (...args: unknown[]) =>
    mockGetWorkflowDefinitionByFQN(...args),
}));

jest.mock('../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
  showSuccessToast: (...args: unknown[]) => mockShowSuccessToast(...args),
}));

const SCHEMA = {
  id: 'schema-id',
  name: 'DescriptionUpdate',
  displayName: 'Description Update',
  description: 'Existing description schema',
  taskType: 'DescriptionUpdate',
  taskCategory: 'MetadataUpdate',
  formSchema: {
    type: 'object',
    properties: {
      newDescription: { type: 'string' },
    },
  },
  uiSchema: {
    newDescription: {
      'ui:widget': 'descriptionTabs',
    },
  },
};

describe('TaskFormSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListTaskFormSchemas.mockResolvedValue({
      data: [SCHEMA],
      paging: {},
    });
    mockUpdateTaskFormSchema.mockResolvedValue(SCHEMA);
    mockCreateTaskFormSchema.mockResolvedValue({
      ...SCHEMA,
      id: 'new-schema-id',
      name: 'CustomReview',
    });
    mockUpdateWorkflowDefinition.mockResolvedValue({
      name: 'DescriptionUpdateTaskWorkflow',
      version: 1,
    });
    mockGetWorkflowDefinitionByFQN.mockResolvedValue({
      name: 'DescriptionUpdateTaskWorkflow',
    });
  });

  it('loads and displays the existing task form schema', async () => {
    render(<TaskFormSettingsPage />);

    expect(
      await screen.findByText('TitleBreadcrumb.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('task-form-list-item-DescriptionUpdate')
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByLabelText('Name')).toHaveValue('DescriptionUpdate')
    );

    expect(screen.getByTestId('task-form-category-input')).toHaveTextContent(
      'MetadataUpdate'
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Advanced JSON' }));

    await waitFor(() =>
      expect(screen.getAllByTestId('code-editor')).toHaveLength(7)
    );
  });

  it('updates the selected schema', async () => {
    render(<TaskFormSettingsPage />);

    const displayNameInput = await screen.findByLabelText('Display Name');

    fireEvent.change(displayNameInput, {
      target: { value: 'Description Update v2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    await waitFor(() => expect(mockUpdateTaskFormSchema).toHaveBeenCalled());

    expect(mockUpdateTaskFormSchema).toHaveBeenCalledWith({
      ...SCHEMA,
      description: 'Existing description schema',
      displayName: 'Description Update v2',
      formSchema: SCHEMA.formSchema,
      createFormSchema: {
        properties: {
          newDescription: { type: 'string' },
        },
        type: 'object',
      },
      createUiSchema: {
        newDescription: {
          'ui:widget': 'descriptionTabs',
        },
      },
      transitionForms: {},
      defaultStageMappings: {},
      name: 'DescriptionUpdate',
      taskCategory: 'MetadataUpdate',
      taskType: 'DescriptionUpdate',
      uiSchema: SCHEMA.uiSchema,
      workflowDefinitionRef: 'DescriptionUpdateTaskWorkflow',
      workflowVersion: 1,
    });
    expect(mockShowSuccessToast).toHaveBeenCalledWith(
      'Task form saved successfully'
    );
  });

  it('creates a new schema when add is selected', async () => {
    render(<TaskFormSettingsPage />);

    await waitFor(() =>
      expect(screen.getByLabelText('Name')).toHaveValue('DescriptionUpdate')
    );

    fireEvent.click(screen.getByRole('button', { name: 'label.add' }));

    const nameInput = screen.getByLabelText('Name');
    const taskTypeInput = screen.getByLabelText('Task Type');

    fireEvent.change(nameInput, { target: { value: 'CustomReview' } });
    fireEvent.change(taskTypeInput, { target: { value: 'Review' } });
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    await waitFor(() => expect(mockCreateTaskFormSchema).toHaveBeenCalled());

    expect(mockCreateTaskFormSchema).toHaveBeenCalledWith({
      description: '',
      displayName: '',
      formSchema: {
        properties: {},
        type: 'object',
      },
      createFormSchema: {
        properties: {},
        type: 'object',
      },
      createUiSchema: {},
      transitionForms: {},
      defaultStageMappings: {},
      name: 'CustomReview',
      taskCategory: '',
      taskType: 'Review',
      uiSchema: {},
    });
  });

  it('shows an error toast when schema JSON is invalid', async () => {
    render(<TaskFormSettingsPage />);

    await waitFor(() =>
      expect(screen.getByLabelText('Name')).toHaveValue('DescriptionUpdate')
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Advanced JSON' }));

    fireEvent.change(screen.getAllByTestId('code-editor')[0], {
      target: { value: '{invalid-json' },
    });
    fireEvent.click(screen.getByTestId('task-form-save-button'));

    await waitFor(() =>
      expect(mockShowErrorToast).toHaveBeenCalledWith(
        'Task form settings JSON is invalid'
      )
    );

    expect(mockUpdateTaskFormSchema).not.toHaveBeenCalled();
  });
});
