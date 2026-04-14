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

import { cloneDeep, uniqBy } from 'lodash';
import { TagLabel } from '../generated/type/tagLabel';
import {
  JsonSchemaObject,
  resolveTaskFormSchema,
  TaskFormSchema,
} from '../rest/taskFormSchemasAPI';
import {
  Task,
  TaskAvailableTransition,
  TaskCategory,
  TaskEntityType,
  TaskPayload,
} from '../rest/tasksAPI';
import {
  getNormalizedTaskPayload,
  isRecognizerFeedbackTask,
} from './TasksUtils';

export type TaskFormHandlerType =
  | 'descriptionUpdate'
  | 'tagUpdate'
  | 'approval'
  | 'incident'
  | 'feedbackApproval'
  | 'ownershipUpdate'
  | 'tierUpdate'
  | 'domainUpdate'
  | 'suggestion'
  | 'custom';

export type TaskFormHandlerConfig = {
  type: TaskFormHandlerType;
  permission?: string;
  fieldPathField?: string;
  valueField?: string;
  currentTagsField?: string;
  addTagsField?: string;
  removeTagsField?: string;
  approvedValue?: string;
  rejectedValue?: string;
};

const taskFormSchemaCache = new Map<
  string,
  Promise<TaskFormSchema | undefined>
>();
const taskCategoryValues = {
  Approval: 'Approval' as TaskCategory,
  DataAccess: 'DataAccess' as TaskCategory,
  MetadataUpdate: 'MetadataUpdate' as TaskCategory,
  Incident: 'Incident' as TaskCategory,
  Review: 'Review' as TaskCategory,
  Custom: 'Custom' as TaskCategory,
};
const taskCategories = TaskCategory ?? taskCategoryValues;

const descriptionUpdateSchema: TaskFormSchema = {
  name: 'DescriptionUpdate',
  displayName: 'Description Update',
  taskType: TaskEntityType.DescriptionUpdate,
  taskCategory: taskCategories.MetadataUpdate,
  formSchema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      fieldPath: { type: 'string', title: 'Field Path' },
      currentDescription: { type: 'string', title: 'Current Description' },
      newDescription: { type: 'string', title: 'New Description' },
      source: { type: 'string', title: 'Source' },
      confidence: { type: 'number', title: 'Confidence' },
    },
  },
  uiSchema: {
    'ui:handler': {
      type: 'descriptionUpdate',
      permission: 'EDIT_DESCRIPTION',
      fieldPathField: 'fieldPath',
      valueField: 'newDescription',
    },
    'ui:editablePayload': {
      fieldPathField: 'fieldPath',
      currentValueField: 'currentDescription',
      editedValueField: 'newDescription',
    },
    'ui:resolution': {
      mode: 'field',
      valueField: 'newDescription',
    },
    'ui:execution': {
      approve: {
        actions: [
          {
            type: 'setDescription',
            fieldPathField: 'fieldPath',
            valueField: 'newDescription',
          },
        ],
      },
      reject: {
        actions: [],
      },
    },
    'ui:order': [
      'newDescription',
      'fieldPath',
      'currentDescription',
      'source',
      'confidence',
    ],
    fieldPath: { 'ui:widget': 'hidden' },
    currentDescription: { 'ui:widget': 'hidden' },
    source: { 'ui:widget': 'hidden' },
    confidence: { 'ui:widget': 'hidden' },
    newDescription: { 'ui:widget': 'descriptionTabs' },
  },
};

