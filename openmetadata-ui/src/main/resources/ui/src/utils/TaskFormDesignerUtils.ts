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

import { cloneDeep } from 'lodash';
import { JsonSchemaObject, TaskFormSchema } from '../rest/taskFormSchemasAPI';

export type TaskFormDesignerFieldType =
  | 'shortText'
  | 'longText'
  | 'number'
  | 'boolean'
  | 'singleSelect'
  | 'multiSelect'
  | 'json';

export interface TaskFormDesignerField {
  key: string;
  name: string;
  label: string;
  description?: string;
  type: TaskFormDesignerFieldType;
  required: boolean;
  hidden: boolean;
  options: string[];
  schemaType?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  widget?: string;
  uiConfig?: JsonSchemaObject;
  property?: JsonSchemaObject;
}

export interface TaskFormDesignerTransition {
  key: string;
  transitionId: string;
  fields: TaskFormDesignerField[];
  config?: JsonSchemaObject;
}

export interface TaskFormDesignerStageMapping {
  key: string;
  stageId: string;
  taskStatus: string;
}

const DEFAULT_FORM_SCHEMA: JsonSchemaObject = {
  type: 'object',
  additionalProperties: true,
  properties: {},
};

const createDesignerKey = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const getObjectRecord = (
  value?: JsonSchemaObject
): Record<string, JsonSchemaObject> =>
  (value?.properties as Record<string, JsonSchemaObject> | undefined) ?? {};

const getRequiredFields = (value?: JsonSchemaObject) =>
  new Set(Array.isArray(value?.required) ? (value.required as string[]) : []);

const getFieldWidget = (
  fieldName: string,
  uiSchema?: JsonSchemaObject
): string | undefined =>
  (uiSchema?.[fieldName] as Record<string, unknown> | undefined)?.[
    'ui:widget'
  ] as string | undefined;

const inferFieldType = (
  property: JsonSchemaObject,
  widget?: string
): TaskFormDesignerFieldType => {
  if (property.type === 'boolean') {
    return 'boolean';
  }

  if (property.type === 'number' || property.type === 'integer') {
    return 'number';
  }

  if (
    property.type === 'array' &&
    Array.isArray((property.items as JsonSchemaObject | undefined)?.enum)
  ) {
    return 'multiSelect';
  }

  if (Array.isArray(property.enum)) {
    return 'singleSelect';
  }

  if (property.type === 'object' || property.type === 'array') {
    return 'json';
  }

  if (widget === 'textarea') {
    return 'longText';
  }

  return 'shortText';
};

const getFieldOptions = (property: JsonSchemaObject) => {
  if (Array.isArray(property.enum)) {
    return property.enum.filter(
      (value): value is string => typeof value === 'string'
    );
  }

  if (
    property.type === 'array' &&
    Array.isArray((property.items as JsonSchemaObject | undefined)?.enum)
  ) {
    return ((property.items as JsonSchemaObject).enum as unknown[]).filter(
      (value): value is string => typeof value === 'string'
    );
  }

  return [];
};

type FieldPropertyBuilder = (
  property: JsonSchemaObject,
  field: TaskFormDesignerField
) => void;

const applyStringProperty: FieldPropertyBuilder = (property) => {
  property.type = 'string';
  delete property.enum;
  delete property.items;
};

const FIELD_PROPERTY_BUILDERS: Partial<
  Record<TaskFormDesignerFieldType, FieldPropertyBuilder>
> = {
  longText: applyStringProperty,
  shortText: applyStringProperty,
  number: (property) => {
    property.type = 'number';
    delete property.enum;
    delete property.items;
  },
  boolean: (property) => {
    property.type = 'boolean';
    delete property.enum;
    delete property.items;
  },
  singleSelect: (property, field) => {
    property.type = 'string';
    property.enum = field.options.filter(Boolean);
    delete property.items;
  },
  multiSelect: (property, field) => {
    property.type = 'array';
    property.items = {
      type: 'string',
      enum: field.options.filter(Boolean),
    };
    delete property.enum;
  },
  json: (property, field) => {
    property.type = field.schemaType ?? property.type ?? 'object';
    delete property.enum;

    if (property.type === 'array') {
      property.items = (property.items as JsonSchemaObject | undefined) ?? {
        type: 'string',
      };
    } else if (
      property.type === 'object' &&
      !Object.prototype.hasOwnProperty.call(property, 'properties') &&
      !Object.prototype.hasOwnProperty.call(property, 'additionalProperties')
    ) {
      property.additionalProperties = true;
    }
  },
};

