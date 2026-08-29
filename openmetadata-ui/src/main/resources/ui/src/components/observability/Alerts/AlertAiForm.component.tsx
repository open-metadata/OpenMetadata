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

import {
  Box,
  EmptyPlaceholder,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { Lightbulb05 } from '@untitledui/icons';
import { FormEvent, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import RichTextEditorPreviewerV1 from '../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { ModifiedCreateEventSubscription } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import AlertAiFormFields from './AlertAiFormFields.component';
import {
  AlertAiFormProps,
  AlertAiFormValidationErrors,
} from './AlertAiFormFields.interface';
import { validateAlertAiForm } from './AlertAiFormFieldsValidationUtils';

/** Wraps AI alert fields in a Core UI form and gates submit handling in view mode. */
function AlertAiForm(props: Readonly<AlertAiFormProps>) {
  const { t } = useTranslation();
  const { formId, mode, onSubmit, showHint, ...fieldProps } = props;
  const fieldDocForm = useForm();
  const isViewMode = mode === 'view';
  const [validationErrors, setValidationErrors] =
    useState<AlertAiFormValidationErrors>({});

  const handleChange = (nextValue: ModifiedCreateEventSubscription) => {
    if (mode === 'view') {
      return;
    }

    if (Object.keys(validationErrors).length > 0) {
      setValidationErrors(validateAlertAiForm(nextValue, t));
    }

    props.onChange(nextValue);
  };

  /** Prevents browser form submission and delegates valid add/edit submits to the OSS hook. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (mode !== 'view') {
      const nextValidationErrors = validateAlertAiForm(props.value, t);

      setValidationErrors(nextValidationErrors);

      if (Object.keys(nextValidationErrors).length > 0) {
        return;
      }

      await onSubmit(props.value);
    }
  };

  return (
    <HookForm
      emptyFieldDoc={
        // width="100%" is required: EmptyPlaceholder's 300px default is wider
        // than the hint column's 260px minimum and would overflow when it
        // shrinks.
        <EmptyPlaceholder
          description={t('message.form-hint-empty-state')}
          icon={Lightbulb05}
          title={t('label.no-entity-selected', { entity: t('label.field') })}
          width="100%"
        />
      }
      fieldDocDisplay="panel"
      fieldDocHeader={
        <Box align="center" className="tw:gap-2" direction="row">
          <Lightbulb05 className="tw:size-4 tw:text-secondary" />
          <Typography
            className="tw:text-secondary"
            size="text-sm"
            weight="medium">
            {t('label.form-hint')}
          </Typography>
        </Box>
      }
      form={fieldDocForm}
      formClassName="tw:px-7 tw:pt-6 tw:pb-7"
      id={formId}
      renderFieldDoc={(markdown) => (
        // form-hint-doc carries the hint panel's typography (12.5px / 1.55 /
        // grey-600). Without it the docs inherit TipTap's defaults and render
        // larger and darker than the Data Quality panels, which is not what
        // the design asks for.
        <div className="form-hint-doc">
          <RichTextEditorPreviewerV1
            enableSeeMoreVariant={false}
            markdown={markdown}
          />
        </div>
      )}
      showFieldDocs={showHint}
      onSubmit={handleSubmit}>
      <AlertAiFormFields
        {...fieldProps}
        isViewOnly={isViewMode}
        showBasicFields={!isViewMode}
        validationErrors={validationErrors}
        onChange={isViewMode ? undefined : handleChange}
      />
    </HookForm>
  );
}

export default AlertAiForm;