const tagUpdateSchema: TaskFormSchema = {
  name: 'TagUpdate',
  displayName: 'Tag Update',
  taskType: TaskEntityType.TagUpdate,
  taskCategory: taskCategories.MetadataUpdate,
  formSchema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      fieldPath: { type: 'string', title: 'Field Path' },
      currentTags: {
        type: 'array',
        title: 'Current Tags',
        items: { type: 'object', additionalProperties: true },
      },
      tagsToAdd: {
        type: 'array',
        title: 'Tags To Add',
        items: { type: 'object', additionalProperties: true },
      },
      tagsToRemove: {
        type: 'array',
        title: 'Tags To Remove',
        items: { type: 'object', additionalProperties: true },
      },
      operation: { type: 'string', title: 'Operation' },
      source: { type: 'string', title: 'Source' },
      confidence: { type: 'number', title: 'Confidence' },
    },
  },
  uiSchema: {
    'ui:handler': {
      type: 'tagUpdate',
      permission: 'EDIT_TAGS',
      fieldPathField: 'fieldPath',
      currentTagsField: 'currentTags',
      addTagsField: 'tagsToAdd',
      removeTagsField: 'tagsToRemove',
    },
    'ui:editablePayload': {
      fieldPathField: 'fieldPath',
      currentTagsField: 'currentTags',
      addTagsField: 'tagsToAdd',
      removeTagsField: 'tagsToRemove',
    },
    'ui:resolution': {
      mode: 'tagMerge',
      currentField: 'currentTags',
      addField: 'tagsToAdd',
      removeField: 'tagsToRemove',
    },
    'ui:execution': {
      approve: {
        actions: [
          {
            type: 'mergeTags',
            fieldPathField: 'fieldPath',
            currentTagsField: 'currentTags',
            addTagsField: 'tagsToAdd',
            removeTagsField: 'tagsToRemove',
          },
        ],
      },
      reject: {
        actions: [],
      },
    },
    'ui:order': [
      'tagsToAdd',
      'fieldPath',
      'currentTags',
      'tagsToRemove',
      'operation',
      'source',
      'confidence',
    ],
    fieldPath: { 'ui:widget': 'hidden' },
    currentTags: { 'ui:widget': 'hidden' },
    tagsToRemove: { 'ui:widget': 'hidden' },
    operation: { 'ui:widget': 'hidden' },
    source: { 'ui:widget': 'hidden' },
    confidence: { 'ui:widget': 'hidden' },
    tagsToAdd: { 'ui:widget': 'tagsTabs' },
  },
};

const approvalSchema: TaskFormSchema = {
  name: 'Approval',
  displayName: 'Approval',
  taskType: TaskEntityType.RequestApproval,
  taskCategory: taskCategories.Approval,
  formSchema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      comment: { type: 'string', title: 'Comment' },
    },
  },
  uiSchema: {
    'ui:handler': {
      type: 'approval',
      permission: 'EDIT_ALL',
    },
    'ui:resolution': {
      mode: 'payload',
    },
    comment: { 'ui:widget': 'textarea' },
  },
};

const incidentResolutionSchema: TaskFormSchema = {
  name: 'IncidentResolution',
  displayName: 'Incident Resolution',
  taskType: TaskEntityType.TestCaseResolution,
  taskCategory: taskCategories.Incident,
  formSchema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      rootCause: { type: 'string', title: 'Root Cause' },
      resolution: { type: 'string', title: 'Resolution' },
    },
  },
  uiSchema: {
    'ui:handler': {
      type: 'incident',
    },
    'ui:resolution': {
      mode: 'payload',
    },
    rootCause: { 'ui:widget': 'textarea' },
    resolution: { 'ui:widget': 'textarea' },
  },
};

const ownershipUpdateSchema: TaskFormSchema = {
  name: 'OwnershipUpdate',
  displayName: 'Ownership Update',
  taskType: TaskEntityType.OwnershipUpdate,
  taskCategory: taskCategories.MetadataUpdate,
  formSchema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      currentOwners: {
        type: 'array',
        title: 'Current Owners',
        items: { type: 'object' },
      },
      newOwners: {
        type: 'array',
        title: 'New Owners',
        items: { type: 'object' },
      },
    },
  },
  uiSchema: {
    'ui:handler': {
      type: 'ownershipUpdate',
      permission: 'EDIT_OWNERS',
    },
    'ui:resolution': {
      mode: 'payload',
    },
    'ui:execution': {
      approve: {
        actions: [{ type: 'replaceOwners', payloadField: 'newOwners' }],
      },
      reject: { actions: [] },
    },
    currentOwners: { 'ui:widget': 'hidden' },
    newOwners: { 'ui:widget': 'textarea' },
  },
};

