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
import {
  Alert,
  FieldProp,
  FieldTypes,
  FormField,
  FormItemLabel,
  FormItemLayout,
  getField,
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { FC, useCallback, useMemo, useState } from 'react';
import { UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { MAX_NAME_LENGTH } from '../../../constants/constants';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../constants/Schedular.constants';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { getScheduleOptionsFromSchedules } from '../../../utils/CronExpressionUtils';
import ScheduleIntervalV1 from '../../Settings/Services/AddIngestion/Steps/ScheduleIntervalV1';
import { AddTestCaseList } from '../AddTestCaseList/AddTestCaseList.component';
import { AddTestCaseListChangePayload } from '../AddTestCaseList/AddTestCaseList.interface';
import {
  BundleSuiteFormData,
  BundleSuiteFormProps,
} from './BundleSuiteForm.interface';

export interface BundleSuiteFormBodyProps {
  form: UseFormReturn<BundleSuiteFormData>;
  initialValues?: BundleSuiteFormProps['initialValues'];
  errorMessage?: string;
  onErrorDismiss?: () => void;
}

const BundleSuiteFormBody: FC<BundleSuiteFormBodyProps> = ({
  form,
  initialValues,
  errorMessage,
  onErrorDismiss,
}: BundleSuiteFormBodyProps) => {
  const { t } = useTranslation();
  const { config } = useLimitStore();
  const { permissions } = usePermissionProvider();
  const { ingestionPipeline } = permissions;

  const [testCaseSelectionPayload, setTestCaseSelectionPayload] =
    useState<AddTestCaseListChangePayload>(() => {
      const initialTestCases = initialValues?.testCases ?? [];

      return {
        selectAll: false,
        includeIds: initialTestCases.map((tc) => tc.id ?? '').filter(Boolean),
        excludeIds: [],
        testCases: initialTestCases,
      };
    });

  const enableScheduler = useWatch({
    control: form.control,
    name: 'enableScheduler',
  });

  const pipelineSchedules = useMemo(() => {
    return config?.limits?.config.featureLimits.find(
      (feature) => feature.name === 'dataQuality'
    )?.pipelineSchedules;
  }, [config]);

  const schedulerOptions = useMemo(() => {
    if (isEmpty(pipelineSchedules) || !pipelineSchedules) {
      return undefined;
    }

    return getScheduleOptionsFromSchedules(pipelineSchedules);
  }, [pipelineSchedules]);

  const selectedTestNames = useMemo(() => {
    return testCaseSelectionPayload.testCases
      ?.map((tc) => tc.name ?? '')
      .filter(Boolean);
  }, [testCaseSelectionPayload.testCases]);

  const handleTestCaseSelection = useCallback(
    (payload: AddTestCaseListChangePayload) => {
      setTestCaseSelectionPayload(payload);
      form.setValue('testCaseSelection', payload);
    },
    [form]
  );

  const nameField: FieldProp = {
    name: 'name',
    label: t('label.name'),
    type: FieldTypes.TEXT,
    required: true,
    placeholder: t('label.enter-entity', { entity: t('label.name') }),
    props: { 'data-testid': 'test-suite-name' },
    id: 'root/name',
    rules: {
      required: t('label.field-required', { field: t('label.name') }),
      maxLength: {
        value: MAX_NAME_LENGTH,
        message: t('message.entity-maximum-size', {
          entity: t('label.name'),
          max: MAX_NAME_LENGTH,
        }),
      },
    },
  };

  const descriptionField: FieldProp = {
    name: 'description',
    label: t('label.description'),
    type: FieldTypes.DESCRIPTION,
    required: false,
    placeholder: t('label.enter-entity', {
      entity: t('label.description'),
    }),
    props: { 'data-testid': 'test-suite-description' },
    id: 'root/description',
  };

  const enableSchedulerField: FieldProp = {
    name: 'enableScheduler',
    label: t('label.create-entity', { entity: t('label.pipeline') }),
    type: FieldTypes.SWITCH,
    required: false,
    id: 'root/enableScheduler',
    formItemLayout: FormItemLayout.HORIZONTAL,
    props: {
      'data-testid': 'scheduler-toggle',
    },
  };

  const pipelineNameField: FieldProp = {
    name: 'pipelineName',
    label: t('label.name'),
    type: FieldTypes.TEXT,
    required: false,
    placeholder: t('label.enter-entity', { entity: t('label.name') }),
    props: { 'data-testid': 'pipeline-name' },
    id: 'root/pipelineName',
  };

  const enableDebugLogField: FieldProp = {
    name: 'enableDebugLog',
    label: t('label.enable-debug-log'),
    type: FieldTypes.SWITCH,
    required: false,
    id: 'root/enableDebugLog',
    formItemLayout: FormItemLayout.HORIZONTAL,
    props: {
      'data-testid': 'enable-debug-log',
    },
  };

  const raiseOnErrorField: FieldProp = {
    name: 'raiseOnError',
    label: t('label.raise-on-error'),
    type: FieldTypes.SWITCH,
    required: false,
    id: 'root/raiseOnError',
    formItemLayout: FormItemLayout.HORIZONTAL,
    props: {
      'data-testid': 'raise-on-error',
    },
  };

  return (
    <div className="bundle-suite-form-body">
      {errorMessage && (
        <div className="floating-error-alert">
          <Alert
            closable
            title={t('label.error')}
            variant="error"
            onClose={onErrorDismiss}>
            {errorMessage}
          </Alert>
        </div>
      )}

      {getField(nameField)}

      {getField(descriptionField)}

      <FormField
        control={form.control}
        name="testCaseSelection"
        rules={{
          validate: (value) => {
            const valid =
              value && (value.selectAll || (value.includeIds?.length ?? 0) > 0);

            return valid
              ? true
              : t('label.field-required', {
                  field: t('label.test-case-plural'),
                });
          },
        }}>
        {() => (
          <div>
            <FormItemLabel required label={t('label.test-case-plural')} />
            <AddTestCaseList
              selectedTest={selectedTestNames}
              showButton={false}
              onChange={handleTestCaseSelection}
            />
          </div>
        )}
      </FormField>

      {ingestionPipeline.Create && (
        <div className="scheduler-section" data-testid="scheduler-card">
          {getField(enableSchedulerField)}

          {enableScheduler && (
            <>
              {getField(pipelineNameField)}

              <FormField control={form.control} name="cron">
                {({ field }) => (
                  <div>
                    <FormItemLabel label={t('label.schedule-interval')} />
                    <ScheduleIntervalV1
                      defaultSchedule={DEFAULT_SCHEDULE_CRON_DAILY}
                      entity={t('label.test-suite')}
                      includePeriodOptions={schedulerOptions}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </div>
                )}
              </FormField>

              {getField(enableDebugLogField)}

              {getField(raiseOnErrorField)}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default BundleSuiteFormBody;
