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
import { HookForm } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  OPEN_METADATA,
  TEST_DEFINITION_FORM,
} from '../../../constants/service-guide.constant';
import { ServiceCategory } from '../../../enums/service.enum';
import {
  createTestDefinition,
  patchTestDefinition,
} from '../../../rest/testAPI';
import { createScrollToErrorHandler } from '../../../utils/formPureUtils';
import { isExternalTestDefinition } from '../../../utils/TestDefinitionUtils';
import { showSuccessToast } from '../../../utils/ToastUtils';
import { useFormDrawerWithHook } from '../../common/atoms/drawer/useFormDrawer';
import ServiceDocPanel from '../../common/ServiceDocPanel/ServiceDocPanel';
import {
  TestDefinitionFormProps,
  TestDefinitionFormValues,
} from './TestDefinitionForm.interface';
import TestDefinitionFormBody from './TestDefinitionFormBody';
import TestDefinitionFormModal from './TestDefinitionFormModal';
import {
  buildCreateTestDefinitionPayload,
  buildEditPatch,
  buildFormDefaults,
} from './transformTestDefinitionFormData';

const TestDefinitionForm: FC<TestDefinitionFormProps> = ({
  open,
  variant = 'drawer',
  initialValues,
  onSuccess,
  onCancel,
  title,
}) => {
  const { t } = useTranslation();
  const isEditMode = Boolean(initialValues);
  const isModalVariant = variant === 'modal';

  const isReadOnlyField = useMemo(
    () => isEditMode && isExternalTestDefinition(initialValues),
    [initialValues, isEditMode]
  );

  const form = useForm<TestDefinitionFormValues>({
    mode: 'onChange',
    defaultValues: buildFormDefaults(initialValues),
  });

  const [errorMessage, setErrorMessage] = useState('');
  const [activeField, setActiveField] = useState('');

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
      const patch = buildEditPatch(initialValues, values);
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
    [initialValues, onSuccess, t]
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

  const submitAndClose = useMemo(
    () =>
      form.handleSubmit(
        async (data) => {
          try {
            await handleSubmit(data);
            handleDismiss();
          } catch {
            // error surfaced inline via errorMessage; keep the form open
          }
        },
        () => scrollToError()
      ),
    [form, handleSubmit, handleDismiss, scrollToError]
  );

  const formBody = (
    <TestDefinitionFormBody
      errorMessage={errorMessage}
      form={form}
      isEditMode={isEditMode}
      isReadOnlyField={isReadOnlyField}
      onActiveFieldChange={setActiveField}
      onErrorDismiss={handleErrorDismiss}
    />
  );

  const drawerForm = (
    <HookForm
      className="tw:flex tw:min-h-0 tw:w-full tw:flex-1 tw:flex-col"
      form={form}
      onSubmit={submitAndClose}>
      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:gap-6">
        <div className="drawer-form-content tw:min-h-0 tw:min-w-0 tw:basis-[60%] tw:overflow-y-auto tw:py-6 tw:pr-2">
          {formBody}
        </div>
        <div
          className={classNames(
            'drawer-doc-panel service-doc-panel markdown-parser',
            'tw:my-6 tw:mr-6 tw:min-h-0 tw:min-w-0 tw:basis-[40%]',
            'tw:overflow-y-auto tw:rounded-xl tw:border',
            'tw:border-solid tw:border-gray-200 tw:px-5'
          )}>
          <ServiceDocPanel
            activeField={activeField}
            serviceName={TEST_DEFINITION_FORM}
            serviceType={OPEN_METADATA as ServiceCategory}
          />
        </div>
      </div>
    </HookForm>
  );

  const { formDrawer, openDrawer, closeDrawer, isOpen } =
    useFormDrawerWithHook<TestDefinitionFormValues>({
      className: 'test-definition-form-drawer',
      title: resolvedTitle,
      hookForm: form,
      form: drawerForm,
      width: '80vw',
      submitLabel: t('label.save'),
      submitTestId: 'save-test-definition',
      onClose: handleDismiss,
      onSubmit: () => submitAndClose(),
    });

  useEffect(() => {
    if (isModalVariant) {
      return;
    }
    if (open) {
      openDrawer();
    } else if (isOpen) {
      closeDrawer();
    }
  }, [isModalVariant, open, isOpen, openDrawer, closeDrawer]);

  if (isModalVariant) {
    return (
      <TestDefinitionFormModal
        isSubmitting={form.formState.isSubmitting}
        open={open}
        submitLabel={t('label.save')}
        subtitle={t('message.page-sub-header-for-test-definitions')}
        title={resolvedTitle}
        onClose={handleDismiss}
        onSubmit={submitAndClose}>
        <HookForm form={form} onSubmit={submitAndClose}>
          {formBody}
        </HookForm>
      </TestDefinitionFormModal>
    );
  }

  return formDrawer;
};

export default TestDefinitionForm;