const tierUpdateSchema: TaskFormSchema = {
  name: 'TierUpdate',
  displayName: 'Tier Update',
  taskType: TaskEntityType.TierUpdate,
  taskCategory: taskCategories.MetadataUpdate,
  formSchema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      currentTier: { type: 'object', title: 'Current Tier' },
      newTier: { type: 'object', title: 'New Tier' },
    },
  },
  uiSchema: {
    'ui:handler': {
      type: 'tierUpdate',
      permission: 'EDIT_TIER',
    },
    'ui:resolution': {
      mode: 'payload',
    },
    'ui:execution': {
      approve: {
        actions: [{ type: 'applyTier', payloadField: 'newTier' }],
      },
      reject: { actions: [] },
    },
    currentTier: { 'ui:widget': 'hidden' },
    newTier: { 'ui:widget': 'textarea' },
  },
};

const domainUpdateSchema: TaskFormSchema = {
  name: 'DomainUpdate',
  displayName: 'Domain Update',
  taskType: TaskEntityType.DomainUpdate,
  taskCategory: taskCategories.MetadataUpdate,
  formSchema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      currentDomain: { type: 'object', title: 'Current Domain' },
      newDomain: { type: 'object', title: 'New Domain' },
    },
  },
  uiSchema: {
    'ui:handler': {
      type: 'domainUpdate',
      permission: 'EDIT_ALL',
    },
    'ui:resolution': {
      mode: 'payload',
    },
    'ui:execution': {
      approve: {
        actions: [{ type: 'replaceDomains', payloadField: 'newDomain' }],
      },
      reject: { actions: [] },
    },
    currentDomain: { 'ui:widget': 'hidden' },
    newDomain: { 'ui:widget': 'textarea' },
  },
};

const customTaskSchema: TaskFormSchema = {
  name: 'CustomTask',
  displayName: 'Custom Task',
  taskType: TaskEntityType.CustomTask,
  taskCategory: taskCategories.Custom,
  formSchema: {
    type: 'object',
    additionalProperties: true,
    properties: {},
  },
  uiSchema: {
    'ui:handler': {
      type: 'custom',
    },
    'ui:resolution': {
      mode: 'payload',
    },
  },
};

export const getDefaultTaskFormSchema = (
  taskType: TaskEntityType,
  taskCategory: TaskCategory
) => {
  if (
    taskType === TaskEntityType.DescriptionUpdate &&
    taskCategory === taskCategories.MetadataUpdate
  ) {
    return descriptionUpdateSchema;
  }

  if (
    taskType === TaskEntityType.TagUpdate &&
    taskCategory === taskCategories.MetadataUpdate
  ) {
    return tagUpdateSchema;
  }

  if (
    [TaskEntityType.GlossaryApproval, TaskEntityType.RequestApproval].includes(
      taskType
    ) &&
    taskCategory === taskCategories.Approval
  ) {
    return {
      ...approvalSchema,
      taskType,
      name: taskType,
      fullyQualifiedName: taskType,
      displayName: taskType,
    };
  }

  if (
    [
      TaskEntityType.TestCaseResolution,
      TaskEntityType.IncidentResolution,
    ].includes(taskType) &&
    taskCategory === taskCategories.Incident
  ) {
    return {
      ...incidentResolutionSchema,
      taskType,
      name: taskType,
      fullyQualifiedName: taskType,
      displayName: taskType,
    };
  }

  if (
    taskType === TaskEntityType.OwnershipUpdate &&
    taskCategory === taskCategories.MetadataUpdate
  ) {
    return ownershipUpdateSchema;
  }

  if (
    taskType === TaskEntityType.TierUpdate &&
    taskCategory === taskCategories.MetadataUpdate
  ) {
    return tierUpdateSchema;
  }

  if (
    taskType === TaskEntityType.DomainUpdate &&
    taskCategory === taskCategories.MetadataUpdate
  ) {
    return domainUpdateSchema;
  }

  if (
    taskType === TaskEntityType.CustomTask &&
    taskCategory === taskCategories.Custom
  ) {
    return customTaskSchema;
  }

  return undefined;
};