const buildFieldProperty = (field: TaskFormDesignerField) => {
  const nextProperty = cloneDeep(field.property ?? {});

  nextProperty.title = field.label || field.name;

  if (field.description) {
    nextProperty.description = field.description;
  } else {
    delete nextProperty.description;
  }

  FIELD_PROPERTY_BUILDERS[field.type]?.(nextProperty, field);

  return nextProperty;
};

const resolveUiWidget = (field: TaskFormDesignerField): string | undefined => {
  if (field.hidden) {
    return 'hidden';
  }

  if (field.widget && field.widget !== 'hidden') {
    return field.widget;
  }

  return field.type === 'longText' || field.type === 'json'
    ? 'textarea'
    : undefined;
};

const buildFieldUiSchema = (field: TaskFormDesignerField) => {
  const nextUiConfig = cloneDeep(field.uiConfig ?? {});
  const widget = resolveUiWidget(field);

  if (widget) {
    nextUiConfig['ui:widget'] = widget;
  } else {
    delete nextUiConfig['ui:widget'];
  }

  if (!widget && !Object.keys(nextUiConfig).length) {
    return undefined;
  }

  return nextUiConfig;
};

const buildUiSchema = (
  fields: TaskFormDesignerField[],
  baseUiSchema?: JsonSchemaObject
) => {
  const nextUiSchema = cloneDeep(baseUiSchema ?? {});

  Object.keys(nextUiSchema).forEach((key) => {
    if (!key.startsWith('ui:')) {
      delete nextUiSchema[key];
    }
  });

  const fieldOrder: string[] = [];

  fields.forEach((field) => {
    const fieldName = field.name.trim();

    if (!fieldName) {
      return;
    }

    fieldOrder.push(fieldName);
    const fieldUiSchema = buildFieldUiSchema(field);

    if (fieldUiSchema) {
      nextUiSchema[fieldName] = fieldUiSchema;
    }
  });

  if (fieldOrder.length) {
    nextUiSchema['ui:order'] = fieldOrder;
  } else {
    delete nextUiSchema['ui:order'];
  }

  return nextUiSchema;
};

export const stringifyDesignerJson = (value: unknown) =>
  JSON.stringify(value ?? {}, null, 2);

export const createEmptyDesignerField = (): TaskFormDesignerField => ({
  key: createDesignerKey('field'),
  name: '',
  label: '',
  description: '',
  type: 'shortText',
  required: false,
  hidden: false,
  options: [],
  schemaType: 'string',
});

export const createEmptyDesignerTransition =
  (): TaskFormDesignerTransition => ({
    key: createDesignerKey('transition'),
    transitionId: '',
    fields: [createEmptyDesignerField()],
  });

export const createEmptyStageMapping = (): TaskFormDesignerStageMapping => ({
  key: createDesignerKey('stage'),
  stageId: '',
  taskStatus: '',
});

export const parseSchemaToDesignerFields = (
  formSchema?: JsonSchemaObject,
  uiSchema?: JsonSchemaObject
): TaskFormDesignerField[] => {
  const properties = getObjectRecord(formSchema);
  const requiredFields = getRequiredFields(formSchema);
  const orderedFields = Array.isArray(uiSchema?.['ui:order'])
    ? (uiSchema?.['ui:order'] as string[])
    : Object.keys(properties);
  const remainingFields = Object.keys(properties).filter(
    (fieldName) => !orderedFields.includes(fieldName)
  );

  return [...orderedFields, ...remainingFields]
    .filter((fieldName) => fieldName in properties)
    .map((fieldName) => {
      const property = cloneDeep(properties[fieldName]);
      const uiConfig = cloneDeep(
        (uiSchema?.[fieldName] as JsonSchemaObject | undefined) ?? {}
      );
      const widget = getFieldWidget(fieldName, uiSchema);
      const fieldType = inferFieldType(property, widget);

      return {
        key: createDesignerKey(fieldName),
        name: fieldName,
        label: (property.title as string | undefined) ?? fieldName,
        description: property.description as string | undefined,
        type: fieldType,
        required: requiredFields.has(fieldName),
        hidden: widget === 'hidden',
        options: getFieldOptions(property),
        schemaType:
          (property.type as
            | 'string'
            | 'number'
            | 'boolean'
            | 'object'
            | 'array'
            | undefined) ?? 'string',
        widget,
        uiConfig,
        property,
      };
    });
};

