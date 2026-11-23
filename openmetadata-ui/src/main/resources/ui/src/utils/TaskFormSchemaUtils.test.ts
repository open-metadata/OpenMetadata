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

import APIClient from '../rest/axiosClient';
import {
  getSuggestionSchemaName,
  resolveTaskFormSchema,
  TaskFormSchema,
} from '../rest/taskFormSchemasAPI';
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
  getResolvedTaskFormSchema,
  getTaskFormHandlerConfig,
  getTaskResolutionNewValue,
  getTaskTransitionFormSchema,
  getTaskTransitionUiSchema,
  hasTaskFormFields,
  shouldRequireTaskResolutionValue,
  __resetTaskFormSchemaCache,
} from './TaskFormSchemaUtils';

// Mock the axios layer (used by listTaskFormSchemas, getTaskFormSchemaById,
// getTaskFormSchemaByFqn) so the real `resolveTaskFormSchema` disambiguation
// logic runs end-to-end without network calls. Other axios methods are
// untouched; only `get` is exercised by the form-schema API.
jest.mock('../rest/axiosClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const descriptionSuggestionSchema: TaskFormSchema = {
  name: 'DescriptionSuggestion',
  fullyQualifiedName: 'DescriptionSuggestion',
  taskType: 'Suggestion',
  taskCategory: 'MetadataUpdate',
  formSchema: {
    type: 'object',
    properties: {
      suggestedValue: { type: 'string', title: 'Suggested Description' },
    },
  },
  uiSchema: { suggestedValue: { 'ui:widget': 'textarea' } },
};

const tagSuggestionSchema: TaskFormSchema = {
  name: 'TagSuggestion',
  fullyQualifiedName: 'TagSuggestion',
  taskType: 'Suggestion',
  taskCategory: 'MetadataUpdate',
  formSchema: {
    type: 'object',
    properties: {
      suggestedValue: { type: 'string', title: 'Suggested Tags (JSON)' },
    },
  },
  uiSchema: { suggestedValue: { 'ui:widget': 'tagSelector' } },
};

const descriptionUpdateSchema: TaskFormSchema = {
  name: 'DescriptionUpdate',
  taskType: 'DescriptionUpdate',
  taskCategory: 'MetadataUpdate',
  formSchema: {
    type: 'object',
    properties: { newDescription: { type: 'string' } },
  },
  uiSchema: {},
};

const axiosResponse = <T>(data: T) => ({ data });

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
      createdBy: { id: 'creator-id', type: 'user' },
      taskId: 'TASK-00001',
      name: 'desc-task',
      category: TaskCategory.MetadataUpdate,
      type: TaskEntityType.DescriptionUpdate,
      status: TaskEntityStatus.Open,
      priority: TaskPriority.Medium,
      payload: {
        fieldPath: 'description',
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
      createdBy: { id: 'creator-id', type: 'user' },
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
      createdBy: { id: 'creator-id', type: 'user' },
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
      createdBy: { id: 'creator-id', type: 'user' },
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
      createdBy: { id: 'creator-id', type: 'user' },
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
      createdBy: { id: 'creator-id', type: 'user' },
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
      createdBy: { id: 'creator-id', type: 'user' },
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
      createdBy: { id: 'creator-id', type: 'user' },
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
        'ui:widget': 'richtext',
      },
    });
  });

  describe('tag suggestion tasks', () => {
    const tags = [
      {
        tagFQN: 'Data Sensitivity.Confidential',
        source: 'Classification',
        labelType: 'Generated',
        state: 'Confirmed',
      },
    ];
    const tagSuggestion = {
      type: TaskEntityType.Suggestion,
      payload: {
        suggestionType: 'Tag',
        fieldPath: 'columns::address',
        suggestedValue: JSON.stringify(tags),
      },
    } as unknown as Task;

    // The server validates the resolve payload against TagSuggestion, whose
    // suggestedValue is a string; an array there is rejected with a 400.
    it('keeps suggestedValue a JSON string in the payload it resolves with', () => {
      const payload = getEditableTaskPayload(tagSuggestion);

      expect(payload.suggestedValue).toBe(JSON.stringify(tags));
      expect(getTaskResolutionNewValue(tagSuggestion, payload)).toBe(
        JSON.stringify(tags)
      );
    });
  });
});

