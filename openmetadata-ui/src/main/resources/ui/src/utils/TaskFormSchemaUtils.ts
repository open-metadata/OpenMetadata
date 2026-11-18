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
import { TaskAvailableTransition } from '../generated/entity/tasks/task';
import { TagLabel } from '../generated/type/tagLabel';
import {
  getTaskFormSchemaById,
  JsonSchemaObject,
  resolveTaskFormSchema,
  TaskFormSchema,
} from '../rest/taskFormSchemasAPI';
import {
  Task,
  TaskCategory,
  TaskEntityType,
  TaskPayload,
} from '../rest/tasksAPI';
import { isRecognizerFeedbackTask } from './TaskActionUtils';
import { getDefaultTaskFormSchema } from './TaskFormSchemaRegistry';
import { getNormalizedTaskPayload } from './TaskPayloadUtils';

export { getDefaultTaskFormSchema };

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

const TASK_FORM_SCHEMA_CACHE_MAX = 100;
const taskFormSchemaCache = new Map<
  string,
  Promise<TaskFormSchema | undefined>
>();

export interface TaskFormSchemaResolution {
  /**
   * Schema id stamped on the task by the backend's payload-aware resolver
   * (`TaskFormSchemaRepository#resolve` -> `Task.taskFormSchemaId`). Preferred
   * discriminator: when present, the schema is fetched by id, bypassing the
   * ambiguous type+category list query entirely.
   */
  taskFormSchemaId?: string;
  /**
   * Raw task payload. Read for Suggestion tasks to disambiguate the two seeded
   * Suggestion schemas (DescriptionSuggestion / TagSuggestion) by
   * `payload.suggestionType`, mirroring the backend's
   * `mapSuggestionTypeToSchema`. Ignored for non-Suggestion task types.
   */
  payload?: TaskPayload;
}

const normalizeSuggestionKey = (payload?: TaskPayload): string => {
  const suggestionType = payload?.suggestionType;

  return typeof suggestionType === 'string'
    ? suggestionType.trim().toLowerCase()
    : '';
};

export const getResolvedTaskFormSchema = async (
  taskType: TaskEntityType,
  taskCategory: TaskCategory,
  resolution?: TaskFormSchemaResolution
) => {
  // Cache key MUST include a discriminator. Suggestion tasks share one
  // taskType+taskCategory binding, so a type+category-only key would cache
  // the first-resolved variant (deterministically DescriptionSuggestion via
  // the list endpoint) and reuse it for every other variant in-session,
  // rendering tag suggestions with the description widget/label.
  const cacheKey = `${taskType}::${taskCategory}::${
    resolution?.taskFormSchemaId ?? ''
  }::${normalizeSuggestionKey(resolution?.payload)}`;
  const existing = taskFormSchemaCache.get(cacheKey);

  if (existing) {
    return cloneDeep(await existing);
  }

  const resolverPromise = (async () => {
    try {
      // Prefer the schema the backend already chose and stamped on the task:
      // it is the most precise signal (covers future non-Suggestion variants
      // that may share a binding too) and avoids the ambiguous list query.
      if (resolution?.taskFormSchemaId) {
        // A deleted or replaced schema must not skip the name/type fallback below.
        const byId = await getTaskFormSchemaById(
          resolution.taskFormSchemaId
        ).catch(() => undefined);

        if (byId) {
          return byId;
        }
      }

      // Fall back to the (now payload-aware for Suggestion) list resolver, then
      // the built-in defaults if the server has no configured schema.
      const resolvedSchema = await resolveTaskFormSchema(
        taskType,
        taskCategory,
        resolution?.payload
      );

      return resolvedSchema ?? getDefaultTaskFormSchema(taskType, taskCategory);
    } catch {
      return getDefaultTaskFormSchema(taskType, taskCategory);
    }
  })();

  if (taskFormSchemaCache.size >= TASK_FORM_SCHEMA_CACHE_MAX) {
    const oldestKey = taskFormSchemaCache.keys().next().value;
    if (oldestKey !== undefined) {
      taskFormSchemaCache.delete(oldestKey);
    }
  }
  taskFormSchemaCache.set(cacheKey, resolverPromise);

  return cloneDeep(await resolverPromise);
};

/**
 * Clears the in-memory task form schema cache. Intended for tests and for
 * callers that invalidate configured schemas mid-session.
 */
export const __resetTaskFormSchemaCache = () => {
  taskFormSchemaCache.clear();
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
      (transitionConfig as Record<string, unknown> | undefined)?.requiresComment
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
