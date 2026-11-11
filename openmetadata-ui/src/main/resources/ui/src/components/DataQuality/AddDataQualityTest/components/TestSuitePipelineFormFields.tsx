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
import {
  Box,
  Card,
  FieldProp,
  FieldTypes,
  FormField,
  FormItemLabel,
  FormItemLayout,
  getField,
  Grid,
  HintText,
  Input,
  useFieldDoc,
} from '@openmetadata/ui-core-components';
import { Fragment, useMemo, useRef } from 'react';
import { UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../../constants/Schedular.constants';
import { useSeedFirstFieldDoc } from '../../../../hooks/useSeedFirstFieldDoc';
import { ListTestCaseParamsBySearch } from '../../../../rest/testAPI';
import { escapeESReservedCharacters } from '../../../../utils/StringUtils';
import ScheduleInterval from '../../../Settings/Services/AddIngestion/Steps/ScheduleInterval';
import { WorkflowExtraConfig } from '../../../Settings/Services/AddIngestion/Steps/ScheduleInterval.types';
import { AddTestCaseList } from '../../AddTestCaseList/AddTestCaseList.component';
import { isValidTestCaseSelection } from '../../AddTestCaseList/AddTestCaseListForm.utils';
import { TestSuiteIngestionDataType } from '../AddDataQualityTest.interface';

export type TestSuitePipelineFormValues = WorkflowExtraConfig &
  TestSuiteIngestionDataType;

interface TestSuitePipelineFormFieldsProps {
  form: UseFormReturn<TestSuitePipelineFormValues>;
  includePeriodOptions?: string[];
  testSuiteId?: string;
  tableFqn?: string;
  // Per-field "Form Hint" docs keyed by field id; shown only when the host
  // HookForm enables field docs.
  fieldDocs?: Record<string, string>;
  onSchedulerValidityChange?: (isValid: boolean) => void;
}

const TestSuitePipelineFormFields = ({
  form,
  includePeriodOptions,
  testSuiteId,
  tableFqn,
  fieldDocs = {},
  onSchedulerValidityChange,
}: TestSuitePipelineFormFieldsProps) => {
  const { t } = useTranslation();
  const nameDoc = useFieldDoc({
    name: 'name',
    label: t('label.name'),
    doc: fieldDocs.name,
  });
  const cronDoc = useFieldDoc({
    name: 'cron',
    label: t('label.schedule-for-entity', {
      entity: t('label.test-case-plural'),
    }),
    doc: fieldDocs.cron,
  });
  const testCasesDoc = useFieldDoc({
    name: 'testCases',
    label: t('label.test-case'),
    doc: fieldDocs.testCases,
  });

  const fieldsRef = useRef<HTMLDivElement>(null);
  useSeedFirstFieldDoc(fieldsRef);

  const selectAllTestCases = useWatch({
    control: form.control,
    name: 'selectAllTestCases',
  });

  // The picker's `q` is free text: the endpoint parses it as a literal term rather than as a
  // Lucene expression, so the suite scope travels as first-class filter params. A basic suite owns
  // exactly its table's test cases, so scoping by the table's entityLink is equivalent.
  const testCasePickerScope = useMemo<ListTestCaseParamsBySearch>(
    () => ({
      testSuiteId,
      ...(tableFqn && {
        entityLink: `<#E::table::${tableFqn}>`,
        includeAllTests: true,
      }),
    }),
    [testSuiteId, tableFqn]
  );

  const testCaseFormFields: FieldProp[] = [
    {
      name: 'selectAllTestCases',
      label: t('label.select-all-entity', {
        entity: t('label.test-case-plural'),
      }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        'data-testid': 'select-all-test-cases',
        onChange: (value) => {
          if (value === 'true') {
            form.setValue('testCases', undefined);
          }
        },
      },
      id: 'root/selectAllTestCases',
      doc: fieldDocs.selectAllTestCases,
      formItemLayout: FormItemLayout.HORIZONTAL,
    },
  ];

  const debugLogFormField: FieldProp = {
    name: 'enableDebugLog',
    label: t('label.enable-debug-log'),
    type: FieldTypes.SWITCH,
    required: false,
    props: {
      'data-testid': 'enable-debug-log',
    },
    id: 'root/enableDebugLog',
    doc: fieldDocs.enableDebugLog,
    formItemLayout: FormItemLayout.HORIZONTAL,
  };

  const raiseOnErrorFormField: FieldProp = {
    name: 'raiseOnError',
    label: t('label.raise-on-error'),
    type: FieldTypes.SWITCH,
    required: false,
    formItemLayout: FormItemLayout.HORIZONTAL,
    id: 'root/raiseOnError',
    doc: fieldDocs.raiseOnError,
  };

  return (
    <>
      <Grid.Item className="layout-column" span={24}>
        <div ref={fieldsRef} {...nameDoc}>
          <FormField control={form.control} name="name">
            {({ field }) => (
              <Input
                {...field}
                id="root/name"
                inputDataTestId="pipeline-name"
                label={t('label.name')}
                placeholder={t('label.enter-entity', {
                  entity: t('label.name'),
                })}
                value={field.value ?? ''}
              />
            )}
          </FormField>
        </div>
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        {t('label.schedule-for-entity', {
          entity: t('label.test-case-plural'),
        })}
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <div {...cronDoc}>
          <FormField control={form.control} name="cron">
            {({ field }) => (
              <ScheduleInterval
                defaultSchedule={DEFAULT_SCHEDULE_CRON_DAILY}
                entity={t('label.test-case-plural')}
                includePeriodOptions={includePeriodOptions}
                value={field.value}
                onChange={field.onChange}
                onValidityChange={onSchedulerValidityChange}
              />
            )}
          </FormField>
        </div>
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        {getField(debugLogFormField)}
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        {getField(raiseOnErrorFormField)}
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <Card>
          <Card.Content>
            <Grid className="layout-row layout-grid" rowGap="4">
              <Grid.Item className="layout-column" span={24}>
                {testCaseFormFields.map((field) => (
                  <Fragment key={field.name}>{getField(field)}</Fragment>
                ))}
              </Grid.Item>
              {!selectAllTestCases && (
                <Grid.Item className="layout-column" span={24}>
                  <div {...testCasesDoc}>
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
                      {({ field, fieldState }) => (
                        <Box direction="col" gap={2}>
                          <FormItemLabel
                            required
                            label={t('label.test-case')}
                          />
                          <AddTestCaseList
                            columnFilters={
                              tableFqn
                                ? `fullyQualifiedName:"${escapeESReservedCharacters(
                                    tableFqn
                                  )}"`
                                : undefined
                            }
                            hideTableFilter={Boolean(tableFqn)}
                            selectedTest={field.value}
                            showButton={false}
                            testCaseParams={testCasePickerScope}
                            onChange={field.onChange}
                          />
                          {fieldState.error && (
                            <HintText isInvalid>
                              {fieldState.error.message}
                            </HintText>
                          )}
                        </Box>
                      )}
                    </FormField>
                  </div>
                </Grid.Item>
              )}
            </Grid>
          </Card.Content>
        </Card>
      </Grid.Item>
    </>
  );
};

export default TestSuitePipelineFormFields;
