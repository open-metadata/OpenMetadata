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
import { Box, HookForm, Typography } from '@openmetadata/ui-core-components';
import { Lightbulb05 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  FORM_DRAWER_WIDTH_WITHOUT_HINT,
  FORM_DRAWER_WIDTH_WITH_HINT,
} from '../../../constants/common/formHint.constants';
import {
  createTestDefinition,
  patchTestDefinition,
} from '../../../rest/testAPI';
import { monospaceParameterNames } from '../../../utils/DataQuality/FormHintDocUtils';
import { createScrollToErrorHandler } from '../../../utils/formPureUtils';
import {
  isExternalTestDefinition,
  isSystemTestDefinition,
} from '../../../utils/TestDefinitionUtils';
import { showSuccessToast } from '../../../utils/ToastUtils';
import { ShowHintToggle } from '../../common/atoms/drawer/ShowHintToggle';
import { useFormDrawerWithHook } from '../../common/atoms/drawer/useFormDrawer';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
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
  const [showHint, setShowHint] = useState(true);

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

  const scrollToError = useMemo(
    () =>
      createScrollToErrorHandler({
        errorSelector: '[aria-invalid="true"], [data-invalid="true"]',
      }),
    []
  );

  // Raw RHF success handler. Passed to `useFormDrawerWithHook.onSubmit`, which
  // runs it through a single `hookForm.handleSubmit`; the form's own submit
  // (Enter in a field) needs the pre-wrapped `submitAndClose` below.
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

  const submitAndClose = useMemo(
    () => form.handleSubmit(onValidSubmit, () => scrollToError()),
    [form, onValidSubmit, scrollToError]
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

  const drawerForm = (
    <HookForm
      emptyFieldDoc={
        // width="100%" is required: EmptyPlaceholder's 300px default is
        // wider than the hint column's 260px minimum and would overflow
        // once the column shrinks on a narrow viewport.
        <NoDataPlaceholder
          description={t('message.form-hint-empty-state')}
          icon={Lightbulb05}
          title={t('label.no-entity-selected', {
            entity: t('label.field'),
          })}
          width="100%"
        />
      }
      fieldDocDisplay="panel"
      fieldDocHeader={
        <Box align="center" className="tw:gap-2" direction="row">
          <Lightbulb05 aria-hidden className="tw:size-4 tw:text-secondary" />
          <Typography
            className="tw:whitespace-nowrap tw:text-secondary"
            size="text-sm"
            weight="medium">
            {t('label.form-hint')}
          </Typography>
        </Box>
      }
      form={form}
      // This column, not the drawer body, scrolls, so it is the scroll-to-error target.
      formClassName="drawer-form-content tw:px-4 tw:py-6 tw:md:px-6"
      renderFieldDoc={(markdown) => (
        <div className="form-hint-doc">
          <RichTextEditorPreviewerV1
            enableSeeMoreVariant={false}
            markdown={monospaceParameterNames(markdown)}
          />
        </div>
      )}
      showFieldDocs={showHint}
      onSubmit={submitAndClose}>
      {formBody}
    </HookForm>
  );

  // pr-10 clears the header's absolutely positioned close button.
  const hintToggle = (
    <Box className="tw:pr-10">
      <ShowHintToggle isSelected={showHint} onChange={setShowHint} />
    </Box>
  );

  const drawerTitle = (
    <Typography data-testid="form-heading" size="text-md" weight="medium">
      {resolvedTitle}
    </Typography>
  );

  const { formDrawer, openDrawer, closeDrawer, isOpen } =
    useFormDrawerWithHook<TestDefinitionFormValues>({
      className: 'test-definition-form-drawer',
      title: drawerTitle,
      hookForm: form,
      form: drawerForm,
      headerActions: hintToggle,
      // Columns scroll on their own: drop Content's padding, gap and stacking.
      body: { className: 'tw:flex-row tw:gap-0 tw:px-0 tw:md:px-0' },
      // Without the hint, narrow the drawer instead of stretching the form.
      width: showHint
        ? FORM_DRAWER_WIDTH_WITH_HINT
        : FORM_DRAWER_WIDTH_WITHOUT_HINT,
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

  useEffect(() => {
    if (open) {
      openDrawer();
    }
  }, [open, openDrawer]);

  useEffect(() => {
    if (!open && isOpen) {
      closeDrawer();
    }
  }, [open, isOpen, closeDrawer]);

  return formDrawer;
};

export default TestDefinitionForm;
