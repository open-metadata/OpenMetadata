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
  Card,
  FieldProp,
  FieldTypes,
  FormField,
  FormItemLabel,
  FormItemLayout,
  getField,
  HelperTextType,
} from '@openmetadata/ui-core-components';
import { FC, useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../../constants/Schedular.constants';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import { escapeESReservedCharacters } from '../../../../utils/StringUtils';
import ScheduleInterval from '../../../Settings/Services/AddIngestion/Steps/ScheduleInterval';
import { AddTestCaseList } from '../../AddTestCaseList/AddTestCaseList.component';
import {
  isValidTestCaseSelection,
  normalizeSelectedTestProp,
} from '../../AddTestCaseList/AddTestCaseListForm.utils';
import { TestCaseSchedulerSectionProps } from './TestCaseFormV1.interface';

const TestCaseSchedulerSection: FC<TestCaseSchedulerSectionProps> = ({
  form,
  table,
  testSuite,
  selectedTableData,
  hasTestSuite,
  canCreatePipeline,
  schedulerOptions,
  onActiveFieldChange,
}: TestCaseSchedulerSectionProps) => {
  const { t } = useTranslation();

  const selectAllTestCases = useWatch({
    control: form.control,
    name: 'selectAllTestCases',
  });
  const createPipeline = useWatch({
    control: form.control,
    name: 'createPipeline',
  });

  const isSelectAllTestCasesEnabled = Boolean(
    hasTestSuite && canCreatePipeline
  );

  const createPipelineField = {
    name: 'createPipeline',
    label: t('label.create-entity', {
      entity: t('label.pipeline'),
    }),
    type: FieldTypes.SWITCH,
    required: false,
    id: 'root/createPipeline',
    helperText: t('message.pipeline-entity-description', {
      entity: t('label.test-case'),
    }),
    helperTextType: HelperTextType.TOOLTIP,
    formItemLayout: FormItemLayout.HORIZONTAL,
    props: {
      'data-testid': 'create-pipeline',
    },
  } as FieldProp;

  const selectAllField = {
    name: 'selectAllTestCases',
    label: t('label.select-all-entity', {
      entity: t('label.test-case-plural'),
    }),
    type: FieldTypes.SWITCH,
    required: false,
    id: 'root/selectAllTestCases',
    formItemLayout: FormItemLayout.HORIZONTAL,
    props: {
      'data-testid': 'select-all-test-cases',
    },
  } as FieldProp;

  const pipelineNameField = {
    name: 'pipelineName',
    label: t('label.name'),
    type: FieldTypes.TEXT,
    required: false,
    id: 'root/pipelineName',
    placeholder: t('label.enter-entity', { entity: t('label.name') }),
    props: {
      'data-testid': 'pipeline-name',
    },
  } as FieldProp;

  const enableDebugLogField = {
    name: 'enableDebugLog',
    label: t('label.enable-debug-log'),
    type: FieldTypes.SWITCH,
    required: false,
    id: 'root/enableDebugLog',
    formItemLayout: FormItemLayout.HORIZONTAL,
    props: {
      'data-testid': 'enable-debug-log',
    },
  } as FieldProp;

  const raiseOnErrorField = {
    name: 'raiseOnError',
    label: t('label.raise-on-error'),
    type: FieldTypes.SWITCH,
    required: false,
    id: 'root/raiseOnError',
    formItemLayout: FormItemLayout.HORIZONTAL,
    props: {
      'data-testid': 'raise-on-error',
    },
  } as FieldProp;

  const columnFilters = useMemo(
    () =>
      table?.fullyQualifiedName
        ? `fullyQualifiedName:"${escapeESReservedCharacters(
            table.fullyQualifiedName
          )}"`
        : undefined,
    [table]
  );

  const testCaseParams = useMemo(
    () => ({
      testSuiteId: testSuite?.id ?? selectedTableData?.testSuite?.id,
    }),
    [testSuite, selectedTableData]
  );

  return (
    // The gap matches the 20px (@size-mlg) between the form's other sections.
    <div
      className="test-case-scheduler-section tw:flex tw:flex-col tw:gap-5"
      data-testid="scheduler-card">
      {createPipeline && (
        <Alert closable={false} title="" variant="gray">
          <Transi18next
            i18nKey="message.entity-pipeline-information"
            renderElement={<strong />}
            values={{
              entity: t('label.test-case-lowercase'),
              type: t('label.table-lowercase'),
            }}
          />
        </Alert>
      )}

      <Card
        className="form-card-section scheduler-card"
        id="root/cron"
        role="presentation"
        onClick={() => onActiveFieldChange?.('root/cron')}>
        <Card.Content className="tw:flex tw:flex-col tw:gap-4">
          {getField(createPipelineField)}

          {createPipeline && isSelectAllTestCasesEnabled && (
            <>
              {getField(selectAllField)}

              {!selectAllTestCases && (
                <FormField
                  control={form.control}
                  name="testCases"
                  rules={{
                    validate: (value) =>
                      isValidTestCaseSelection(value) ||
                      t('label.field-required', {
                        field: t('label.test-case'),
                      }),
                  }}>
                  {({ field }) => (
                    <div data-testid="test-cases-field">
                      <FormItemLabel required label={t('label.test-case')} />
                      <AddTestCaseList
                        columnFilters={columnFilters}
                        hideTableFilter={Boolean(table)}
                        selectedTest={normalizeSelectedTestProp(field.value)}
                        showButton={false}
                        testCaseParams={testCaseParams}
                        onChange={field.onChange}
                      />
                    </div>
                  )}
                </FormField>
              )}
            </>
          )}

          {createPipeline && (
            <>
              {getField(pipelineNameField)}

              <FormField control={form.control} name="cron">
                {({ field }) => (
                  <ScheduleInterval
                    defaultSchedule={DEFAULT_SCHEDULE_CRON_DAILY}
                    entity={t('label.test-case')}
                    includePeriodOptions={schedulerOptions}
                    value={field.value || undefined}
                    onChange={(cron) => field.onChange(cron ?? '')}
                  />
                )}
              </FormField>

              {getField(enableDebugLogField)}

              {getField(raiseOnErrorField)}
            </>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};

export default TestCaseSchedulerSection;
