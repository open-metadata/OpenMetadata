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
import { Grid } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../../constants/Schedular.constants';
import { TEST_SUITE_PIPELINE_FORM } from '../../../../constants/service-guide.constant';
import { useAirflowStatus } from '../../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import { Table } from '../../../../generated/entity/data/table';
import { IngestionPipeline } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestSuite } from '../../../../generated/tests/testSuite';
import { EntityReference } from '../../../../generated/type/entityReference';
import { useFormFieldDocs } from '../../../../hooks/useFormFieldDocs';
import {
  addIngestionPipeline,
  deployIngestionPipelineById,
  updateIngestionPipeline,
} from '../../../../rest/ingestionPipelineAPI';
import {
  getDefaultScheduleValue,
  getScheduleOptionsFromSchedules,
} from '../../../../utils/CronExpressionUtils';
import { submitAndClose } from '../../../../utils/FormDrawerUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { useFormDrawerWithHook } from '../../../common/atoms/drawer/useFormDrawer';
import {
  buildTestSuiteIngestionPatch,
  buildTestSuiteIngestionPayload,
  getTestSuitePipelineFormDefaults,
  getTestSuitePipelineScope,
  toTestSuiteIngestionData,
} from './TestSuitePipelineForm.utils';
import TestSuitePipelineFormFields, {
  TestSuitePipelineFormValues,
} from './TestSuitePipelineFormFields';

export interface TestSuitePipelineFormDrawerProps {
  open: boolean;
  /** Host table; its basic test suite owns the pipeline. */
  table?: Table;
  /** Host suite, for a logical (bundle) suite or when no table is known. */
  testSuite?: TestSuite | EntityReference;
  /** The pipeline to edit; omit to add one. */
  ingestionPipeline?: IngestionPipeline;
  onClose: () => void;
  onSuccess: () => void;
}

const TestSuitePipelineFormDrawer = ({
  open,
  table,
  testSuite,
  ingestionPipeline,
  onClose,
  onSuccess,
}: TestSuitePipelineFormDrawerProps) => {
  const { t } = useTranslation();
  const isEditMode = Boolean(ingestionPipeline);
  const { testSuiteId, tableFqn, nameFqn } = getTestSuitePipelineScope({
    table,
    testSuite,
    ingestionPipeline,
  });
  const { isAirflowAvailable } = useAirflowStatus();
  const { config } = useLimitStore();
  const [isSchedulerValid, setIsSchedulerValid] = useState(true);
  const fieldDocs = useFormFieldDocs(TEST_SUITE_PIPELINE_FORM);

  const pipelineSchedules = config?.limits?.config.featureLimits.find(
    (feature) => feature.name === 'dataQuality'
  )?.pipelineSchedules;

  const schedulerOptions = useMemo(
    () =>
      isEmpty(pipelineSchedules) || !pipelineSchedules
        ? undefined
        : getScheduleOptionsFromSchedules(pipelineSchedules),
    [pipelineSchedules]
  );

  const defaultValues = useMemo(
    () =>
      getTestSuitePipelineFormDefaults(
        ingestionPipeline,
        getDefaultScheduleValue({
          defaultSchedule: DEFAULT_SCHEDULE_CRON_DAILY,
          includePeriodOptions: schedulerOptions,
          allowNoSchedule: true,
        })
      ),
    [ingestionPipeline, schedulerOptions]
  );

  const form = useForm<TestSuitePipelineFormValues>({ defaultValues });

  // The host stays mounted between opens, so seed the form on every open:
  // the pipeline being edited, or blank values for a new one.
  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, defaultValues]);

  const savePipeline = useCallback(
    async (values: TestSuitePipelineFormValues) => {
      const data = toTestSuiteIngestionData(values);
      if (ingestionPipeline) {
        return updateIngestionPipeline(
          ingestionPipeline.id ?? '',
          buildTestSuiteIngestionPatch(ingestionPipeline, data)
        );
      }

      return addIngestionPipeline(
        buildTestSuiteIngestionPayload(data, {
          testSuiteId,
          nameFqn,
          entityFqn: tableFqn,
        })
      );
    },
    [ingestionPipeline, testSuiteId, nameFqn, tableFqn]
  );

  const handleSubmit = useCallback(
    async (values: TestSuitePipelineFormValues) => {
      // The scheduler renders its own cron error; only block the submit here.
      if (!isSchedulerValid) {
        throw new Error('invalid schedule');
      }

      let ingestionId: string | undefined;
      try {
        const ingestion = await savePipeline(values);
        ingestionId = ingestion.id;
      } catch (error) {
        showErrorToast(error as AxiosError);

        // Rethrow so submitAndClose keeps the drawer open for a retry.
        throw error;
      }

      // The pipeline is saved even if deploy fails; it can be redeployed from
      // the list, so a deploy error must not keep the drawer open.
      if (isAirflowAvailable && ingestionId) {
        try {
          await deployIngestionPipelineById(ingestionId);
        } catch (error) {
          showErrorToast(
            error as AxiosError,
            t('server.deploy-entity-error', {
              entity: t('label.ingestion-workflow-lowercase'),
            })
          );
        }
      }

      showSuccessToast(
        t(
          isEditMode
            ? 'server.update-entity-success'
            : 'server.create-entity-success',
          { entity: t('label.pipeline') }
        )
      );
      onSuccess();
    },
    [
      isSchedulerValid,
      savePipeline,
      isAirflowAvailable,
      isEditMode,
      onSuccess,
      t,
    ]
  );

  const closeDrawerRef = useRef<() => void>(() => undefined);
  const submit = (values: TestSuitePipelineFormValues) =>
    submitAndClose(values, handleSubmit, () => closeDrawerRef.current());

  const handleDismiss = useCallback(() => {
    form.reset(defaultValues);
    onClose();
  }, [form, defaultValues, onClose]);

  const { formDrawer, closeDrawer } =
    useFormDrawerWithHook<TestSuitePipelineFormValues>({
      // Matches the test case drawer: the core SlideoutMenu overlay has no
      // z-index, and 40 stays below select popovers (z-50).
      className: 'test-suite-pipeline-form-drawer tw:z-40',
      testId: 'test-suite-pipeline-form-drawer',
      title: t(isEditMode ? 'label.edit-entity' : 'label.add-entity', {
        entity: t('label.pipeline'),
      }),
      hookForm: form,
      formHint: {},
      form: (
        <Grid className="layout-row layout-grid" rowGap="4">
          <TestSuitePipelineFormFields
            fieldDocs={fieldDocs}
            form={form}
            includePeriodOptions={schedulerOptions}
            tableFqn={tableFqn}
            // A table's basic suite is scoped by the table; a bundle suite by
            // its own id.
            testSuiteId={tableFqn ? undefined : testSuiteId}
            onSchedulerValidityChange={setIsSchedulerValid}
          />
        </Grid>
      ),
      open,
      submitLabel: isEditMode ? t('label.save') : t('label.create'),
      submitTestId: 'deploy-button',
      cancelTestId: 'cancel-button',
      onClose: handleDismiss,
      onSubmit: submit,
    });

  closeDrawerRef.current = closeDrawer;

  return formDrawer;
};

export default TestSuitePipelineFormDrawer;
