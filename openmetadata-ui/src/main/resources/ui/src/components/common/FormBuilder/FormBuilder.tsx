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
import React, { forwardRef, FunctionComponent, useState } from 'react';
import { ServiceCategory } from '../../../enums/service.enum';
import { ConfigData } from '../../../interface/service.interface';
import { transformErrors } from '../../../utils/formUtils';
import { formatFormDataForRender } from '../../../utils/JSONSchemaFormUtils';
import { ArrayFieldTemplate } from '../Form/JSONSchema/JSONSchemaTemplate/ArrayFieldTemplate';
import DescriptionFieldTemplate from '../Form/JSONSchema/JSONSchemaTemplate/DescriptionFieldTemplate';
import { FieldErrorTemplate } from '../Form/JSONSchema/JSONSchemaTemplate/FieldErrorTemplate/FieldErrorTemplate';
import { ObjectFieldTemplate } from '../Form/JSONSchema/JSONSchemaTemplate/ObjectFieldTemplate';
import AsyncSelectWidget from '../Form/JSONSchema/JsonSchemaWidgets/AsyncSelectWidget';
import MultiSelectWidget from '../Form/JSONSchema/JsonSchemaWidgets/MultiSelectWidget';
import PasswordWidget from '../Form/JSONSchema/JsonSchemaWidgets/PasswordWidget';
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
    const [localFormData, setLocalFormData] = useState<ConfigData | undefined>(
      formatFormDataForRender(formData ?? {})
    );

    const widgets = {
      PasswordWidget: PasswordWidget,
      autoComplete: AsyncSelectWidget,
      ...(useSelectWidget && { SelectWidget: MultiSelectWidget }),
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
        {...props}>
        {children}
        <div
          className="m-t-lg d-flex justify-end text-right"
          data-testid="buttons">
          {!hideCancelButton && (
            <Button type="link" onClick={handleCancel}>
              {cancelText}
            </Button>
          )}

          {status === 'waiting' ? (
            <Button
              disabled
              className="p-x-md p-y-xxs h-auto rounded-6"
              type="primary">
              <Loader size="small" type="white" />
            </Button>
          ) : status === 'success' ? (
            <Button
              disabled
              className="p-x-md p-y-xxs h-auto rounded-6"
              type="primary">
              <CheckOutlined />
            </Button>
          ) : (
            <Button
              className="font-medium p-x-md p-y-xxs h-auto rounded-6"
              data-testid="submit-btn"
              htmlType="submit"
              loading={isLoading}
              type="primary">
              {okText}
            </Button>
          )}
        </div>
      </Form>
    );
  }
);

export default FormBuilder;
