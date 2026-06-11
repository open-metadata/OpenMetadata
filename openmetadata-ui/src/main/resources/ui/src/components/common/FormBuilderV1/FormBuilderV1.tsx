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
import validator from '@rjsf/validator-ajv8';
import { forwardRef, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { transformErrors } from '../../../utils/formUtils';
import { formatFormDataForRender } from '../../../utils/JSONSchemaFormUtils';
import CoreArrayField from './fields/CoreArrayField';
import CoreBooleanField from './fields/CoreBooleanField';
import CoreOneOfField from './fields/CoreOneOfField';
import LayoutGridField from './fields/LayoutGridField';
import { FormBuilderV1Props } from './FormBuilderV1.interface';
import { CoreArrayFieldTemplate } from './templates/CoreArrayFieldTemplate';
import { CoreFieldErrorTemplate } from './templates/CoreFieldErrorTemplate';
import { CoreFieldTemplate } from './templates/CoreFieldTemplate';
import { CoreObjectFieldTemplate } from './templates/CoreObjectFieldTemplate';
import { CoreWrapIfAdditionalTemplate } from './templates/CoreWrapIfAdditionalTemplate';
import CoreCheckboxWidget from './widgets/CoreCheckboxWidget';
import CoreInputWidget from './widgets/CoreInputWidget';
import CorePasswordWidget from './widgets/CorePasswordWidget';
import CoreRadioWidget from './widgets/CoreRadioWidget';
import CoreSelectWidget from './widgets/CoreSelectWidget';
import CoreTextAreaWidget from './widgets/CoreTextAreaWidget';

const defaultFields = {
  AnyOfField: CoreOneOfField,
  ArrayField: CoreArrayField,
  BooleanField: CoreBooleanField,
  OneOfField: CoreOneOfField,
  LayoutGridField,
};

const defaultWidgets = {
  CheckboxWidget: CoreCheckboxWidget,
  EmailWidget: CoreInputWidget,
  PasswordWidget: CorePasswordWidget,
  RadioWidget: CoreRadioWidget,
  SelectWidget: CoreSelectWidget,
  TextWidget: CoreInputWidget,
  TextareaWidget: CoreTextAreaWidget,
  URLWidget: CoreInputWidget,
  UpDownWidget: CoreInputWidget,
};

const FormBuilderV1 = forwardRef<Form, FormBuilderV1Props>(
  (
    {
      formData,
      schema,
      okText,
      cancelText,
      isLoading,
      isSubmitDisabled = false,
      hideCancelButton = false,
      hideFooter = false,
      status = 'initial',
      onCancel,
      onSubmit,
      uiSchema,
      children,
      ...props
    },
    ref
  ) => {
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
      props.onChange?.(e);
    };

    const isSubmitting = status === 'waiting';

    const mergedFields = useMemo(
      () => ({
        ...defaultFields,
        ...(props.fields ?? {}),
      }),
      [props.fields]
    );

    const mergedWidgets = useMemo(
      () => ({
        ...defaultWidgets,
        ...(props.widgets ?? {}),
      }),
      [props.widgets]
    );

    const mergedTemplates = useMemo(
      () => ({
        ArrayFieldTemplate: CoreArrayFieldTemplate,
        FieldTemplate: CoreFieldTemplate,
        ObjectFieldTemplate: CoreObjectFieldTemplate,
        FieldErrorTemplate: CoreFieldErrorTemplate,
        WrapIfAdditionalTemplate: CoreWrapIfAdditionalTemplate,
        ...(props.templates ?? {}),
      }),
      [props.templates]
    );

    return (
      <Form
        {...props}
        focusOnFirstError
        noHtml5Validate
        omitExtraData
        className="rjsf no-header"
        fields={mergedFields}
        formData={localFormData}
        idSeparator="/"
        ref={ref}
        schema={schema}
        showErrorList={false}
        templates={mergedTemplates}
        transformErrors={transformErrors}
        uiSchema={uiSchema}
        validator={validator}
        widgets={mergedWidgets}
        onChange={handleFormChange}
        onSubmit={onSubmit}>
        {children}
        {/* When hideFooter is true, the parent card renders the footer to span full width
         * and keep the card's bottom border-radius visible during scroll. */}
        {!hideFooter && (
          <div className="tw:sticky tw:bottom-0 tw:z-10 tw:mt-4 tw:flex tw:justify-end tw:gap-2 tw:border-t tw:border-secondary tw:bg-primary tw:pt-4 tw:pb-1">
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
              isDisabled={isSubmitting || isLoading || isSubmitDisabled}
              size="sm"
              type="submit">
              {isSubmitting ? t('label.submitting') : okText ?? t('label.submit')}
            </Button>
          </div>
        )}
      </Form>
    );
  }
);

FormBuilderV1.displayName = 'FormBuilderV1';

export default FormBuilderV1;
