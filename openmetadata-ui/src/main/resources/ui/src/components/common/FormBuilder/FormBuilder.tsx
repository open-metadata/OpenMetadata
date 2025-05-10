/*
 *  Copyright 2022 Collate.
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

import { CheckOutlined } from '@ant-design/icons';
import Form, { FormProps, IChangeEvent } from '@rjsf/core';
import { Button } from 'antd';
import classNames from 'classnames';
import { LoadingState } from 'Models';
import React, { forwardRef, FunctionComponent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceCategory } from '../../../enums/service.enum';
import { ConfigData } from '../../../interface/service.interface';
import { transformErrors } from '../../../utils/formUtils';
import { formatFormDataForRender } from '../../../utils/JSONSchemaFormUtils';
import { ArrayFieldTemplate } from '../Form/JSONSchema/JSONSchemaTemplate/ArrayFieldTemplate';
import DescriptionFieldTemplate from '../Form/JSONSchema/JSONSchemaTemplate/DescriptionFieldTemplate';
import { FieldErrorTemplate } from '../Form/JSONSchema/JSONSchemaTemplate/FieldErrorTemplate/FieldErrorTemplate';
import { ObjectFieldTemplate } from '../Form/JSONSchema/JSONSchemaTemplate/ObjectFieldTemplate';
import AsyncSelectWidget from '../Form/JSONSchema/JsonSchemaWidgets/AsyncSelectWidget';
import CodeWidget from '../Form/JSONSchema/JsonSchemaWidgets/CodeWidget/CodeWidget';
import PasswordWidget from '../Form/JSONSchema/JsonSchemaWidgets/PasswordWidget';
import QueryBuilderWidget from '../Form/JSONSchema/JsonSchemaWidgets/QueryBuilderWidget/QueryBuilderWidget';
import SelectWidget from '../Form/JSONSchema/JsonSchemaWidgets/SelectWidget';
import Loader from '../Loader/Loader';

export interface Props extends FormProps {
  okText: string;
  isLoading?: boolean;
  hideCancelButton?: boolean;
  cancelText: string;
  serviceCategory: ServiceCategory;
  showFormHeader?: boolean;
  status?: LoadingState;
  onCancel?: () => void;
  useSelectWidget?: boolean;
}

const FormBuilder: FunctionComponent<Props> = forwardRef(
  (
    {
      formData,
      schema,
      okText,
      cancelText,
      isLoading,
      hideCancelButton = false,
      showFormHeader = false,
      status = 'initial',
      onCancel,
      onSubmit,
      uiSchema,
      onFocus,
      useSelectWidget = false,
      children,
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation();
    const isReadOnlyForm = useMemo(() => {
      return !!props.readonly;
    }, [props.readonly]);

    const [localFormData, setLocalFormData] = useState<ConfigData | undefined>(
      formatFormDataForRender(formData ?? {})
    );

    const widgets = {
      PasswordWidget: PasswordWidget,
      autoComplete: AsyncSelectWidget,
      queryBuilder: QueryBuilderWidget,
      code: CodeWidget,
      ...(useSelectWidget && { SelectWidget: SelectWidget }),
    };

    const handleCancel = () => {
      setLocalFormData(formatFormDataForRender<ConfigData>(formData ?? {}));
      if (onCancel) {
        onCancel();
      }
    };

    const handleFormChange = (e: IChangeEvent<ConfigData>) => {
      setLocalFormData(e.formData);
      props.onChange && props.onChange(e);
    };

    const submitButton = useMemo(() => {
      if (status === 'waiting') {
        return (
          <Button
            disabled
            className="p-x-md p-y-xxs h-auto rounded-6"
            type="primary">
            <Loader size="small" type="white" />
          </Button>
        );
      } else if (status === 'success') {
        return (
          <Button
            disabled
            className="p-x-md p-y-xxs h-auto rounded-6"
            type="primary">
            <CheckOutlined />
          </Button>
        );
      } else {
        return (
          <Button
            className="font-medium p-x-md p-y-xxs h-auto rounded-6"
            data-testid="submit-btn"
            htmlType="submit"
            loading={isLoading}
            type="primary">
            {okText}
          </Button>
        );
      }
    }, [status, isLoading, okText]);

    return (
      <Form
        focusOnFirstError
        noHtml5Validate
        omitExtraData
        className={classNames('rjsf', props.className, {
          'no-header': !showFormHeader,
        })}
        formContext={{ handleFocus: onFocus }}
        formData={localFormData}
        idSeparator="/"
        ref={ref}
        schema={schema}
        showErrorList={false}
        templates={{
          ArrayFieldTemplate: ArrayFieldTemplate,
          ObjectFieldTemplate: ObjectFieldTemplate,
          DescriptionFieldTemplate: DescriptionFieldTemplate,
          FieldErrorTemplate: FieldErrorTemplate,
        }}
        transformErrors={transformErrors}
        uiSchema={uiSchema}
        widgets={widgets}
        onChange={handleFormChange}
        onFocus={onFocus}
        onSubmit={onSubmit}
        {...props}
        validator={{
          ...props?.validator,
          validateFormData: (formData: ConfigData) => {
            const validationErrors: Record<string, { __errors: string[] }> = {};

            const resolveRef = (ref: string, schemaObj: any) => {
              if (!ref) {
                return null;
              }
              const refPath = ref.split('/').slice(1);

              return refPath.reduce((obj, path) => obj?.[path], schemaObj);
            };

            const validateProperty = (
              property: any,
              value: any,
              key: string,
              path: string
            ): { __errors: string[] } | null => {
              // Handle schema references
              if (property.$ref) {
                const refSchema = resolveRef(property.$ref, schema);
                if (!refSchema) {
                  return null;
                }

                return validateProperty(refSchema, value, key, path);
              }

              if (
                typeof property === 'object' &&
                property !== null &&
                (property.type === 'number' || property.type === 'integer')
              ) {
                if (
                  typeof value === 'number' &&
                  property.minimum !== undefined &&
                  value < property.minimum
                ) {
                  return {
                    __errors: [
                      t('message.value-must-be-greater-than', {
                        field: property.title ?? key,
                        minimum: property.minimum,
                      }),
                    ],
                  };
                }
              }

              return null;
            };

            const checkProperties = (obj: any, schemaObj: any, path = '') => {
              if (!schemaObj) {
                return;
              }

              // Handle schema references
              if (schemaObj.$ref) {
                schemaObj = resolveRef(schemaObj.$ref, schema);
                if (!schemaObj) {
                  return;
                }
              }

              Object.keys(schemaObj.properties ?? {}).forEach((key) => {
                const property = schemaObj.properties[key];
                const value = obj?.[key];
                const currentPath = path ? `${path}.${key}` : key;

                // Handle nested references
                if (property.$ref) {
                  const refSchema = resolveRef(property.$ref, schema);
                  if (refSchema) {
                    checkProperties(value, refSchema, currentPath);
                  }
                } else {
                  const error = validateProperty(
                    property,
                    value,
                    key,
                    currentPath
                  );
                  if (error) {
                    validationErrors[currentPath] = error;
                  }

                  // Recursively check nested objects
                  if (property.type === 'object' && value) {
                    checkProperties(value, property, currentPath);
                  }
                }
              });
            };

            checkProperties(formData, schema);

            // Convert validation errors to the format expected by rjsf
            const errorSchema = Object.keys(validationErrors).reduce(
              (acc: Record<string, any>, key) => {
                const path = key.split('.');
                let current = acc;
                for (let i = 0; i < path.length - 1; i++) {
                  current[path[i]] = current[path[i]] || {};
                  current = current[path[i]];
                }
                current[path[path.length - 1]] = validationErrors[key];

                return acc;
              },
              {}
            );

            return {
              errors: Object.keys(validationErrors).map((key) => ({
                name: key,
                property: key,
                message: validationErrors[key].__errors[0],
                stack: t('message.value-must-be-greater-than', {
                  field: key,
                  minimum: validationErrors[key].__errors[0].split(' ').pop(),
                }),
              })),
              errorSchema,
            };
          },
        }}>
        {children}
        <div
          className="m-t-lg d-flex justify-end text-right"
          data-testid="buttons">
          {!hideCancelButton && (
            <Button type="link" onClick={handleCancel}>
              {cancelText}
            </Button>
          )}

          {!isReadOnlyForm && submitButton}
        </div>
      </Form>
    );
  }
);

export default FormBuilder;
