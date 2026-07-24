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

import {
  Task,
  TaskCategory,
  TaskEntityStatus,
  TaskEntityType,
  TaskPriority,
} from '../rest/tasksAPI';
import {
  applyTaskFormSchemaDefaults,
  getDefaultTaskFormSchema,
  getEditableTaskPayload,
  getTaskFormHandlerConfig,
  getTaskResolutionNewValue,
  getTaskTransitionFormSchema,
  getTaskTransitionUiSchema,
  hasTaskFormFields,
  shouldRequireTaskResolutionValue,
} from './TaskFormSchemaUtils';

describe('TaskFormSchemaUtils', () => {
  it('returns the default description update schema', () => {
    const schema = getDefaultTaskFormSchema(
      TaskEntityType.DescriptionUpdate,
      TaskCategory.MetadataUpdate
    );

    expect(schema).toBeDefined();
    expect(schema?.name).toBe('DescriptionUpdate');
    expect(schema?.formSchema.required).toBeUndefined();
    expect(schema?.uiSchema?.['ui:handler']).toEqual({
      type: 'descriptionUpdate',
      permission: 'EDIT_DESCRIPTION',
      fieldPathField: 'fieldPath',
      valueField: 'newDescription',
    });
    expect(schema?.uiSchema?.newDescription).toEqual({
      'ui:widget': 'descriptionTabs',
    });
  });

  it('returns the default tag update schema', () => {
    const schema = getDefaultTaskFormSchema(
      TaskEntityType.TagUpdate,
      TaskCategory.MetadataUpdate
    );

    expect(schema).toBeDefined();
    expect(schema?.name).toBe('TagUpdate');
    expect(schema?.uiSchema?.['ui:handler']).toEqual({
      type: 'tagUpdate',
      permission: 'EDIT_TAGS',
      fieldPathField: 'fieldPath',
      currentTagsField: 'currentTags',
      addTagsField: 'tagsToAdd',
      removeTagsField: 'tagsToRemove',
    });
    expect(schema?.uiSchema?.tagsToAdd).toEqual({
      'ui:widget': 'tagsTabs',
    });
  });

  it('returns the default approval schema', () => {
    const schema = getDefaultTaskFormSchema(
      TaskEntityType.RequestApproval,
      TaskCategory.Approval
    );

    expect(schema?.taskType).toBe(TaskEntityType.RequestApproval);
    expect(schema?.uiSchema?.['ui:handler']).toEqual({
      type: 'approval',
      permission: 'EDIT_ALL',
    });
  });

  it('applies explicit schema defaults without overwriting existing payload values', () => {
    const payload = {
      reviewNotes: 'Already set',
    };
    const schema = {
      type: 'object',
      properties: {
        reviewNotes: { type: 'string', default: 'Default review notes' },
        approved: { type: 'boolean', default: false },
      },
    };

    expect(applyTaskFormSchemaDefaults(payload, schema)).toEqual({
      approved: false,
      reviewNotes: 'Already set',
    });
  });

  it('builds editable description payloads from legacy task values', () => {
    const task = {
      id: 'task-id',
      taskId: 'TASK-00001',
      name: 'desc-task',
      category: TaskCategory.MetadataUpdate,
      type: TaskEntityType.DescriptionUpdate,
      status: TaskEntityStatus.Open,
      priority: TaskPriority.Medium,
      payload: {
        field: 'description',
        currentValue: 'Current description',
        suggestedValue: 'Suggested description',
      },
    } as Task;

    expect(getEditableTaskPayload(task)).toMatchObject({
      fieldPath: 'description',
      currentDescription: 'Current description',
      newDescription: 'Suggested description',
    });
  });

  it('uses schema metadata for editable payload field mapping when provided', () => {
    const task = {
      id: 'task-id',
      taskId: 'TASK-00003',
      name: 'desc-task-custom',
      category: TaskCategory.Custom,
      type: TaskEntityType.CustomTask,
      status: TaskEntityStatus.Open,
      priority: TaskPriority.Medium,
      payload: {
        targetField: 'columns.address.description',
        currentText: 'Current description',
        proposedText: 'Suggested description',
      },
    } as Task;

    expect(
      getEditableTaskPayload(task, {
        'ui:editablePayload': {
          fieldPathField: 'targetField',
          currentValueField: 'currentText',
          editedValueField: 'proposedText',
        },
      })
    ).toMatchObject({
      targetField: 'columns.address.description',
      currentText: 'Current description',
      proposedText: 'Suggested description',
    });
  });

  it('resolves handler metadata from schema ui bindings', () => {
    const task = {
      id: 'task-id',
      taskId: 'TASK-01000',
      name: 'custom-task',
      category: TaskCategory.Custom,
      type: TaskEntityType.CustomTask,
      status: TaskEntityStatus.Open,
      priority: TaskPriority.Medium,
      payload: {},
    } as Task;

    expect(
      getTaskFormHandlerConfig(task, {
        'ui:handler': {
          type: 'descriptionUpdate',
          permission: 'EDIT_DESCRIPTION',
          fieldPathField: 'targetField',
          valueField: 'proposedText',
        },
      })
    ).toEqual({
      type: 'descriptionUpdate',
      permission: 'EDIT_DESCRIPTION',
      fieldPathField: 'targetField',
      valueField: 'proposedText',
      approvedValue: 'approved',
      rejectedValue: 'rejected',
    });
  });

  it('uses schema metadata for editable tag payload mapping for custom tasks', () => {
    const task = {
      id: 'task-id',
      taskId: 'TASK-00005',
      name: 'tag-task-custom',
      category: TaskCategory.Custom,
      type: TaskEntityType.CustomTask,
      status: TaskEntityStatus.Open,
      priority: TaskPriority.Medium,
      payload: {
        targetField: 'columns.address.tags',
        existingTags: [
          {
            tagFQN: 'PII.Sensitive',
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        ],
        proposedTags: [
          {
            tagFQN: 'PersonalData.SpecialCategory',
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        ],
        removedTags: [],
      },
    } as Task;

    expect(
      getEditableTaskPayload(task, {
        'ui:editablePayload': {
          fieldPathField: 'targetField',
          currentTagsField: 'existingTags',
          addTagsField: 'proposedTags',
          removeTagsField: 'removedTags',
        },
      })
    ).toMatchObject({
      targetField: 'columns.address.tags',
      existingTags: [
        {
          tagFQN: 'PII.Sensitive',
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        },
      ],
      proposedTags: [
        {
          tagFQN: 'PersonalData.SpecialCategory',
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        },
      ],
      removedTags: [],
    });
  });

  it('derives resolved tag values from schema-edited payloads', () => {
    const task = {
      id: 'task-id',
      taskId: 'TASK-00002',
      name: 'tag-task',
      category: TaskCategory.MetadataUpdate,
      type: TaskEntityType.TagUpdate,
      status: TaskEntityStatus.Open,
      priority: TaskPriority.Medium,
      payload: {},
    } as Task;

    expect(
      getTaskResolutionNewValue(task, {
        currentTags: [
          {
            tagFQN: 'PII.Sensitive',
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        ],
        tagsToAdd: [
          {
            tagFQN: 'PersonalData.SpecialCategory',
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        ],
        tagsToRemove: [
          {
            tagFQN: 'PII.Sensitive',
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        ],
      })
    ).toBe(
      JSON.stringify([
        {
          tagFQN: 'PersonalData.SpecialCategory',
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        },
      ])
    );
  });

  it('uses schema metadata to derive the resolved value', () => {
    const task = {
      id: 'task-id',
      taskId: 'TASK-00004',
      name: 'desc-task-resolution',
      category: TaskCategory.MetadataUpdate,
      type: TaskEntityType.DescriptionUpdate,
      status: TaskEntityStatus.Open,
      priority: TaskPriority.Medium,
      payload: {},
    } as Task;

    expect(
      getTaskResolutionNewValue(
        task,
        {
          proposedText: 'Schema-driven description',
        },
        {
          'ui:resolution': {
            mode: 'field',
            valueField: 'proposedText',
          },
        }
      )
    ).toBe('Schema-driven description');
  });

  it('uses schema metadata to derive resolved tag values for custom tasks', () => {
    const task = {
      id: 'task-id',
      taskId: 'TASK-00006',
      name: 'custom-tag-resolution',
      category: TaskCategory.Custom,
      type: TaskEntityType.CustomTask,
      status: TaskEntityStatus.Open,
      priority: TaskPriority.Medium,
      payload: {},
    } as Task;

    expect(
      getTaskResolutionNewValue(
        task,
        {
          existingTags: [
            {
              tagFQN: 'PII.Sensitive',
              source: 'Classification',
              labelType: 'Manual',
              state: 'Confirmed',
            },
          ],
          proposedTags: [
            {
              tagFQN: 'PersonalData.SpecialCategory',
              source: 'Classification',
              labelType: 'Manual',
              state: 'Confirmed',
            },
          ],
          removedTags: [
            {
              tagFQN: 'PII.Sensitive',
              source: 'Classification',
              labelType: 'Manual',
              state: 'Confirmed',
            },
          ],
        },
        {
          'ui:resolution': {
            mode: 'tagMerge',
            currentField: 'existingTags',
            addField: 'proposedTags',
            removeField: 'removedTags',
          },
        }
      )
    ).toBe(
      JSON.stringify([
        {
          tagFQN: 'PersonalData.SpecialCategory',
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        },
      ])
    );
  });

  it('treats payload-mode resolutions as payload-driven instead of requiring newValue', () => {
    const task = {
      id: 'task-id',
      taskId: 'TASK-00007',
      name: 'custom-payload-resolution',
      category: TaskCategory.Custom,
      type: TaskEntityType.CustomTask,
      status: TaskEntityStatus.Open,
      priority: TaskPriority.Medium,
      payload: {},
    } as Task;

    const uiSchema = {
      'ui:resolution': {
        mode: 'payload',
      },
    };

    expect(
      getTaskResolutionNewValue(
        task,
        {
          proposedText: 'Schema-driven payload',
        },
        uiSchema
      )
    ).toBeUndefined();
    expect(shouldRequireTaskResolutionValue(uiSchema)).toBe(false);
  });

  it('resolves transition-specific task forms and preserves ui schema', () => {
    const schema = {
      name: 'CustomTask',
      taskType: TaskEntityType.CustomTask,
      taskCategory: TaskCategory.Custom,
      formSchema: {
        type: 'object',
        properties: {},
      },
      uiSchema: {},
      transitionForms: {
        resolve: {
          formSchema: {
            type: 'object',
            properties: {
              resolution: { type: 'string', title: 'Resolution' },
            },
          },
          uiSchema: {
            resolution: { 'ui:widget': 'textarea' },
          },
        },
      },
    };

    expect(
      getTaskTransitionFormSchema(schema, {
        id: 'resolve',
        label: 'Resolve',
        targetStageId: 'done',
        targetTaskStatus: TaskEntityStatus.Completed,
      })
    ).toEqual({
      type: 'object',
      properties: {
        resolution: { type: 'string', title: 'Resolution' },
      },
    });
    expect(
      getTaskTransitionUiSchema(schema, {
        id: 'resolve',
        label: 'Resolve',
        targetStageId: 'done',
        targetTaskStatus: TaskEntityStatus.Completed,
      })
    ).toEqual({
      resolution: { 'ui:widget': 'textarea' },
    });
  });

  it('injects a comment field for required workflow transitions', () => {
    const formSchema = getTaskTransitionFormSchema(
      {
        name: 'CustomTask',
        taskType: TaskEntityType.CustomTask,
        taskCategory: TaskCategory.Custom,
        formSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        id: 'close',
        label: 'Close',
        targetStageId: 'closed',
        targetTaskStatus: TaskEntityStatus.Cancelled,
        requiresComment: true,
      }
    );
    const uiSchema = getTaskTransitionUiSchema(
      {
        name: 'CustomTask',
        taskType: TaskEntityType.CustomTask,
        taskCategory: TaskCategory.Custom,
        formSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        id: 'close',
        label: 'Close',
        targetStageId: 'closed',
        targetTaskStatus: TaskEntityStatus.Cancelled,
        requiresComment: true,
      }
    );

    expect(hasTaskFormFields(formSchema)).toBe(true);
    expect(formSchema?.properties).toMatchObject({
      comment: {
        type: 'string',
        title: 'Comment',
      },
    });
    expect(uiSchema).toMatchObject({
      comment: {
        'ui:widget': 'textarea',
      },
    });
  });
});
