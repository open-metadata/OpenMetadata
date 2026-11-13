/*
 *  Copyright 2024 Collate.
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
import { Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  createTestDefinition,
  patchTestDefinition,
} from '../../../rest/testAPI';
import { monospaceParameterNames } from '../../../utils/DataQuality/FormHintDocUtils';
import {
  isExternalTestDefinition,
  isSystemTestDefinition,
} from '../../../utils/TestDefinitionUtils';
import { showSuccessToast } from '../../../utils/ToastUtils';
import { FormHintDoc } from '../../common/atoms/drawer/formHint/FormHintDoc';
import { useFormDrawerWithHook } from '../../common/atoms/drawer/useFormDrawer';
import {
  TestDefinitionFormProps,
  TestDefinitionFormValues,
} from './TestDefinitionForm.interface';
import TestDefinitionFormBody from './TestDefinitionFormBody';
import {
  buildCreateTestDefinitionPayload,
  buildEditPatch,
  buildFormDefaults,
} from './transformTestDefinitionFormData';

const TestDefinitionForm: FC<TestDefinitionFormProps> = ({
  open,
  initialValues,
  onSuccess,
  onCancel,
  title,
}) => {
  const { t } = useTranslation();
  const isEditMode = Boolean(initialValues);

  // A system test definition is editable, but only its data quality dimension is: every other
  // field is rendered read-only, exactly like an externally-managed definition.
  const isSystemProvider = useMemo(
    () => isEditMode && isSystemTestDefinition(initialValues),
    [initialValues, isEditMode]
  );

  const isReadOnlyField = useMemo(
    () =>
      isSystemProvider ||
      (isEditMode && isExternalTestDefinition(initialValues)),
    [initialValues, isEditMode, isSystemProvider]
  );

  const form = useForm<TestDefinitionFormValues>({
    mode: 'onChange',
    defaultValues: buildFormDefaults(initialValues),
  });

  const [errorMessage, setErrorMessage] = useState('');

  const resolvedTitle =
    title ??
    (isEditMode
      ? t('label.edit-entity', { entity: t('label.test-definition') })
      : t('label.add-entity', { entity: t('label.test-definition') }));

  const handleErrorDismiss = useCallback(() => setErrorMessage(''), []);

  const submitEdit = useCallback(
    async (values: TestDefinitionFormValues) => {
      if (!initialValues) {
        return;
      }
      const patch = buildEditPatch(
        initialValues,
        values,
        form.formState.dirtyFields,
        // The server rejects anything else on a system test definition, so a stray op — a
        // field the form normalized differently, say — would fail the whole update.
        isSystemProvider
      );
      if (patch.length === 0) {
        onSuccess();

        return;
      }
      const result = await patchTestDefinition(initialValues.id ?? '', patch);
      showSuccessToast(
        t('server.entity-updated-success', {
          entity: t('label.test-definition'),
        })
      );
      onSuccess(result);
    },
    [form, initialValues, isSystemProvider, onSuccess, t]
  );

  const submitCreate = useCallback(
    async (values: TestDefinitionFormValues) => {
      await createTestDefinition(buildCreateTestDefinitionPayload(values));
      showSuccessToast(
        t('server.entity-created-success', {
          entity: t('label.test-definition'),
        })
      );
      onSuccess();
    },
    [onSuccess, t]
  );

  const handleSubmit = useCallback(
    async (values: TestDefinitionFormValues) => {
      setErrorMessage('');
      try {
        if (isEditMode) {
          await submitEdit(values);
        } else {
          await submitCreate(values);
        }
      } catch (error) {
        setErrorMessage(
          (error as AxiosError<{ message: string }>)?.response?.data?.message ||
            t(
              isEditMode
                ? 'server.update-entity-error'
                : 'server.create-entity-error',
              { entity: t('label.test-definition') }
            )
        );

        throw error;
      }
    },
    [isEditMode, submitEdit, submitCreate, t]
  );

  const handleDismiss = useCallback(() => {
    form.reset();
    onCancel();
  }, [form, onCancel]);

  // Raw RHF success handler. `useFormDrawerWithHook` runs it through a single
  // `hookForm.handleSubmit` for both the footer button and the form's own
  // submit (Enter in a field).
  const onValidSubmit = useCallback(
    async (data: TestDefinitionFormValues) => {
      try {
        await handleSubmit(data);
        handleDismiss();
      } catch {
        // error surfaced inline via errorMessage; keep the form open
      }
    },
    [handleSubmit, handleDismiss]
  );

  const formBody = (
    <TestDefinitionFormBody
      errorMessage={errorMessage}
      form={form}
      isEditMode={isEditMode}
      isReadOnlyField={isReadOnlyField}
      onErrorDismiss={handleErrorDismiss}
    />
  );

  const drawerTitle = (
    <Typography data-testid="form-heading" size="text-md" weight="medium">
      {resolvedTitle}
    </Typography>
  );

  const { formDrawer } = useFormDrawerWithHook<TestDefinitionFormValues>({
    className: 'test-definition-form-drawer',
    title: drawerTitle,
    hookForm: form,
    form: formBody,
    formHint: {
      renderDoc: (markdown) => (
        <FormHintDoc markdown={monospaceParameterNames(markdown)} />
      ),
    },
    open,
    submitLabel: t('label.save'),
    submitTestId: 'save-test-definition',
    onClose: handleDismiss,
    onSubmit: onValidSubmit,
  });

  // react-hook-form applies defaultValues only on the first render; re-seed the
  // form on every open and whenever the target entity reference changes (edit a
  // different definition, create↔edit, or a same-id refetch) so a persistently
  // mounted form never shows stale values. Seeding on open, before the fields
  // mount, matters for the drawer: its fields stay mounted while it slides out
  // and re-register their last value, undoing a reset made on close. Callers
  // pass a stable `initialValues` ref per selection, so this does not loop.
  useEffect(() => {
    if (open) {
      form.reset(buildFormDefaults(initialValues));
    }
  }, [open, initialValues, form]);

  return formDrawer;
};

export default TestDefinitionForm;