export const getResolvedTaskFormSchema = async (
  taskType: TaskEntityType,
  taskCategory: TaskCategory
) => {
  const cacheKey = `${taskType}::${taskCategory}`;
  const existing = taskFormSchemaCache.get(cacheKey);

  if (existing) {
    return cloneDeep(await existing);
  }

  const resolverPromise = (async () => {
    try {
      const resolvedSchema = await resolveTaskFormSchema(
        taskType,
        taskCategory
      );

      return resolvedSchema ?? getDefaultTaskFormSchema(taskType, taskCategory);
    } catch {
      return getDefaultTaskFormSchema(taskType, taskCategory);
    }
  })();

  taskFormSchemaCache.set(cacheKey, resolverPromise);

  return cloneDeep(await resolverPromise);
};

const getTransitionFormConfig = (
  taskFormSchema?: TaskFormSchema,
  transition?: Pick<TaskAvailableTransition, 'id' | 'formRef'>
) => {
  if (!taskFormSchema?.transitionForms || !transition) {
    return undefined;
  }

  const transitionKey = transition.formRef ?? transition.id;

  if (!transitionKey) {
    return undefined;
  }

  return taskFormSchema.transitionForms[transitionKey] as
    | JsonSchemaObject
    | undefined;
};

const ensureTransitionCommentFields = (
  formSchema: JsonSchemaObject | undefined,
  uiSchema: JsonSchemaObject | undefined,
  requiresComment?: boolean
) => {
  if (!requiresComment) {
    return { formSchema, uiSchema };
  }

  const nextFormSchema = cloneDeep(
    formSchema ?? {
      type: 'object',
      properties: {},
    }
  );
  const nextUiSchema = cloneDeep(uiSchema ?? {});
  const properties =
    (nextFormSchema.properties as
      | Record<string, JsonSchemaObject>
      | undefined) ?? {};

  nextFormSchema.type = nextFormSchema.type ?? 'object';
  nextFormSchema.properties = {
    ...properties,
    comment: properties.comment ?? {
      type: 'string',
      title: 'Comment',
    },
  };

  nextUiSchema.comment = nextUiSchema.comment ?? {
    'ui:widget': 'textarea',
  };

  if (Array.isArray(nextUiSchema['ui:order'])) {
    const uiOrder = nextUiSchema['ui:order'] as string[];

    if (!uiOrder.includes('comment')) {
      nextUiSchema['ui:order'] = [...uiOrder, 'comment'];
    }
  }

  return {
    formSchema: nextFormSchema,
    uiSchema: nextUiSchema,
  };
};

const getTransitionRequiresComment = (
  transitionConfig: JsonSchemaObject | undefined,
  transition?: Pick<TaskAvailableTransition, 'requiresComment'>
): boolean =>
  Boolean(
    transition?.requiresComment ||
      (transitionConfig as Record<string, unknown> | undefined)
        ?.requiresComment
  );

export const getTaskTransitionFormSchema = (
  taskFormSchema?: TaskFormSchema,
  transition?: Pick<
    TaskAvailableTransition,
    'id' | 'formRef' | 'requiresComment'
  >
) => {
  const transitionConfig = getTransitionFormConfig(taskFormSchema, transition);
  // Only fall back to the global task form when the transition explicitly
  // declares a formRef. Transitions without formRef (e.g. ack, assign) don't
  // need a form — falling back to the global resolve form would wrongly show
  // root-cause/resolution fields for every action.
  const transitionSchema =
    (transitionConfig?.formSchema as JsonSchemaObject | undefined) ??
    (transition?.formRef ? taskFormSchema?.formSchema : undefined);

  return ensureTransitionCommentFields(
    transitionSchema,
    undefined,
    getTransitionRequiresComment(transitionConfig, transition)
  ).formSchema;
};

