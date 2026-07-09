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
import {
  Alert,
  Button,
  FieldProp,
  FieldTypes,
  FormItemLabel,
  FormItemLayout,
  FormSelectItem,
  getField,
  HelperTextType,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@untitledui/icons';
import { FC, FocusEvent, lazy, useCallback } from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../enums/codemirror.enum';
import { DatabaseServiceType } from '../../../generated/entity/services/databaseService';
import {
  DataQualityDimensions,
  DataType,
  EntityType,
  TestDataType,
  TestPlatform,
} from '../../../generated/tests/testDefinition';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { TestDefinitionFormBodyProps } from './TestDefinitionForm.interface';

const CodeEditor = withSuspenseFallback(
  lazy(() => import('../../Database/SchemaEditor/CodeEditor'))
);

const toOptions = (values: string[]): FormSelectItem[] =>
  values.map((value) => ({ id: value, label: value }));

const TestDefinitionFormBody: FC<TestDefinitionFormBodyProps> = ({
  form,
  isEditMode,
  isReadOnlyField,
  errorMessage,
  onErrorDismiss,
  onActiveFieldChange,
}) => {
  const { t } = useTranslation();
  const { control } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parameterDefinition',
  });

  // The SQL editor is wired manually (not via getField); useWatch keeps its value
  // reactive to form.reset and programmatic setValue, unlike a render-time getValues.
  const sqlExpression = useWatch({ control, name: 'sqlExpression' });

  const handleActiveField = useCallback(
    (id?: string) => {
      if (!id) {
        return;
      }
      const fieldId = id.startsWith('root/') ? id : `root/${id}`;
      onActiveFieldChange?.(fieldId);
    },
    [onActiveFieldChange]
  );

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const fieldId = (event.target as HTMLElement).closest?.(
        '[id^="root/"]'
      )?.id;
      handleActiveField(fieldId);
    },
    [handleActiveField]
  );

  const nameField: FieldProp = {
    name: 'name',
    label: t('label.name'),
    type: FieldTypes.TEXT,
    required: true,
    id: 'root/name',
    placeholder: t('label.enter-entity-name', {
      entity: t('label.test-definition'),
    }),
    rules: {
      required: t('message.field-text-is-required', {
        fieldText: t('label.name'),
      }),
    },
    props: {
      'data-testid': 'test-definition-name',
      isDisabled: isEditMode || isReadOnlyField,
    } as FieldProp['props'],
  };

  const displayNameField: FieldProp = {
    name: 'displayName',
    label: t('label.display-name'),
    type: FieldTypes.TEXT,
    required: false,
    id: 'root/displayName',
    placeholder: t('label.enter-entity-name', {
      entity: t('label.display-name'),
    }),
    props: {
      'data-testid': 'display-name',
    } as FieldProp['props'],
  };

  const descriptionField: FieldProp = {
    name: 'description',
    label: t('label.description'),
    type: FieldTypes.TEXTAREA,
    required: false,
    id: 'root/description',
    placeholder: t('label.enter-entity-description', {
      entity: t('label.test-definition'),
    }),
    props: {
      'data-testid': 'description',
    } as FieldProp['props'],
  };

  const entityTypeField: FieldProp = {
    name: 'entityType',
    label: t('label.entity-type'),
    type: FieldTypes.SELECT,
    required: true,
    id: 'root/entityType',
    placeholder: t('label.select-field', { field: t('label.entity-type') }),
    rules: {
      required: t('message.field-text-is-required', {
        fieldText: t('label.entity-type'),
      }),
    },
    props: {
      'data-testid': 'entity-type',
      isDisabled: isReadOnlyField,
      options: toOptions(Object.values(EntityType)),
    } as FieldProp['props'],
  };

  const testPlatformsField: FieldProp = {
    name: 'testPlatforms',
    label: t('label.test-platform-plural'),
    type: FieldTypes.MULTI_SELECT,
    required: true,
    id: 'root/testPlatforms',
    placeholder: t('label.select-field', {
      field: t('label.test-platform-plural'),
    }),
    rules: {
      required: t('message.field-text-is-required', {
        fieldText: t('label.test-platform-plural'),
      }),
    },
    props: {
      'data-testid': 'test-platforms',
      isDisabled: isReadOnlyField,
      options: toOptions(Object.values(TestPlatform)),
    } as FieldProp['props'],
  };

  const dataQualityDimensionField: FieldProp = {
    name: 'dataQualityDimension',
    label: t('label.data-quality-dimension'),
    type: FieldTypes.SELECT,
    required: false,
    id: 'root/dataQualityDimension',
    placeholder: t('label.select-field', {
      field: t('label.data-quality-dimension'),
    }),
    props: {
      'data-testid': 'data-quality-dimension',
      options: toOptions(Object.values(DataQualityDimensions)),
    } as FieldProp['props'],
  };

  const supportedServicesField: FieldProp = {
    name: 'supportedServices',
    label: t('label.supported-service-plural'),
    type: FieldTypes.MULTI_SELECT,
    required: false,
    id: 'root/supportedServices',
    helperText: t('message.supported-services-help'),
    helperTextType: HelperTextType.TOOLTIP,
    placeholder: t('message.empty-means-all-services'),
    props: {
      'data-testid': 'supported-services',
      isDisabled: isReadOnlyField,
      options: toOptions(Object.values(DatabaseServiceType)),
    } as FieldProp['props'],
  };

  const supportedDataTypesField: FieldProp = {
    name: 'supportedDataTypes',
    label: t('label.supported-data-type-plural'),
    type: FieldTypes.MULTI_SELECT,
    required: false,
    id: 'root/supportedDataTypes',
    placeholder: t('label.select-field', {
      field: t('label.supported-data-type-plural'),
    }),
    rules: {
      validate: (value?: FormSelectItem[]) => {
        const platforms = (form.getValues('testPlatforms') ??
          []) as FormSelectItem[];
        const hasOpenMetadata = platforms.some(
          (platform) =>
            (typeof platform === 'object' ? platform?.id : platform) ===
            TestPlatform.OpenMetadata
        );
        let result: string | boolean = true;
        if (hasOpenMetadata && (value ?? []).length === 0) {
          result = t('message.field-text-is-required', {
            fieldText: t('label.supported-data-type-plural'),
          });
        }

        return result;
      },
    },
    props: {
      'data-testid': 'supported-data-types',
      isDisabled: isReadOnlyField,
      options: toOptions(Object.values(DataType)),
    } as FieldProp['props'],
  };

  const enabledField: FieldProp = {
    name: 'enabled',
    label: t('label.enabled'),
    type: FieldTypes.SWITCH,
    required: false,
    id: 'root/enabled',
    formItemLayout: FormItemLayout.HORIZONTAL,
    props: {
      'data-testid': 'enabled-toggle',
      isDisabled: isReadOnlyField,
    } as FieldProp['props'],
  };

  return (
    <div
      className="new-form-style tw:flex tw:flex-col tw:gap-5"
      data-testid="test-definition-form-body"
      onFocusCapture={handleFocus}>
      {errorMessage && (
        <div>
          <Alert
            closable
            title={t('label.error')}
            variant="error"
            onClose={onErrorDismiss}>
            {errorMessage}
          </Alert>
        </div>
      )}

      {getField(nameField)}
      {getField(displayNameField)}
      {getField(descriptionField)}

      <div
        className="tw:flex tw:flex-col tw:gap-1.5"
        data-testid="sql-expression"
        onClick={() => handleActiveField('root/sqlExpression')}>
        <FormItemLabel
          label={t('label.sql-query')}
          tooltip={t('message.test-definition-sql-query-help')}
        />
        {isReadOnlyField ? (
          <textarea
            disabled
            className="tw:min-h-[120px] tw:w-full tw:resize-y tw:rounded-lg tw:border tw:border-solid tw:border-secondary tw:bg-secondary tw:p-3 tw:font-mono tw:text-xs tw:text-secondary"
            placeholder={t('label.sql-query')}
            rows={8}
            value={sqlExpression ?? ''}
          />
        ) : (
          <CodeEditor
            refreshEditor
            showCopyButton
            className="custom-query-editor query-editor-h-200"
            mode={{ name: CSMode.SQL }}
            value={sqlExpression ?? ''}
            onChange={(value: string) =>
              form.setValue('sqlExpression', value, { shouldDirty: true })
            }
          />
        )}
      </div>

      {getField(entityTypeField)}
      {getField(testPlatformsField)}
      {getField(dataQualityDimensionField)}
      {getField(supportedServicesField)}
      {getField(supportedDataTypesField)}

      <div
        className="tw:flex tw:flex-col tw:gap-3"
        data-testid="parameter-definition"
        onClick={() => handleActiveField('root/parameterDefinition')}>
        <FormItemLabel
          label={t('label.parameter-plural')}
          tooltip={t('message.test-definition-parameters-description')}
        />
        {fields.map((field, index) => (
          <div
            className="m-t-md tw:flex tw:flex-col tw:gap-4 tw:rounded-lg tw:border tw:p-3"
            data-testid={`parameter-card-${index}`}
            key={field.id}>
            <div className="tw:flex tw:justify-between">
              <span>{`${t('label.parameter')} ${index + 1}`}</span>
              {!isReadOnlyField && (
                <Button
                  color="link-color"
                  data-testid={`remove-parameter-${index}`}
                  iconLeading={Trash01}
                  size="sm"
                  onClick={() => remove(index)}
                />
              )}
            </div>
            {getField({
              name: `parameterDefinition.${index}.name`,
              label: t('label.name'),
              type: FieldTypes.TEXT,
              required: true,
              id: `root/parameterDefinition/${index}/name`,
              placeholder: t('label.parameter-name'),
              rules: {
                required: t('message.field-text-is-required', {
                  fieldText: t('label.name'),
                }),
              },
              props: {
                'data-testid': `parameter-name-${index}`,
                isDisabled: isReadOnlyField,
              },
            } as FieldProp)}
            {getField({
              name: `parameterDefinition.${index}.displayName`,
              label: t('label.display-name'),
              type: FieldTypes.TEXT,
              required: false,
              id: `root/parameterDefinition/${index}/displayName`,
              placeholder: t('label.parameter-display-name'),
              props: {
                'data-testid': `parameter-display-name-${index}`,
                isDisabled: isReadOnlyField,
              },
            } as FieldProp)}
            {getField({
              name: `parameterDefinition.${index}.description`,
              label: t('label.description'),
              type: FieldTypes.TEXTAREA,
              required: false,
              id: `root/parameterDefinition/${index}/description`,
              placeholder: t('label.parameter-description'),
              props: {
                'data-testid': `parameter-description-${index}`,
                isDisabled: isReadOnlyField,
              },
            } as FieldProp)}
            {getField({
              name: `parameterDefinition.${index}.dataType`,
              label: t('label.data-type'),
              type: FieldTypes.AUTOCOMPLETE,
              required: false,
              id: `root/parameterDefinition/${index}/dataType`,
              placeholder: t('label.select-field', {
                field: t('label.data-type'),
              }),
              props: {
                'data-testid': `parameter-data-type-${index}`,
                isDisabled: isReadOnlyField,
                options: toOptions(Object.values(TestDataType)),
              },
            } as FieldProp)}
            {getField({
              name: `parameterDefinition.${index}.required`,
              label: t('label.required'),
              type: FieldTypes.SWITCH,
              required: false,
              id: `root/parameterDefinition/${index}/required`,
              formItemLayout: FormItemLayout.HORIZONTAL,
              props: {
                'data-testid': `parameter-required-${index}`,
                isDisabled: isReadOnlyField,
              },
            } as FieldProp)}
          </div>
        ))}
        {!isReadOnlyField && (
          <Button
            className="tw:w-full tw:justify-center tw:border tw:border-dashed tw:border-secondary"
            color="tertiary"
            data-testid="add-parameter-button"
            iconLeading={Plus}
            size="md"
            onClick={() => append({})}>
            {t('label.add-entity', { entity: t('label.parameter') })}
          </Button>
        )}
      </div>

      {isEditMode && getField(enabledField)}
    </div>
  );
};

export default TestDefinitionFormBody;
