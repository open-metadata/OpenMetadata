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
import { HookForm } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../constants/Schedular.constants';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { TestSuite } from '../../../generated/tests/testSuite';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  addIngestionPipeline,
  deployIngestionPipelineById,
} from '../../../rest/ingestionPipelineAPI';
import {
  addTestCasesToLogicalTestSuiteBulk,
  createTestSuites,
} from '../../../rest/testAPI';
import { submitAndClose } from '../../../utils/FormDrawerUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { AiFormModal } from '../../common/atoms/drawer/AiFormModal';
import { useFormDrawerWithHook } from '../../common/atoms/drawer/useFormDrawer';
import {
  BundleSuiteFormData,
  BundleSuiteFormDrawerProps,
} from './BundleSuiteForm.interface';
import BundleSuiteFormBody from './BundleSuiteFormBody';
import {
  buildBundlePipelinePayload,
  buildCreateTestSuite,
} from './transformBundleSuiteFormData';

const BundleSuiteFormDrawer: FC<BundleSuiteFormDrawerProps> = ({
  open,
  onClose,
  onSuccess,
  initialValues,
  variant = 'classic',
  title,
  headerActions,
  width = '80vw',
}: BundleSuiteFormDrawerProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { isAirflowAvailable } = useAirflowStatus();
  const { permissions } = usePermissionProvider();
  const { ingestionPipeline } = permissions;

  const [errorMessage, setErrorMessage] = useState<string>('');

  const form = useForm<BundleSuiteFormData>({
    defaultValues: {
      enableScheduler: false,
      raiseOnError: true,
      cron: DEFAULT_SCHEDULE_CRON_DAILY,
      enableDebugLog: false,
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
    },
  });

  const createAndDeployPipeline = useCallback(
    async (values: BundleSuiteFormData, testSuite: TestSuite) => {
      try {
        const pipeline = buildBundlePipelinePayload(values, testSuite);
        const created = await addIngestionPipeline(pipeline);
        if (isAirflowAvailable) {
          await deployIngestionPipelineById(created.id ?? '');
        }
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.create-entity-error', { entity: t('label.pipeline') })
        );
      }
    },
    [isAirflowAvailable, t]
  );

  const handleFormSubmit = useCallback(
    async (values: BundleSuiteFormData) => {
      setErrorMessage('');

      const payload = buildCreateTestSuite(values, currentUser?.id);
      const testSuite = await createTestSuites(payload);

      await addTestCasesToLogicalTestSuiteBulk(testSuite.id ?? '', {
        selectAll: values.testCaseSelection?.selectAll,
        includeIds: values.testCaseSelection?.includeIds,
        excludeIds: values.testCaseSelection?.excludeIds,
      });

      if (values.enableScheduler && ingestionPipeline.Create) {
        await createAndDeployPipeline(values, testSuite);
      }

      showSuccessToast(
        t('server.create-entity-success', { entity: t('label.test-suite') })
      );

      onSuccess?.(testSuite);
    },
    [
      currentUser?.id,
      ingestionPipeline.Create,
      createAndDeployPipeline,
      onSuccess,
      t,
    ]
  );

  const handleFormSubmitWithErrorCapture = useCallback(
    async (values: BundleSuiteFormData) => {
      try {
        await handleFormSubmit(values);
      } catch (error) {
        const errorMsg =
          (error as AxiosError<{ message: string }>)?.response?.data?.message ||
          t('server.create-entity-error', { entity: t('label.test-suite') });
        setErrorMessage(errorMsg);

        throw error;
      }
    },
    [handleFormSubmit, t]
  );

  const isAiVariant = variant === 'ai';

  const bundleSuiteFormBody = (
    <BundleSuiteFormBody
      errorMessage={errorMessage}
      form={form}
      initialValues={initialValues}
      onErrorDismiss={() => setErrorMessage('')}
    />
  );

  const closeDrawerRef = useRef<() => void>(() => undefined);

  const { formDrawer, openDrawer, closeDrawer, isOpen } =
    useFormDrawerWithHook<BundleSuiteFormData>({
      className: 'bundle-suite-form-drawer',
      title:
        title ?? t('label.add-entity', { entity: t('label.bundle-suite') }),
      hookForm: form,
      submitLabel: t('label.create'),
      headerActions,
      width,
      onCancel: onClose,
      form: (
        <HookForm
          form={form}
          onSubmit={form.handleSubmit((data) =>
            submitAndClose(data, handleFormSubmitWithErrorCapture, () =>
              closeDrawerRef.current()
            )
          )}>
          {bundleSuiteFormBody}
        </HookForm>
      ),
      onSubmit: (data) =>
        submitAndClose(data, handleFormSubmitWithErrorCapture, () =>
          closeDrawerRef.current()
        ),
    });

  closeDrawerRef.current = closeDrawer;

  useEffect(() => {
    if (isAiVariant) {
      return;
    }
    if (open) {
      openDrawer();
    } else if (isOpen) {
      closeDrawer();
    }
  }, [isAiVariant, open, isOpen, openDrawer, closeDrawer]);

  if (isAiVariant) {
    return (
      <AiFormModal
        headerActions={headerActions}
        open={open}
        subtitle={t('message.page-sub-header-for-data-quality')}
        title={
          title ?? t('label.add-entity', { entity: t('label.bundle-suite') })
        }
        onClose={onClose}
        onSubmit={form.handleSubmit((data) =>
          submitAndClose(data, handleFormSubmitWithErrorCapture, onClose)
        )}>
        <HookForm
          form={form}
          onSubmit={form.handleSubmit((data) =>
            submitAndClose(data, handleFormSubmitWithErrorCapture, onClose)
          )}>
          {bundleSuiteFormBody}
        </HookForm>
      </AiFormModal>
    );
  }

  return formDrawer;
};

export default BundleSuiteFormDrawer;