export const getTaskTransitionUiSchema = (
  taskFormSchema?: TaskFormSchema,
  transition?: Pick<
    TaskAvailableTransition,
    'id' | 'formRef' | 'requiresComment'
  >
) => {
  const transitionConfig = getTransitionFormConfig(taskFormSchema, transition);
  const transitionUiSchema =
    (transitionConfig?.uiSchema as JsonSchemaObject | undefined) ??
    (transition?.formRef ? taskFormSchema?.uiSchema : undefined);

  return ensureTransitionCommentFields(
    undefined,
    transitionUiSchema,
    getTransitionRequiresComment(transitionConfig, transition)
  ).uiSchema;
};

export const hasTaskFormFields = (schema?: JsonSchemaObject) => {
  const properties = schema?.properties;

  return Boolean(
    properties &&
      typeof properties === 'object' &&
      Object.keys(properties).length > 0
  );
};

const DEFAULT_APPROVAL_VALUES = {
  approvedValue: 'approved',
  rejectedValue: 'rejected',
};

const getDefaultTaskFormHandler = (task: Task): TaskFormHandlerConfig => {
  if (isRecognizerFeedbackTask(task)) {
    return {
      type: 'feedbackApproval',
      permission: 'EDIT_ALL',
      ...DEFAULT_APPROVAL_VALUES,
    };
  }

  switch (task.type) {
    case TaskEntityType.DescriptionUpdate:
      return {
        type: 'descriptionUpdate',
        permission: 'EDIT_DESCRIPTION',
        fieldPathField: 'fieldPath',
        valueField: 'newDescription',
      };
    case TaskEntityType.TagUpdate:
      return {
        type: 'tagUpdate',
        permission: 'EDIT_TAGS',
        fieldPathField: 'fieldPath',
        currentTagsField: 'currentTags',
        addTagsField: 'tagsToAdd',
        removeTagsField: 'tagsToRemove',
      };
    case TaskEntityType.GlossaryApproval:
    case TaskEntityType.RequestApproval:
      return {
        type: 'approval',
        permission: 'EDIT_ALL',
        ...DEFAULT_APPROVAL_VALUES,
      };
    case TaskEntityType.TestCaseResolution:
    case TaskEntityType.IncidentResolution:
      return {
        type: 'incident',
      };
    case TaskEntityType.OwnershipUpdate:
      return {
        type: 'ownershipUpdate',
        permission: 'EDIT_OWNERS',
      };
    case TaskEntityType.TierUpdate:
      return {
        type: 'tierUpdate',
        permission: 'EDIT_TIER',
      };
    case TaskEntityType.DomainUpdate:
      return {
        type: 'domainUpdate',
        permission: 'EDIT_ALL',
      };
    case TaskEntityType.Suggestion:
      return {
        type: 'suggestion',
      };
    default:
      return {
        type: 'custom',
      };
  }
};

export const getTaskFormHandlerConfig = (
  task: Task,
  uiSchema?: JsonSchemaObject
): TaskFormHandlerConfig => {
  const defaults = getDefaultTaskFormHandler(task);
  const configured =
    (uiSchema?.['ui:handler'] as Partial<TaskFormHandlerConfig> | undefined) ??
    {};

  return {
    ...defaults,
    ...configured,
    type: configured.type ?? defaults.type,
    approvedValue:
      configured.approvedValue ?? defaults.approvedValue ?? 'approved',
    rejectedValue:
      configured.rejectedValue ?? defaults.rejectedValue ?? 'rejected',
  };
};

type TaskResolutionConfig = {
  mode?: 'field' | 'tagMerge' | 'payload';
  valueField?: string;
  currentField?: string;
  addField?: string;
  removeField?: string;
};

type EditablePayloadConfig = {
  fieldPathField?: string;
  currentValueField?: string;
  editedValueField?: string;
  currentTagsField?: string;
  addTagsField?: string;
  removeTagsField?: string;
};

const getResolutionConfig = (uiSchema?: JsonSchemaObject) =>
  (uiSchema?.['ui:resolution'] as TaskResolutionConfig | undefined) ?? {};

