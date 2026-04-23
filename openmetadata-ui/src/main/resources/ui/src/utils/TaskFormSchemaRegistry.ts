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

import { TaskFormSchema } from '../rest/taskFormSchemasAPI';
import { TaskCategory, TaskEntityType } from '../rest/tasksAPI';

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

/**
 * Look up the built-in default form schema for a task type/category combination.
 * Used as a fallback when no schema is configured server-side.
 */
export const getDefaultTaskFormSchema = (
  taskType: TaskEntityType,
  taskCategory: TaskCategory
): TaskFormSchema | undefined => {
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
