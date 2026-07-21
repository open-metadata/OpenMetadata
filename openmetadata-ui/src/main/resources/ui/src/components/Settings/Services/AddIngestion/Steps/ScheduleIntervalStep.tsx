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
  Button,
  FieldProp,
  FieldTypes,
  FormField,
  FormItemLayout,
  getField,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { RuleObject } from 'antd/lib/form';
import { LoadingState } from 'Models';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LOADING_STATE } from '../../../../../enums/common.enum';
import {
  cronValidator,
  getDefaultScheduleValue,
} from '../../../../../utils/CronExpressionUtils';
import {
  IngestionExtraConfig,
  ScheduleIntervalHandle,
  WorkflowExtraConfig,
} from './ScheduleInterval.interface';
import ScheduleIntervalV1 from './ScheduleIntervalV1';

export interface ScheduleIntervalStepProps {
  status: LoadingState;
  initialData?: WorkflowExtraConfig & IngestionExtraConfig;
  defaultSchedule?: string;
  includePeriodOptions?: string[];
  disabled?: boolean;
  isEditMode?: boolean;
  showActionButtons?: boolean;
  buttonProps?: {
    okText?: string;
    cancelText?: string;
  };
  onBack?: () => void;
  onDeploy?: (values: WorkflowExtraConfig & IngestionExtraConfig) => void;
  onFocus?: (fieldName: string) => void;
}

interface ScheduleIntervalStepFormData {
  cron?: string;
  retries?: number | string;
  raiseOnError?: boolean;
}

// An empty cron reaching here means the On Demand card is selected, everything
// else goes through the same checks the legacy scheduler applied, including the
// "less than an hour" guard.
const validateCron = async (value?: string) => {
  let result: string | boolean = true;

  if (value) {
    try {
      await cronValidator({} as RuleObject, value);
    } catch (error) {
      result = (error as Error).message;
    }
  }

  return result;
};

const ScheduleIntervalStep = forwardRef<
  ScheduleIntervalHandle,
  ScheduleIntervalStepProps
>(function ScheduleIntervalStep(
  {
    status,
    initialData,
    defaultSchedule,
    includePeriodOptions,
    disabled,
    isEditMode = false,
    showActionButtons = true,
    buttonProps,
    onBack,
    onDeploy,
    onFocus,
  }: Readonly<ScheduleIntervalStepProps>,
  ref
) {
  const { t } = useTranslation();

  // In edit mode an empty cron means "on demand" and must be preserved as is,
  // while a new pipeline falls back to the default schedule.
  const form = useForm<ScheduleIntervalStepFormData>({
    defaultValues: {
      cron: isEditMode
        ? initialData?.cron
        : initialData?.cron ??
          getDefaultScheduleValue({
            defaultSchedule,
            includePeriodOptions,
            allowNoSchedule: true,
          }),
      retries: initialData?.retries ?? 0,
      raiseOnError: initialData?.raiseOnError ?? true,
    },
  });

  // The scheduler renders its own inline message for an unusable custom cron,
  // so this only has to stop the submit - hence a message-less `false` below.
  const isSchedulerValidRef = useRef(true);

  const handleSchedulerValidityChange = useCallback((isValid: boolean) => {
    isSchedulerValidRef.current = isValid;
  }, []);

  const handleFinish = (data: ScheduleIntervalStepFormData) => {
    onDeploy?.({
      cron: data.cron || undefined,
      retries: Number(data.retries ?? 0),
      raiseOnError: data.raiseOnError ?? true,
    });
  };

  const submitForm = form.handleSubmit(handleFinish);

  // Exposes submit to the parent card footer, which triggers the form when showActionButtons is false.
  useImperativeHandle(ref, () => ({ submit: () => submitForm() }), [
    submitForm,
  ]);

  const retriesField: FieldProp = useMemo(
    () => ({
      name: 'retries',
      label: t('label.number-of-retries'),
      type: FieldTypes.NUMBER,
      required: false,
      id: 'root/retries',
      props: {
        'data-testid': 'retries',
        onFocus: () => onFocus?.('root/retries'),
      },
    }),
    [t, onFocus]
  );

  const raiseOnErrorField: FieldProp = useMemo(
    () => ({
      name: 'raiseOnError',
      label: t('label.raise-on-error'),
      type: FieldTypes.SWITCH,
      required: false,
      id: 'root/raiseOnError',
      formItemLayout: FormItemLayout.HORIZONTAL,
      props: {
        'data-testid': 'raise-on-error',
        onFocus: () => onFocus?.('raiseOnError'),
      },
    }),
    [t, onFocus]
  );

  return (
    <HookForm
      className="tw:flex tw:flex-col tw:gap-4"
      data-testid="schedule-interval-container"
      form={form}
      onSubmit={submitForm}>
      <FormField
        control={form.control}
        name="cron"
        rules={{
          validate: (value) =>
            isSchedulerValidRef.current ? validateCron(value) : false,
        }}>
        {({ field, fieldState }) => (
          <>
            <ScheduleIntervalV1
              defaultSchedule={defaultSchedule}
              disabled={disabled}
              entity={t('label.ingestion')}
              includePeriodOptions={includePeriodOptions}
              value={field.value || undefined}
              onChange={(cron) => field.onChange(cron ?? '')}
              onValidityChange={handleSchedulerValidityChange}
            />
            {fieldState.error?.message && (
              <Typography
                className="tw:text-fg-error-primary"
                data-testid="cron-error"
                size="text-xs">
                {fieldState.error.message}
              </Typography>
            )}
          </>
        )}
      </FormField>

      {getField(retriesField)}

      {getField(raiseOnErrorField)}

      {showActionButtons && (
        <div className="tw:flex tw:items-center tw:justify-end tw:gap-3">
          <Button
            color="secondary"
            data-testid="back-button"
            size="sm"
            type="button"
            onPress={onBack}>
            {buttonProps?.cancelText ?? t('label.back')}
          </Button>
          <Button
            color="primary"
            data-testid="deploy-button"
            isLoading={status === LOADING_STATE.WAITING}
            size="sm"
            type="submit">
            {buttonProps?.okText ?? t('label.create')}
          </Button>
        </div>
      )}
    </HookForm>
  );
});

export default ScheduleIntervalStep;