const getEditablePayloadConfig = (uiSchema?: JsonSchemaObject) =>
  (uiSchema?.['ui:editablePayload'] as EditablePayloadConfig | undefined) ?? {};

const getSchemaPropertyDefaults = (schema?: JsonSchemaObject) => {
  const properties =
    (schema?.properties as Record<string, JsonSchemaObject> | undefined) ?? {};

  return Object.entries(properties).reduce<Record<string, unknown>>(
    (acc, [fieldName, fieldSchema]) => {
      if (Object.prototype.hasOwnProperty.call(fieldSchema, 'default')) {
        acc[fieldName] = cloneDeep(fieldSchema.default);
      }

      return acc;
    },
    {}
  );
};

export const applyTaskFormSchemaDefaults = (
  payload: Record<string, unknown>,
  schema?: JsonSchemaObject
) => ({
  ...getSchemaPropertyDefaults(schema),
  ...payload,
});

export const getEditableTaskPayload = (
  task: Task,
  uiSchema?: JsonSchemaObject
): TaskPayload => {
  const normalizedPayload = getNormalizedTaskPayload(task);
  const payload = cloneDeep(task.payload ?? {});
  const editableConfig = getEditablePayloadConfig(uiSchema);
  const fieldPathField = editableConfig.fieldPathField ?? 'fieldPath';
  const currentValueField =
    editableConfig.currentValueField ?? 'currentDescription';
  const editedValueField = editableConfig.editedValueField ?? 'newDescription';
  const currentTagsField = editableConfig.currentTagsField ?? 'currentTags';
  const addTagsField = editableConfig.addTagsField ?? 'tagsToAdd';
  const removeTagsField = editableConfig.removeTagsField ?? 'tagsToRemove';

  if (editableConfig.currentValueField || editableConfig.editedValueField) {
    return {
      ...payload,
      [fieldPathField]:
        payload[fieldPathField] ??
        payload.fieldPath ??
        payload.field ??
        normalizedPayload.fieldPath,
      [currentValueField]:
        payload[currentValueField] ??
        payload.currentDescription ??
        payload.currentValue,
      [editedValueField]:
        payload[editedValueField] ??
        payload.newDescription ??
        payload.suggestedValue,
    };
  }

  if (
    editableConfig.currentTagsField ||
    editableConfig.addTagsField ||
    editableConfig.removeTagsField
  ) {
    const currentTags =
      (payload[currentTagsField] as TagLabel[] | undefined) ??
      (payload.currentTags as TagLabel[] | undefined) ??
      normalizedPayload.currentTags;
    const tagsToAdd =
      (payload[addTagsField] as TagLabel[] | undefined) ??
      (payload.tagsToAdd as TagLabel[] | undefined) ??
      normalizedPayload.suggestedTags.filter(
        (tag) =>
          !currentTags.some((currentTag) => currentTag.tagFQN === tag.tagFQN)
      );
    const tagsToRemove =
      (payload[removeTagsField] as TagLabel[] | undefined) ??
      (payload.tagsToRemove as TagLabel[] | undefined) ??
      currentTags.filter(
        (tag) =>
          !normalizedPayload.suggestedTags.some(
            (suggestedTag) => suggestedTag.tagFQN === tag.tagFQN
          )
      );

    return {
      ...payload,
      [fieldPathField]:
        payload[fieldPathField] ??
        payload.fieldPath ??
        payload.field ??
        normalizedPayload.fieldPath,
      [currentTagsField]: currentTags,
      [addTagsField]: tagsToAdd,
      [removeTagsField]: tagsToRemove,
    };
  }

  if (task.type === TaskEntityType.DescriptionUpdate) {
    return {
      ...payload,
      [fieldPathField]:
        payload[fieldPathField] ??
        payload.fieldPath ??
        payload.field ??
        normalizedPayload.fieldPath,
      [currentValueField]:
        payload[currentValueField] ??
        payload.currentDescription ??
        payload.currentValue ??
        normalizedPayload.currentDescription,
      [editedValueField]:
        payload[editedValueField] ??
        payload.newDescription ??
        payload.suggestedValue ??
        normalizedPayload.newDescription,
    };
  }

  if (task.type === TaskEntityType.TagUpdate) {
    const currentTags =
      (payload[currentTagsField] as TagLabel[] | undefined) ??
      (payload.currentTags as TagLabel[] | undefined) ??
      normalizedPayload.currentTags;
    const tagsToAdd =
      (payload[addTagsField] as TagLabel[] | undefined) ??
      (payload.tagsToAdd as TagLabel[] | undefined) ??
      normalizedPayload.suggestedTags.filter(
        (tag) =>
          !currentTags.some((currentTag) => currentTag.tagFQN === tag.tagFQN)
      );
    const tagsToRemove =
      (payload[removeTagsField] as TagLabel[] | undefined) ??
      (payload.tagsToRemove as TagLabel[] | undefined) ??
      currentTags.filter(
        (tag) =>
          !normalizedPayload.suggestedTags.some(
            (suggestedTag) => suggestedTag.tagFQN === tag.tagFQN
          )
      );

    return {
      ...payload,
      [fieldPathField]:
        payload[fieldPathField] ??
        payload.fieldPath ??
        payload.field ??
        normalizedPayload.fieldPath,
      [currentTagsField]: currentTags,
      [addTagsField]: tagsToAdd,
      [removeTagsField]: tagsToRemove,
    };
  }

  return payload;
};