describe('Suggestion form schema resolution', () => {
  beforeEach(() => {
    __resetTaskFormSchemaCache();
  });

  const callsTo = (predicate: (url: string) => boolean) =>
    (APIClient.get as jest.Mock).mock.calls.filter(([url]) =>
      predicate(url as string)
    );

  const stubByUrl = (
    responses: Array<{ match: (url: string) => boolean; data: unknown }>
  ) => {
    (APIClient.get as jest.Mock).mockImplementation((url: string) => {
      const entry = responses.find((r) => r.match(url));

      if (!entry) {
        return Promise.reject(
          new Error(`Unexpected APIClient.get url: ${url}`)
        );
      }

      return Promise.resolve(axiosResponse(entry.data));
    });
  };

  const isListUrl = (url: string) => url === '/taskFormSchemas';
  const isByNameUrl = (url: string) => url.startsWith('/taskFormSchemas/name/');
  const isByIdUrl = (url: string) =>
    url.startsWith('/taskFormSchemas/') && !isByNameUrl(url);

  describe('getSuggestionSchemaName', () => {
    it('maps Description payload to DescriptionSuggestion', () => {
      expect(getSuggestionSchemaName({ suggestionType: 'Description' })).toBe(
        'DescriptionSuggestion'
      );
    });

    it('maps Tag payload to TagSuggestion', () => {
      expect(getSuggestionSchemaName({ suggestionType: 'Tag' })).toBe(
        'TagSuggestion'
      );
    });

    it('lowercases and trims the suggestion type (matching the backend)', () => {
      expect(getSuggestionSchemaName({ suggestionType: '  TAG ' })).toBe(
        'TagSuggestion'
      );
      expect(getSuggestionSchemaName({ suggestionType: 'description' })).toBe(
        'DescriptionSuggestion'
      );
    });

    it('returns undefined for unknown suggestion types', () => {
      expect(
        getSuggestionSchemaName({ suggestionType: 'Bold' })
      ).toBeUndefined();
    });

    it('returns undefined when no suggestionType is present', () => {
      expect(getSuggestionSchemaName({})).toBeUndefined();
      expect(getSuggestionSchemaName(undefined)).toBeUndefined();
    });
  });

  describe('resolveTaskFormSchema (Suggestion disambiguation)', () => {
    it('fetches DescriptionSuggestion by FQN for a Description payload', async () => {
      stubByUrl([{ match: isByNameUrl, data: descriptionSuggestionSchema }]);

      const schema = await resolveTaskFormSchema(
        'Suggestion',
        'MetadataUpdate',
        {
          suggestionType: 'Description',
        }
      );

      expect(schema).toEqual(descriptionSuggestionSchema);
      expect(callsTo(isByNameUrl)).toHaveLength(1);
      expect(callsTo(isByNameUrl)[0][0]).toBe(
        '/taskFormSchemas/name/DescriptionSuggestion'
      );
      expect(callsTo(isListUrl)).toHaveLength(0);
    });

    it('fetches TagSuggestion by FQN for a Tag payload', async () => {
      stubByUrl([{ match: isByNameUrl, data: tagSuggestionSchema }]);

      const schema = await resolveTaskFormSchema(
        'Suggestion',
        'MetadataUpdate',
        {
          suggestionType: 'Tag',
        }
      );

      expect(schema).toEqual(tagSuggestionSchema);
      expect(callsTo(isByNameUrl)[0][0]).toBe(
        '/taskFormSchemas/name/TagSuggestion'
      );
      expect(callsTo(isListUrl)).toHaveLength(0);
    });

    it('is case-insensitive on the suggestionType', async () => {
      stubByUrl([{ match: isByNameUrl, data: tagSuggestionSchema }]);

      await resolveTaskFormSchema('Suggestion', 'MetadataUpdate', {
        suggestionType: 'TAG',
      });

      expect(callsTo(isByNameUrl)[0][0]).toBe(
        '/taskFormSchemas/name/TagSuggestion'
      );
    });

    it('falls back to the list query when suggestionType is missing', async () => {
      stubByUrl([
        { match: isListUrl, data: { data: [descriptionSuggestionSchema] } },
      ]);

      const schema = await resolveTaskFormSchema(
        'Suggestion',
        'MetadataUpdate',
        {}
      );

      expect(schema).toEqual(descriptionSuggestionSchema);
      expect(callsTo(isByNameUrl)).toHaveLength(0);
      expect(callsTo(isListUrl)).toHaveLength(1);
      expect(callsTo(isListUrl)[0][1]).toMatchObject({
        params: {
          taskType: 'Suggestion',
          taskCategory: 'MetadataUpdate',
          limit: 1,
        },
      });
    });

    it('falls back to the list query when the suggestionType is unknown', async () => {
      stubByUrl([
        { match: isListUrl, data: { data: [descriptionSuggestionSchema] } },
      ]);

      const schema = await resolveTaskFormSchema(
        'Suggestion',
        'MetadataUpdate',
        {
          suggestionType: 'Bold',
        }
      );

      expect(schema).toEqual(descriptionSuggestionSchema);
      expect(callsTo(isByNameUrl)).toHaveLength(0);
    });

    it('falls back to the list query when the FQN fetch rejects', async () => {
      (APIClient.get as jest.Mock).mockImplementation((url: string) =>
        isByNameUrl(url)
          ? Promise.reject(new Error('404'))
          : Promise.resolve(axiosResponse({ data: [tagSuggestionSchema] }))
      );

      const schema = await resolveTaskFormSchema(
        'Suggestion',
        'MetadataUpdate',
        {
          suggestionType: 'Tag',
        }
      );

      expect(schema).toEqual(tagSuggestionSchema);
      expect(callsTo(isListUrl)).toHaveLength(1);
    });

    it('uses the list query as-is for non-Suggestion task types', async () => {
      stubByUrl([
        { match: isListUrl, data: { data: [descriptionUpdateSchema] } },
      ]);

      const schema = await resolveTaskFormSchema(
        'DescriptionUpdate',
        'MetadataUpdate',
        { suggestionType: 'Tag' }
      );

      expect(schema).toEqual(descriptionUpdateSchema);
      expect(callsTo(isByNameUrl)).toHaveLength(0);
      expect(callsTo(isListUrl)).toHaveLength(1);
      expect(callsTo(isListUrl)[0][1]).toMatchObject({
        params: {
          taskType: 'DescriptionUpdate',
          taskCategory: 'MetadataUpdate',
          limit: 1,
        },
      });
    });
  });

  describe('getResolvedTaskFormSchema', () => {
    it('prefers the schema id stamped on the task over the list/by-fqn query', async () => {
      stubByUrl([{ match: isByIdUrl, data: tagSuggestionSchema }]);

      const schema = await getResolvedTaskFormSchema(
        TaskEntityType.Suggestion,
        TaskCategory.MetadataUpdate,
        {
          taskFormSchemaId: 'stamped-schema-id',
          payload: { suggestionType: 'Description' },
        }
      );

      expect(schema).toEqual(tagSuggestionSchema);
      expect(callsTo(isByIdUrl)[0][0]).toBe(
        '/taskFormSchemas/stamped-schema-id'
      );
      expect(callsTo(isByNameUrl)).toHaveLength(0);
      expect(callsTo(isListUrl)).toHaveLength(0);
    });

    it('disambiguates Suggestion by payload.suggestionType when no id is stamped', async () => {
      stubByUrl([{ match: isByNameUrl, data: tagSuggestionSchema }]);

      const schema = await getResolvedTaskFormSchema(
        TaskEntityType.Suggestion,
        TaskCategory.MetadataUpdate,
        { payload: { suggestionType: 'Tag' } }
      );

      expect(schema).toEqual(tagSuggestionSchema);
      expect(callsTo(isByNameUrl)[0][0]).toBe(
        '/taskFormSchemas/name/TagSuggestion'
      );
      expect(callsTo(isByIdUrl)).toHaveLength(0);
    });

    it('renders the TagSuggestion widget (not DescriptionSuggestion) for a tag-suggestion task', async () => {
      stubByUrl([{ match: isByNameUrl, data: tagSuggestionSchema }]);

      const schema = await getResolvedTaskFormSchema(
        TaskEntityType.Suggestion,
        TaskCategory.MetadataUpdate,
        { payload: { suggestionType: 'Tag' } }
      );

      expect(schema?.name).toBe('TagSuggestion');
      expect(schema?.uiSchema?.suggestedValue).toEqual({
        'ui:widget': 'tagSelector',
      });
    });

    it('renders the DescriptionSuggestion widget for a description-suggestion task', async () => {
      stubByUrl([{ match: isByNameUrl, data: descriptionSuggestionSchema }]);

      const schema = await getResolvedTaskFormSchema(
        TaskEntityType.Suggestion,
        TaskCategory.MetadataUpdate,
        { payload: { suggestionType: 'Description' } }
      );

      expect(schema?.name).toBe('DescriptionSuggestion');
      expect(schema?.uiSchema?.suggestedValue).toEqual({
        'ui:widget': 'textarea',
      });
    });

    it('does not share a cached schema across Description and Tag variants', async () => {
      // First call resolves DescriptionSuggestion, second call resolves
      // TagSuggestion. If they shared a cache entry the second call would
      // reuse the first (wrong) schema.
      (APIClient.get as jest.Mock)
        .mockImplementationOnce((url: string) =>
          isByNameUrl(url)
            ? Promise.resolve(axiosResponse(descriptionSuggestionSchema))
            : Promise.reject(new Error(`Unexpected url: ${url}`))
        )
        .mockImplementationOnce((url: string) =>
          isByNameUrl(url)
            ? Promise.resolve(axiosResponse(tagSuggestionSchema))
            : Promise.reject(new Error(`Unexpected url: ${url}`))
        );

      const first = await getResolvedTaskFormSchema(
        TaskEntityType.Suggestion,
        TaskCategory.MetadataUpdate,
        { payload: { suggestionType: 'Description' } }
      );
      const second = await getResolvedTaskFormSchema(
        TaskEntityType.Suggestion,
        TaskCategory.MetadataUpdate,
        { payload: { suggestionType: 'Tag' } }
      );

      expect(first?.name).toBe('DescriptionSuggestion');
      expect(second?.name).toBe('TagSuggestion');
      expect(callsTo(isByNameUrl)).toHaveLength(2);
      expect(callsTo(isByNameUrl)[0][0]).toBe(
        '/taskFormSchemas/name/DescriptionSuggestion'
      );
      expect(callsTo(isByNameUrl)[1][0]).toBe(
        '/taskFormSchemas/name/TagSuggestion'
      );
    });

    it('serves a second identical call from the cache without a new fetch', async () => {
      stubByUrl([{ match: isByNameUrl, data: tagSuggestionSchema }]);

      await getResolvedTaskFormSchema(
        TaskEntityType.Suggestion,
        TaskCategory.MetadataUpdate,
        { payload: { suggestionType: 'Tag' } }
      );
      await getResolvedTaskFormSchema(
        TaskEntityType.Suggestion,
        TaskCategory.MetadataUpdate,
        { payload: { suggestionType: 'Tag' } }
      );

      expect(callsTo(isByNameUrl)).toHaveLength(1);
    });

    it('returns a deep clone from the cache so callers cannot mutate the cached entry', async () => {
      stubByUrl([{ match: isByNameUrl, data: tagSuggestionSchema }]);

      const first = await getResolvedTaskFormSchema(
        TaskEntityType.Suggestion,
        TaskCategory.MetadataUpdate,
        { payload: { suggestionType: 'Tag' } }
      );

      expect(first?.uiSchema).toBeDefined();

      if (first?.uiSchema) {
        first.uiSchema.suggestedValue = { 'ui:widget': 'textarea' };
      }

      const second = await getResolvedTaskFormSchema(
        TaskEntityType.Suggestion,
        TaskCategory.MetadataUpdate,
        { payload: { suggestionType: 'Tag' } }
      );

      expect(second?.uiSchema?.suggestedValue).toEqual({
        'ui:widget': 'tagSelector',
      });
    });

    it('falls back to the disambiguated FQN lookup when the stamped id is absent', async () => {
      stubByUrl([
        { match: isByNameUrl, data: tagSuggestionSchema },
        { match: isListUrl, data: { data: [] } },
      ]);

      const schema = await getResolvedTaskFormSchema(
        TaskEntityType.Suggestion,
        TaskCategory.MetadataUpdate,
        { payload: { suggestionType: 'Tag' } }
      );

      expect(schema).toEqual(tagSuggestionSchema);
      expect(callsTo(isByIdUrl)).toHaveLength(0);
      expect(callsTo(isByNameUrl)).toHaveLength(1);
    });

    it('falls back to the default schema when the stamped id fetch returns 404 and the payload signals Tag', async () => {
      // Suggestion has no built-in default, so a failed resolution returns
      // undefined; getResolvedTaskFormSchema then falls through to
      // getDefaultTaskFormSchema which returns undefined for Suggestion.
      (APIClient.get as jest.Mock).mockImplementation((url: string) =>
        Promise.reject(new Error(`Unexpected url: ${url}`))
      );

      const schema = await getResolvedTaskFormSchema(
        TaskEntityType.Suggestion,
        TaskCategory.MetadataUpdate,
        {
          taskFormSchemaId: 'gone-id',
          payload: { suggestionType: 'Tag' },
        }
      );

      expect(
        getDefaultTaskFormSchema(
          TaskEntityType.Suggestion,
          TaskCategory.MetadataUpdate
        )
      ).toBeUndefined();
      expect(schema).toBeUndefined();
      expect(callsTo(isByIdUrl)).toHaveLength(1);
    });

    it('continues to the name lookup when the stamped id fetch rejects', async () => {
      (APIClient.get as jest.Mock).mockImplementation((url: string) =>
        isByNameUrl(url)
          ? Promise.resolve(axiosResponse(tagSuggestionSchema))
          : Promise.reject(new Error(`Unexpected url: ${url}`))
      );

      const schema = await getResolvedTaskFormSchema(
        TaskEntityType.Suggestion,
        TaskCategory.MetadataUpdate,
        {
          taskFormSchemaId: 'gone-id',
          payload: { suggestionType: 'Tag' },
        }
      );

      expect(schema?.name).toBe('TagSuggestion');
      expect(callsTo(isByIdUrl)).toHaveLength(1);
      expect(callsTo(isByNameUrl)).toHaveLength(1);
    });

    it('uses the list query for non-Suggestion tasks (no payload branching)', async () => {
      stubByUrl([
        { match: isListUrl, data: { data: [descriptionUpdateSchema] } },
      ]);

      const schema = await getResolvedTaskFormSchema(
        TaskEntityType.DescriptionUpdate,
        TaskCategory.MetadataUpdate,
        { payload: { suggestionType: 'Tag' } }
      );

      expect(schema).toEqual(descriptionUpdateSchema);
      expect(callsTo(isByNameUrl)).toHaveLength(0);
      expect(callsTo(isListUrl)).toHaveLength(1);
    });

    it('keeps the backwards-compatible two-arg call shape working', async () => {
      stubByUrl([
        { match: isListUrl, data: { data: [descriptionUpdateSchema] } },
      ]);

      const schema = await getResolvedTaskFormSchema(
        TaskEntityType.DescriptionUpdate,
        TaskCategory.MetadataUpdate
      );

      expect(schema).toEqual(descriptionUpdateSchema);
      expect(callsTo(isListUrl)).toHaveLength(1);
      expect(callsTo(isListUrl)[0][1]).toMatchObject({
        params: {
          taskType: 'DescriptionUpdate',
          taskCategory: 'MetadataUpdate',
          limit: 1,
        },
      });
    });
  });
});
