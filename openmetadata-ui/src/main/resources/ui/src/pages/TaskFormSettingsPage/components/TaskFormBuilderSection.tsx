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
  Autocomplete,
  Box,
  Button,
  Card,
  Checkbox,
  Input,
  Select,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { List, Plus, Trash01 } from '@openmetadata/ui-core-components/icons';
import { Key, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import NoDataPlaceholder from '../../../components/common/EmptyPlaceholder/NoDataPlaceholder';
import { JsonSchemaObject } from '../../../rest/taskFormSchemasAPI';
import {
  buildDesignerSchema,
  createEmptyDesignerField,
  getDesignerPreviewPayload,
  TaskFormDesignerField,
} from '../../../utils/TaskFormDesignerUtils';
import TaskPayloadSchemaFields from '../../TasksPage/shared/TaskPayloadSchemaFields';

/** Switching field type keeps options only for selects and defaults JSON to an object. */
const withFieldType = (
  field: TaskFormDesignerField,
  type: TaskFormDesignerField['type']
): TaskFormDesignerField => ({
  ...field,
  type,
  schemaType: type === 'json' ? field.schemaType ?? 'object' : field.schemaType,
  options:
    type === 'singleSelect' || type === 'multiSelect' ? field.options : [],
});

const withoutOption = (
  field: TaskFormDesignerField,
  key: Key
): TaskFormDesignerField => ({
  ...field,
  options: field.options.filter((option) => option !== key),
});

interface TaskFormBuilderSectionProps {
  title: string;
  description?: string;
  fields: TaskFormDesignerField[];
  onChange: (fields: TaskFormDesignerField[]) => void;
  testIdPrefix: string;
  baseFormSchema?: JsonSchemaObject;
  baseUiSchema?: JsonSchemaObject;
}

const FIELD_TYPE_OPTIONS = [
  { label: 'Short text', id: 'shortText' },
  { label: 'Long text', id: 'longText' },
  { label: 'Number', id: 'number' },
  { label: 'Boolean', id: 'boolean' },
  { label: 'Select', id: 'singleSelect' },
  { label: 'Multi-select', id: 'multiSelect' },
  { label: 'JSON', id: 'json' },
];

const JSON_SCHEMA_TYPE_OPTIONS = [
  { label: 'Object', id: 'object' },
  { label: 'Array', id: 'array' },
];

const FIELD_TYPE_LABEL_MAP: Record<TaskFormDesignerField['type'], string> = {
  shortText: 'Single line text',
  longText: 'Multiline text',
  number: 'Numeric field',
  boolean: 'Toggle',
  singleSelect: 'Single select',
  multiSelect: 'Multi-select',
  json: 'JSON field',
};

const TaskFormBuilderSection = ({
  title,
  description,
  fields,
  onChange,
  testIdPrefix,
  baseFormSchema,
  baseUiSchema,
}: TaskFormBuilderSectionProps) => {
  const { t } = useTranslation();
  const previewConfig = useMemo(
    () => buildDesignerSchema(fields, baseFormSchema, baseUiSchema),
    [baseFormSchema, baseUiSchema, fields]
  );
  const previewPayload = useMemo(
    () => getDesignerPreviewPayload(fields),
    [fields]
  );

  const updateField = (
    index: number,
    updater: (field: TaskFormDesignerField) => TaskFormDesignerField
  ) => {
    onChange(
      fields.map((field, currentIndex) =>
        currentIndex === index ? updater(field) : field
      )
    );
  };

  return (
    <div className="task-form-builder-section">
      <div className="task-form-builder-section__header">
        <div>
          <Typography
            as="h5"
            className="m-b-xs"
            size="text-md"
            weight="semibold">
            {title}
          </Typography>
          {description ? (
            <Typography as="p" className="m-b-0" color="secondary">
              {description}
            </Typography>
          ) : null}
        </div>
        <Button
          color="secondary"
          data-testid={`${testIdPrefix}-add-field`}
          iconLeading={Plus}
          onClick={() => onChange([...fields, createEmptyDesignerField()])}>
          {t('label.add-field')}
        </Button>
      </div>

      <div className="task-form-builder-section__workspace">
        <div className="task-form-builder-section__fields">
          {fields.length ? (
            fields.map((field, index) => {
              const supportsOptions =
                field.type === 'singleSelect' || field.type === 'multiSelect';
              const supportsJsonType = field.type === 'json';
              const summary = [
                `Input type: ${FIELD_TYPE_LABEL_MAP[field.type]}`,
                field.required ? 'Required' : undefined,
                field.hidden ? 'Hidden' : undefined,
              ]
                .filter(Boolean)
                .join(' • ');

              return (
                <Card
                  className="task-form-builder-section__field-card"
                  data-testid={`${testIdPrefix}-field-card-${index}`}
                  key={field.key}
                  size="sm">
                  <Card.Header
                    extra={
                      <Button
                        color="tertiary-destructive"
                        data-testid={`${testIdPrefix}-field-remove-${index}`}
                        iconLeading={Trash01}
                        size="xs"
                        onClick={() =>
                          onChange(
                            fields.filter(
                              (_, currentIndex) => currentIndex !== index
                            )
                          )
                        }>
                        {t('label.remove')}
                      </Button>
                    }
                    title={
                      <div className="task-form-builder-section__field-heading">
                        <Typography className="task-form-builder-section__field-title">
                          {field.label || field.name || `Field ${index + 1}`}
                        </Typography>
                        <Typography className="task-form-builder-section__field-meta">
                          {summary}
                        </Typography>
                      </div>
                    }
                  />
                  <Card.Content>
                    <div className="d-grid gap-3">
                      <div className="task-form-builder-section__field-grid">
                        <Input
                          inputDataTestId={`${testIdPrefix}-field-name-${index}`}
                          label="Field name"
                          placeholder="requestReason"
                          value={field.name}
                          onChange={(name) =>
                            updateField(index, (currentField) => ({
                              ...currentField,
                              name,
                            }))
                          }
                        />
                        <Input
                          inputDataTestId={`${testIdPrefix}-field-label-${index}`}
                          label="Label"
                          placeholder="Request Reason"
                          value={field.label}
                          onChange={(label) =>
                            updateField(index, (currentField) => ({
                              ...currentField,
                              label,
                            }))
                          }
                        />
                        <Select
                          data-testid={`${testIdPrefix}-field-type-${index}`}
                          items={FIELD_TYPE_OPTIONS}
                          label="Field type"
                          selectedKey={field.type}
                          onSelectionChange={(key) =>
                            key !== null &&
                            updateField(index, (currentField) =>
                              withFieldType(
                                currentField,
                                key as TaskFormDesignerField['type']
                              )
                            )
                          }>
                          {(item) => (
                            <Select.Item id={item.id} label={item.label} />
                          )}
                        </Select>
                      </div>

                      {supportsJsonType ? (
                        <Select
                          data-testid={`${testIdPrefix}-field-schema-type-${index}`}
                          items={JSON_SCHEMA_TYPE_OPTIONS}
                          label="JSON shape"
                          selectedKey={field.schemaType ?? 'object'}
                          onSelectionChange={(key) =>
                            key !== null &&
                            updateField(index, (currentField) => ({
                              ...currentField,
                              schemaType:
                                key as TaskFormDesignerField['schemaType'],
                            }))
                          }>
                          {(item) => (
                            <Select.Item id={item.id} label={item.label} />
                          )}
                        </Select>
                      ) : null}

                      {supportsOptions ? (
                        <Autocomplete
                          allowsCreation
                          hideDropdown
                          multiple
                          aria-label="Options"
                          data-testid={`${testIdPrefix}-field-options-${index}`}
                          items={[]}
                          label="Options"
                          placeholder="Add options"
                          selectedItems={field.options.map((option) => ({
                            id: option,
                            label: option,
                          }))}
                          onItemCleared={(key) =>
                            updateField(index, (currentField) =>
                              withoutOption(currentField, key)
                            )
                          }
                          onItemInserted={(key) =>
                            updateField(index, (currentField) => ({
                              ...currentField,
                              options: [...currentField.options, String(key)],
                            }))
                          }>
                          {(item) => (
                            <Autocomplete.Item
                              id={item.id}
                              label={item.label}
                            />
                          )}
                        </Autocomplete>
                      ) : null}

                      <TextArea
                        data-testid={`${testIdPrefix}-field-description-${index}`}
                        label="Help text"
                        placeholder="Explain what this field is used for"
                        rows={2}
                        value={field.description}
                        onChange={(description) =>
                          updateField(index, (currentField) => ({
                            ...currentField,
                            description,
                          }))
                        }
                      />

                      <Box
                        inline
                        align="center"
                        className="layout-space layout-space-horizontal"
                        gap={6}
                        itemClassName="layout-space-item">
                        <Checkbox
                          data-testid={`${testIdPrefix}-field-required-${index}`}
                          isSelected={field.required}
                          label={<>{t('label.required')}</>}
                          onChange={(event) =>
                            updateField(index, (currentField) => ({
                              ...currentField,
                              required: event,
                            }))
                          }
                        />
                        <Checkbox
                          data-testid={`${testIdPrefix}-field-hidden-${index}`}
                          isSelected={field.hidden}
                          label={<>{t('label.hidden')}</>}
                          onChange={(event) =>
                            updateField(index, (currentField) => ({
                              ...currentField,
                              hidden: event,
                            }))
                          }
                        />
                      </Box>
                    </div>
                  </Card.Content>
                </Card>
              );
            })
          ) : (
            <Box className="tw:relative tw:min-h-40">
              <NoDataPlaceholder
                data-testid={`${testIdPrefix}-empty`}
                icon={<List />}
                title={t('message.no-fields-configured')}
              />
            </Box>
          )}
        </div>

        <Card
          className="task-form-builder-section__preview"
          data-testid={`${testIdPrefix}-preview`}
          size="sm">
          <Card.Header title="Preview" />
          <Card.Content>
            {fields.length ? (
              <div>
                <TaskPayloadSchemaFields
                  mode="read"
                  payload={previewPayload}
                  schema={previewConfig.formSchema}
                  uiSchema={previewConfig.uiSchema}
                />
              </div>
            ) : (
              <Typography color="secondary">
                {t('message.add-fields-to-preview-form')}
              </Typography>
            )}
          </Card.Content>
        </Card>
      </div>
    </div>
  );
};

export default TaskFormBuilderSection;
