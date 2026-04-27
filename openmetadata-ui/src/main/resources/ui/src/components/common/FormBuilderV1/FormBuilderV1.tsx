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

import { Button } from '@openmetadata/ui-core-components';
import Form, { IChangeEvent } from '@rjsf/core';
import { RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { transformErrors } from '../../../utils/formUtils';
import { formatFormDataForRender } from '../../../utils/JSONSchemaFormUtils';
import LayoutGridField from './fields/LayoutGridField';
import { FormBuilderV1Props } from './FormBuilderV1.interface';
import { CoreArrayFieldTemplate } from './templates/CoreArrayFieldTemplate';
import { CoreFieldErrorTemplate } from './templates/CoreFieldErrorTemplate';
import { CoreFieldTemplate } from './templates/CoreFieldTemplate';
import { CoreObjectFieldTemplate } from './templates/CoreObjectFieldTemplate';
import CoreCheckboxWidget from './widgets/CoreCheckboxWidget';
import CoreInputWidget from './widgets/CoreInputWidget';
import CoreRadioWidget from './widgets/CoreRadioWidget';
import CoreSelectWidget from './widgets/CoreSelectWidget';
import CoreTextAreaWidget from './widgets/CoreTextAreaWidget';

const FormBuilderV1 = ({
  formData,
  schema,
  okText,
  cancelText,
  isLoading,
  hideCancelButton = false,
  status = 'initial',
  onCancel,
  onSubmit,
  uiSchema,
  children,
  ...props
}: FormBuilderV1Props) => {
  const { t } = useTranslation();

  const [localFormData, setLocalFormData] = useState(
    formatFormDataForRender((formData ?? {}) as Record<string, unknown>)
  );

  useEffect(() => {
    setLocalFormData(
      formatFormDataForRender((formData ?? {}) as Record<string, unknown>)
    );
  }, [formData]);

  const handleCancel = () => {
    setLocalFormData(
      formatFormDataForRender((formData ?? {}) as Record<string, unknown>)
    );
    onCancel?.();
  };

  const handleFormChange = (e: IChangeEvent) => {
    setLocalFormData(e.formData ?? {});
    props.onChange && props.onChange(e);
  };

  const isSubmitting = status === 'waiting';

  const fields = {
    LayoutGridField,
  };

  const widgets = {
    CheckboxWidget: CoreCheckboxWidget,
    EmailWidget: CoreInputWidget,
    PasswordWidget: CoreInputWidget,
    RadioWidget: CoreRadioWidget,
    SelectWidget: CoreSelectWidget,
    TextWidget: CoreInputWidget,
    TextareaWidget: CoreTextAreaWidget,
    URLWidget: CoreInputWidget,
    UpDownWidget: CoreInputWidget,
  };

  return (
    <Form
      {...props}
      focusOnFirstError
      noHtml5Validate
      omitExtraData
      className="rjsf no-header"
      fields={fields}
      formData={localFormData}
      idSeparator="/"
      schema={schema as RJSFSchema}
      showErrorList={false}
      templates={{
        ArrayFieldTemplate: CoreArrayFieldTemplate,
        FieldTemplate: CoreFieldTemplate,
        ObjectFieldTemplate: CoreObjectFieldTemplate,
        FieldErrorTemplate: CoreFieldErrorTemplate,
      }}
      transformErrors={transformErrors}
      uiSchema={uiSchema}
      validator={validator}
      widgets={widgets}
      onChange={handleFormChange}
      onSubmit={onSubmit}>
      {children}
      <div className="tw:mt-4 tw:flex tw:justify-end tw:gap-2">
        {!hideCancelButton && (
          <Button
            color="secondary"
            size="sm"
            type="button"
            onClick={handleCancel}>
            {cancelText ?? t('label.cancel')}
          </Button>
        )}
        <Button
          color="primary"
          data-testid="submit-btn"
          isDisabled={isSubmitting || isLoading}
          size="sm"
          type="submit">
          {isSubmitting ? t('label.submitting') : okText ?? t('label.submit')}
        </Button>
      </div>
    </Form>
  );
};

export default FormBuilderV1;