export const getTaskResolutionNewValue = (
  task: Task,
  payload: TaskPayload,
  uiSchema?: JsonSchemaObject
) => {
  const resolutionConfig = getResolutionConfig(uiSchema);

  if (resolutionConfig.mode === 'payload') {
    return undefined;
  }

  if (resolutionConfig.mode === 'field') {
    return String(
      payload[resolutionConfig.valueField ?? 'newDescription'] ??
        payload.suggestedValue ??
        ''
    );
  }

  if (resolutionConfig.mode === 'tagMerge') {
    const currentTags =
      (payload[resolutionConfig.currentField ?? 'currentTags'] as
        | TagLabel[]
        | undefined) ?? [];
    const tagsToAdd =
      (payload[resolutionConfig.addField ?? 'tagsToAdd'] as
        | TagLabel[]
        | undefined) ?? [];
    const tagsToRemove =
      (payload[resolutionConfig.removeField ?? 'tagsToRemove'] as
        | TagLabel[]
        | undefined) ?? [];
    const removedTagFqns = new Set(tagsToRemove.map((tag) => tag.tagFQN));
    const updatedTags = uniqBy(
      [
        ...currentTags.filter((tag) => !removedTagFqns.has(tag.tagFQN)),
        ...tagsToAdd,
      ],
      'tagFQN'
    );

    return JSON.stringify(updatedTags);
  }

  if (task.type === TaskEntityType.DescriptionUpdate) {
    return String(payload.newDescription ?? payload.suggestedValue ?? '');
  }

  if (task.type === TaskEntityType.TagUpdate) {
    const currentTags = (payload.currentTags as TagLabel[] | undefined) ?? [];
    const tagsToAdd = (payload.tagsToAdd as TagLabel[] | undefined) ?? [];
    const tagsToRemove = (payload.tagsToRemove as TagLabel[] | undefined) ?? [];
    const removedTagFqns = new Set(tagsToRemove.map((tag) => tag.tagFQN));
    const updatedTags = uniqBy(
      [
        ...currentTags.filter((tag) => !removedTagFqns.has(tag.tagFQN)),
        ...tagsToAdd,
      ],
      'tagFQN'
    );

    return JSON.stringify(updatedTags);
  }

  if (typeof payload.suggestedValue === 'string') {
    return payload.suggestedValue;
  }

  return undefined;
};

export const shouldRequireTaskResolutionValue = (
  uiSchema?: JsonSchemaObject
) => {
  const resolutionConfig = getResolutionConfig(uiSchema);

  return (
    resolutionConfig.mode === 'field' || resolutionConfig.mode === 'tagMerge'
  );
};