export const buildDesignerSchema = (
  fields: TaskFormDesignerField[],
  baseFormSchema?: JsonSchemaObject,
  baseUiSchema?: JsonSchemaObject
) => {
  const nextFormSchema = cloneDeep(baseFormSchema ?? DEFAULT_FORM_SCHEMA);
  const nextUiSchema = buildUiSchema(fields, baseUiSchema);
  const properties: Record<string, JsonSchemaObject> = {};
  const required: string[] = [];

  nextFormSchema.type = 'object';
  nextFormSchema.additionalProperties =
    nextFormSchema.additionalProperties ?? true;

  fields.forEach((field) => {
    const fieldName = field.name.trim();

    if (!fieldName) {
      return;
    }

    properties[fieldName] = buildFieldProperty(field);
    if (field.required) {
      required.push(fieldName);
    }
  });

  nextFormSchema.properties = properties;

  if (required.length) {
    nextFormSchema.required = required;
  } else {
    delete nextFormSchema.required;
  }

  return {
    formSchema: nextFormSchema,
    uiSchema: nextUiSchema,
  };
};

export const parseTransitionForms = (
  transitionForms?: TaskFormSchema['transitionForms']
) =>
  Object.entries(transitionForms ?? {}).map(([transitionId, config]) => {
    const transitionConfig = cloneDeep(config ?? {});
    const formSchema = transitionConfig.formSchema as
      | JsonSchemaObject
      | undefined;
    const uiSchema = transitionConfig.uiSchema as JsonSchemaObject | undefined;

    return {
      key: createDesignerKey(transitionId),
      transitionId,
      fields: parseSchemaToDesignerFields(formSchema, uiSchema),
      config: transitionConfig,
    } satisfies TaskFormDesignerTransition;
  });

export const buildTransitionForms = (
  transitions: TaskFormDesignerTransition[]
) =>
  transitions.reduce<Record<string, JsonSchemaObject>>((acc, transition) => {
    const transitionId = transition.transitionId.trim();

    if (!transitionId) {
      return acc;
    }

    const baseFormSchema = transition.config?.formSchema as
      | JsonSchemaObject
      | undefined;
    const baseUiSchema = transition.config?.uiSchema as
      | JsonSchemaObject
      | undefined;
    const { formSchema, uiSchema } = buildDesignerSchema(
      transition.fields,
      baseFormSchema,
      baseUiSchema
    );

    acc[transitionId] = {
      ...cloneDeep(transition.config ?? {}),
      formSchema,
      uiSchema,
    };

    return acc;
  }, {});

export const parseStageMappings = (
  defaultStageMappings?: TaskFormSchema['defaultStageMappings']
) =>
  Object.entries(defaultStageMappings ?? {}).map(([stageId, taskStatus]) => ({
    key: createDesignerKey(stageId),
    stageId,
    taskStatus,
  }));

export const buildStageMappings = (
  stageMappings: TaskFormDesignerStageMapping[]
) =>
  stageMappings.reduce<Record<string, string>>((acc, mapping) => {
    const stageId = mapping.stageId.trim();
    const taskStatus = mapping.taskStatus.trim();

    if (stageId && taskStatus) {
      acc[stageId] = taskStatus;
    }

    return acc;
  }, {});

const PREVIEW_VALUE_BUILDERS: Record<
  TaskFormDesignerFieldType,
  (field: TaskFormDesignerField) => unknown
> = {
  boolean: () => true,
  number: () => 42,
  singleSelect: (field) => field.options[0] ?? '',
  multiSelect: (field) => field.options.slice(0, 2),
  json: (field) => (field.schemaType === 'array' ? [] : {}),
  longText: (field) => `${field.label || field.name} details`,
  shortText: (field) => field.label || field.name,
};

const getTagSelectorPreviewValue = (field: TaskFormDesignerField) => {
  const tagName = (field.label || field.name || 'Sample Tag')
    .replaceAll(/\s+/g, '')
    .replaceAll(/[^A-Za-z0-9_.-]/g, '');

  return [
    {
      tagFQN: `SampleClassification.${tagName}`,
      displayName: field.label || field.name || 'Sample Tag',
      name: tagName,
      source: 'Classification',
      state: 'Confirmed',
      labelType: 'Manual',
    },
  ];
};

export const getDesignerPreviewPayload = (
  fields: TaskFormDesignerField[]
): Record<string, unknown> =>
  fields.reduce<Record<string, unknown>>((acc, field) => {
    const fieldName = field.name.trim();

    if (!fieldName) {
      return acc;
    }

    if (field.widget === 'tagSelector') {
      acc[fieldName] = getTagSelectorPreviewValue(field);

      return acc;
    }

    const buildValue =
      PREVIEW_VALUE_BUILDERS[field.type] ?? PREVIEW_VALUE_BUILDERS.shortText;
    acc[fieldName] = buildValue(field);

    return acc;
  }, {});
