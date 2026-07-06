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
import { FC, useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../../constants/Schedular.constants';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import { escapeESReservedCharacters } from '../../../../utils/StringUtils';
import ScheduleIntervalV1 from '../../../Settings/Services/AddIngestion/Steps/ScheduleIntervalV1';
import { AddTestCaseList } from '../../AddTestCaseList/AddTestCaseList.component';
import { AddTestCaseListChangePayload } from '../../AddTestCaseList/AddTestCaseList.interface';
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

  const isSelectAllTestCasesEnabled = Boolean(
    hasTestSuite && canCreatePipeline
  );

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
    <div
      className="test-case-scheduler-section"
      data-testid="scheduler-section">
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

      <div
        className="form-card-section scheduler-card"
        id="root/cron"
        onClick={() => onActiveFieldChange?.('root/cron')}>
        <div className="card-title-container">
          <p className="card-title-text">
            {t('label.create-entity', {
              entity: t('label.pipeline'),
            })}
          </p>
          <p className="card-title-description">
            {t('message.pipeline-entity-description', {
              entity: t('label.test-case'),
            })}
          </p>
        </div>

        {isSelectAllTestCasesEnabled && (
          <>
            {getField(selectAllField)}

            {!selectAllTestCases && (
              <FormField
                control={form.control}
                name="testCases"
                rules={{
                  required: t('label.field-required', {
                    field: t('label.test-case'),
                  }),
                }}>
                {({ field }) => (
                  <div data-testid="test-cases-field">
                    <FormItemLabel required label={t('label.test-case')} />
                    <AddTestCaseList
                      columnFilters={columnFilters}
                      hideTableFilter={Boolean(table)}
                      selectedTest={(field.value ?? []).map(
                        (testCase) => testCase.name ?? ''
                      )}
                      showButton={false}
                      testCaseParams={testCaseParams}
                      onChange={(payload: AddTestCaseListChangePayload) =>
                        field.onChange(
                          payload.testCases.map((testCase) => ({
                            id: testCase.id,
                            name: testCase.name,
                            type: 'testCase',
                          }))
                        )
                      }
                    />
                  </div>
                )}
              </FormField>
            )}
          </>
        )}

        {getField(pipelineNameField)}

        <FormField control={form.control} name="cron">
          {({ field }) => (
            <ScheduleIntervalV1
              defaultSchedule={DEFAULT_SCHEDULE_CRON_DAILY}
              entity={t('label.test-case')}
              includePeriodOptions={schedulerOptions}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        </FormField>

        {getField(enableDebugLogField)}

        {getField(raiseOnErrorField)}
      </div>
    </div>
  );
};

export default TestCaseSchedulerSection;
