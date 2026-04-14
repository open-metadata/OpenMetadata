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
  Checkbox,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  Typography,
} from 'antd';
import { uniqBy } from 'lodash';
import { useMemo } from 'react';
import { TagLabel } from '../../../generated/type/tagLabel';
import { JsonSchemaObject } from '../../../rest/taskFormSchemasAPI';
import { TaskPayload } from '../../../rest/tasksAPI';
import { DescriptionTabs } from './DescriptionTabs';
import { TagsTabs } from './TagsTabs';
import TagSuggestion from './TagSuggestion';

type JsonSchemaProperty = {
  type?: string;
  title?: string;
  description?: string;
  enum?: string[];
};

interface TaskPayloadSchemaFieldsProps {
  payload: TaskPayload;
  schema?: JsonSchemaObject;
  uiSchema?: JsonSchemaObject;
  mode?: 'edit' | 'read';
  onChange?: (payload: TaskPayload) => void;
}

const HIDDEN_WIDGET = 'hidden';

const TaskPayloadSchemaFields = ({
  payload,
  schema,
  uiSchema,
  mode = 'edit',
  onChange,
}: TaskPayloadSchemaFieldsProps) => {
  const properties = useMemo(
    () => (schema?.properties as Record<string, JsonSchemaProperty>) ?? {},
    [schema]
  );
  const orderedFields = useMemo(() => {
    const uiOrder = uiSchema?.['ui:order'];
    const propertyKeys = Object.keys(properties);
    if (!Array.isArray(uiOrder)) {
      return propertyKeys;
    }

    const ordered = uiOrder.filter((field): field is string =>
      propertyKeys.includes(String(field))
    );
    const remaining = propertyKeys.filter((field) => !ordered.includes(field));

    return [...ordered, ...remaining];
  }, [properties, uiSchema]);

  const requiredFields = useMemo(
    () => new Set(Array.isArray(schema?.required) ? schema.required : []),
    [schema]
  );

  const hiddenFields = useMemo(
    () =>
      new Set(
        Object.entries(uiSchema ?? {})
          .filter(
            ([field, config]) =>
              field !== 'ui:order' &&
              (config as Record<string, unknown>)?.['ui:widget'] ===
                HIDDEN_WIDGET
          )
          .map(([field]) => field)
      ),
    [uiSchema]
  );

  const getWidget = (fieldName: string) =>
    (uiSchema?.[fieldName] as Record<string, unknown> | undefined)?.[
      'ui:widget'
    ];

  const getFieldValue = (fieldName: string, fallback?: unknown) => {
    const payloadValue = payload[fieldName];

    if (payloadValue !== undefined) {
      return payloadValue;
    }

    const fieldSchema = properties[fieldName] as
      | Record<string, unknown>
      | undefined;

    if (
      fieldSchema &&
      Object.prototype.hasOwnProperty.call(fieldSchema, 'default')
    ) {
      return fieldSchema.default;
    }

    return fallback;
  };

  const getSuggestedTags = () => {
    const currentTags = (payload.currentTags as TagLabel[] | undefined) ?? [];
    const tagsToAdd = (payload.tagsToAdd as TagLabel[] | undefined) ?? [];
    const tagsToRemove = (payload.tagsToRemove as TagLabel[] | undefined) ?? [];
    const removedTagFqns = new Set(tagsToRemove.map((tag) => tag.tagFQN));

    return uniqBy(
      [
        ...currentTags.filter((tag) => !removedTagFqns.has(tag.tagFQN)),
        ...tagsToAdd,
      ],
      'tagFQN'
    );
  };

  const updateField = (fieldName: string, value: unknown) =>
    onChange?.({
      ...payload,
      [fieldName]: value,
    });

  const stringifyValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value, null, 2);
  };

  const renderReadOnlyText = (
    label: string,
    value: unknown,
    description?: string
  ) => (
    <Form.Item key={label} label={`${label}:`}>
      <Typography.Paragraph className="m-b-0 whitespace-pre-wrap">
        {stringifyValue(value)}
      </Typography.Paragraph>
      {description ? (
        <Typography.Paragraph className="m-b-0 m-t-xs text-grey-muted">
          {description}
        </Typography.Paragraph>
      ) : null}
    </Form.Item>
  );

  const renderReadOnlyTags = (
    label: string,
    value: TagLabel[],
    description?: string
  ) => (
    <Form.Item key={label} label={`${label}:`}>
      <div className="d-flex flex-wrap gap-2">
        {value.length ? (
          value.map((tag) => <Tag key={tag.tagFQN}>{tag.tagFQN}</Tag>)
        ) : (
          <Typography.Text className="text-grey-muted">-</Typography.Text>
        )}
      </div>
      {description ? (
        <Typography.Paragraph className="m-b-0 m-t-xs text-grey-muted">
          {description}
        </Typography.Paragraph>
      ) : null}
    </Form.Item>
  );

  return (
    <>
      {orderedFields.map((fieldName) => {
        const fieldSchema = properties[fieldName];
        const widget = getWidget(fieldName);
        const label = fieldSchema?.title ?? fieldName;
        const description = fieldSchema?.description;

        if (hiddenFields.has(fieldName)) {
          return null;
        }

        if (widget === 'descriptionTabs') {
          if (mode === 'read') {
            return (
              <div key={fieldName}>
                {renderReadOnlyText(
                  `${label} (${'Current'})`,
                  payload.currentDescription,
                  description
                )}
                {renderReadOnlyText(
                  `${label} (${'Suggested'})`,
                  payload.newDescription ?? payload.suggestedValue
                )}
              </div>
            );
          }

          return (
            <Form.Item key={fieldName} label={`${label}:`}>
              <DescriptionTabs
                suggestion={String(payload.newDescription ?? '')}
                value={String(payload.currentDescription ?? '')}
                onChange={(value) => updateField(fieldName, value)}
              />
              {description ? (
                <Typography.Paragraph className="m-b-0 m-t-xs text-grey-muted">
                  {description}
                </Typography.Paragraph>
              ) : null}
            </Form.Item>
          );
        }

        if (widget === 'tagsTabs') {
          const currentTags =
            (payload.currentTags as TagLabel[] | undefined) ?? [];
          const suggestedTags = getSuggestedTags();

          if (mode === 'read') {
            return (
              <div key={fieldName}>
                {renderReadOnlyTags(
                  `${label} (${'Current'})`,
                  currentTags,
                  description
                )}
                {renderReadOnlyTags(`${label} (${'Suggested'})`, suggestedTags)}
              </div>
            );
          }

          return (
            <Form.Item key={fieldName} label={`${label}:`}>
              <TagsTabs
                tags={currentTags}
                value={suggestedTags}
                onChange={(newTags) => {
                  const currentTagFqns = new Set(
                    currentTags.map((tag) => tag.tagFQN)
                  );
                  const newTagFqns = new Set(newTags.map((tag) => tag.tagFQN));

                  onChange({
                    ...payload,
                    tagsToAdd: newTags.filter(
                      (tag) => !currentTagFqns.has(tag.tagFQN)
                    ),
                    tagsToRemove: currentTags.filter(
                      (tag) => !newTagFqns.has(tag.tagFQN)
                    ),
                  });
                }}
              />
              {description ? (
                <Typography.Paragraph className="m-b-0 m-t-xs text-grey-muted">
                  {description}
                </Typography.Paragraph>
              ) : null}
            </Form.Item>
          );
        }

        if (widget === 'tagSelector') {
          if (mode === 'read') {
            return renderReadOnlyTags(
              label,
              ((payload[fieldName] as TagLabel[] | undefined) ?? []).filter(
                Boolean
              ),
              description
            );
          }

          return (
            <Form.Item key={fieldName} label={`${label}:`}>
              <TagSuggestion
                value={(payload[fieldName] as TagLabel[] | undefined) ?? []}
                onChange={(newTags) => updateField(fieldName, newTags)}
              />
              {description ? (
                <Typography.Paragraph className="m-b-0 m-t-xs text-grey-muted">
                  {description}
                </Typography.Paragraph>
              ) : null}
            </Form.Item>
          );
        }

        if (fieldSchema?.enum?.length) {
          if (mode === 'read') {
            return renderReadOnlyText(
              label,
              getFieldValue(fieldName),
              description
            );
          }

          return (
            <Form.Item
              key={fieldName}
              label={`${label}:`}
              required={requiredFields.has(fieldName)}
              rules={
                requiredFields.has(fieldName)
                  ? [{ required: true, message: `${label} is required` }]
                  : undefined
              }>
              <Select
                options={fieldSchema.enum.map((value) => ({
                  label: value,
                  value,
                }))}
                value={getFieldValue(fieldName) as string | undefined}
                onChange={(value) => updateField(fieldName, value)}
              />
            </Form.Item>
          );
        }

        if (fieldSchema?.type === 'number') {
          if (mode === 'read') {
            return renderReadOnlyText(
              label,
              getFieldValue(fieldName),
              description
            );
          }

          return (
            <Form.Item key={fieldName} label={`${label}:`}>
              <InputNumber
                className="w-full"
                value={getFieldValue(fieldName) as number | undefined}
                onChange={(value) => updateField(fieldName, value)}
              />
            </Form.Item>
          );
        }

        if (fieldSchema?.type === 'boolean') {
          if (mode === 'read') {
            return renderReadOnlyText(
              label,
              Boolean(getFieldValue(fieldName, false)),
              description
            );
          }

          return (
            <Form.Item
              key={fieldName}
              label={`${label}:`}
              valuePropName="checked">
              <Checkbox
                checked={Boolean(getFieldValue(fieldName, false))}
                onChange={(event) =>
                  updateField(fieldName, event.target.checked)
                }>
                {description}
              </Checkbox>
            </Form.Item>
          );
        }

        if (widget === 'textarea') {
          if (mode === 'read') {
            return renderReadOnlyText(
              label,
              getFieldValue(fieldName, ''),
              description
            );
          }

          return (
            <Form.Item
              key={fieldName}
              label={`${label}:`}
              required={requiredFields.has(fieldName)}
              rules={
                requiredFields.has(fieldName)
                  ? [{ required: true, message: `${label} is required` }]
                  : undefined
              }>
              <Input.TextArea
                autoSize={{ minRows: 4, maxRows: 10 }}
                value={String(getFieldValue(fieldName, '') ?? '')}
                onChange={(event) => updateField(fieldName, event.target.value)}
              />
            </Form.Item>
          );
        }

        if (fieldSchema?.type === 'object' || fieldSchema?.type === 'array') {
          if (mode === 'read') {
            return renderReadOnlyText(
              label,
              getFieldValue(fieldName),
              description
            );
          }

          return (
            <Form.Item key={fieldName} label={`${label}:`}>
              <Input.TextArea
                autoSize={{ minRows: 4, maxRows: 12 }}
                value={stringifyValue(
                  getFieldValue(
                    fieldName,
                    fieldSchema?.type === 'array' ? [] : {}
                  )
                )}
                onChange={(event) => {
                  try {
                    updateField(fieldName, JSON.parse(event.target.value));
                  } catch {
                    updateField(fieldName, event.target.value);
                  }
                }}
              />
              {description ? (
                <Typography.Paragraph className="m-b-0 m-t-xs text-grey-muted">
                  {description}
                </Typography.Paragraph>
              ) : null}
            </Form.Item>
          );
        }

        if (mode === 'read') {
          return renderReadOnlyText(
            label,
            getFieldValue(fieldName, ''),
            description
          );
        }

        return (
          <Form.Item key={fieldName} label={`${label}:`}>
            <Input
              value={String(getFieldValue(fieldName, '') ?? '')}
              onChange={(event) => updateField(fieldName, event.target.value)}
            />
            {description ? (
              <Typography.Paragraph className="m-b-0 m-t-xs text-grey-muted">
                {description}
              </Typography.Paragraph>
            ) : null}
          </Form.Item>
        );
      })}
    </>
  );
};

export default TaskPayloadSchemaFields;
