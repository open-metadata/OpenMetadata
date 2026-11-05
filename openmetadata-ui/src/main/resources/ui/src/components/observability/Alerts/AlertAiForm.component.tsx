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

import { HookForm } from '@openmetadata/ui-core-components';
import { FormEvent, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ModifiedCreateEventSubscription } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { FormHintDoc } from '../../common/atoms/drawer/formHint/FormHintDoc';
import { FormHintEmptyState } from '../../common/atoms/drawer/formHint/FormHintEmptyState';
import { FormHintHeader } from '../../common/atoms/drawer/formHint/FormHintHeader';
import AlertAiFormFields from './AlertAiFormFields.component';
import {
  AlertAiFormProps,
  AlertAiFormValidationErrors,
} from './AlertAiFormFields.interface';
import { validateAlertAiForm } from './AlertAiFormFieldsValidationUtils';

/** Wraps AI alert fields in a Core UI form and gates submit handling in view mode. */
function AlertAiForm(props: Readonly<AlertAiFormProps>) {
  const { t } = useTranslation();
  const {
    fieldDocDisplay = 'panel',
    fieldDocVariant,
    formId,
    mode,
    onSubmit,
    showHint,
    ...fieldProps
  } = props;
  const fieldDocForm = useForm();
  const isViewMode = mode === 'view';
  const [validationErrors, setValidationErrors] =
    useState<AlertAiFormValidationErrors>({});

  const handleChange = (
    valueOrUpdater:
      | ModifiedCreateEventSubscription
      | ((
          prev: ModifiedCreateEventSubscription
        ) => ModifiedCreateEventSubscription)
  ) => {
    if (mode === 'view') {
      return;
    }

    // Collate's template section sends a plain value; the rest send a functional updater. Normalise
    // to an updater so a value caller can't crash the `updater(prev)` call below, and the write
    // always composes against the latest state.
    const updater =
      typeof valueOrUpdater === 'function'
        ? valueOrUpdater
        : () => valueOrUpdater;

    if (Object.keys(validationErrors).length > 0) {
      setValidationErrors(validateAlertAiForm(updater(props.value), t));
    }

    props.onChange(updater);
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
      emptyFieldDoc={<FormHintEmptyState />}
      fieldDocDisplay={fieldDocDisplay}
      fieldDocHeader={<FormHintHeader />}
      fieldDocVariant={fieldDocVariant}
      form={fieldDocForm}
      // `relative` makes the scrolling form the containing block of the
      // visually hidden inputs react-aria renders for toggles and checkboxes.
      // Without it they overflow into the drawer, which then scrolls as well.
      // In view mode the form sits under the description card on the details
      // page, so it aligns with that card instead of carrying modal padding.
      formClassName={
        isViewMode
          ? 'tw:relative tw:pb-6'
          : 'tw:relative tw:px-7 tw:pt-6 tw:pb-7'
      }
      id={formId}
      renderFieldDoc={(markdown) => <FormHintDoc markdown={markdown} />}
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
