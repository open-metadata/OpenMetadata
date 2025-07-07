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
import { Col, Form, Row } from 'antd';
import { FormProviderProps } from 'antd/lib/form/context';
import { isEmpty, isString } from 'lodash';
import QueryString from 'qs';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../../constants/Schedular.constants';
import { TestCase } from '../../../../generated/tests/testCase';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../../hooks/useFqn';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../../interface/FormUtils.interface';
import { generateFormFields } from '../../../../utils/formUtils';
import { getRaiseOnErrorFormField } from '../../../../utils/SchedularUtils';
import { escapeESReservedCharacters } from '../../../../utils/StringsUtils';
import ScheduleInterval from '../../../Settings/Services/AddIngestion/Steps/ScheduleInterval';
import { WorkflowExtraConfig } from '../../../Settings/Services/AddIngestion/Steps/ScheduleInterval.interface';
import { AddTestCaseList } from '../../AddTestCaseList/AddTestCaseList.component';
import {
  AddTestSuitePipelineProps,
  TestSuiteIngestionDataType,
} from '../AddDataQualityTest.interface';
import './add-test-suite-pipeline.style.less';

const AddTestSuitePipeline = ({
  initialData,
  isLoading,
  onSubmit,
  onCancel,
  includePeriodOptions,
  testSuite,
}: AddTestSuitePipelineProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn, ingestionFQN } = useFqn();
  const location = useCustomLocation();

  const testSuiteId = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );
    const testSuiteIdData =
      testSuite?.id ?? (searchData as { testSuiteId: string }).testSuiteId;

    return testSuite?.basic ? undefined : testSuiteIdData;
  }, [location.search]);

  const [selectAllTestCases, setSelectAllTestCases] = useState(
    initialData?.selectAllTestCases
  );
  const isEditMode = !isEmpty(ingestionFQN);

  const formFields: FieldProp[] = [
    {
      name: 'name',
      label: t('label.name'),
      type: FieldTypes.TEXT,
      required: false,
      placeholder: t('label.enter-entity', {
        entity: t('label.name'),
      }),
      props: {
        'data-testid': 'pipeline-name',
      },
      id: 'root/name',
    },
  ];

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
      },
      id: 'root/selectAllTestCases',
      formItemLayout: FormItemLayout.HORIZONTAL,
    },
  ];

  const handleCancelBtn = () => {
    navigate(-1);
  };

  const onFinish = (
    values: WorkflowExtraConfig & TestSuiteIngestionDataType
  ) => {
    const {
      cron,
      enableDebugLog,
      testCases,
      name,
      selectAllTestCases,
      raiseOnError,
    } = values;
    onSubmit({
      cron,
      enableDebugLog,
      name,
      selectAllTestCases,
      testCases: testCases?.map((testCase: TestCase | string) =>
        isString(testCase) ? testCase : testCase.name
      ),
      raiseOnError,
    });
  };

  const handleFromChange: FormProviderProps['onFormChange'] = (
    _,
    { forms }
  ) => {
    const form = forms['schedular-form'];
    const value = form.getFieldValue('selectAllTestCases');
    setSelectAllTestCases(value);
    if (value) {
      form.setFieldsValue({ testCases: undefined });
    }
  };

  const raiseOnErrorFormField = useMemo(() => getRaiseOnErrorFormField(), []);

  return (
    <Form.Provider onFormChange={handleFromChange}>
      <ScheduleInterval
        debugLog={{ allow: true }}
        defaultSchedule={DEFAULT_SCHEDULE_CRON_DAILY}
        includePeriodOptions={includePeriodOptions}
        initialData={initialData}
        isEditMode={isEditMode}
        status={isLoading ? 'waiting' : 'initial'}
        topChildren={
          <>
            <Col span={24}>{generateFormFields(formFields)}</Col>
            <Col span={24}>
              {t('label.schedule-for-entity', {
                entity: t('label.test-case-plural'),
              })}
            </Col>
          </>
        }
        onBack={onCancel ?? handleCancelBtn}
        onDeploy={onFinish}>
        <Col span={24}>{generateFormFields([raiseOnErrorFormField])}</Col>
        <Col span={24}>
          <Row className="add-test-case-container" gutter={[0, 16]}>
            <Col span={24}>{generateFormFields(testCaseFormFields)}</Col>
            {!selectAllTestCases && (
              <Col span={24}>
                <Form.Item
                  label={t('label.test-case')}
                  name="testCases"
                  rules={[
                    {
                      required: true,
                      message: t('label.field-required', {
                        field: t('label.test-case'),
                      }),
                    },
                  ]}
                  valuePropName="selectedTest">
                  <AddTestCaseList
                    filters={
                      !testSuiteId
                        ? `testSuite.fullyQualifiedName:"${escapeESReservedCharacters(
                            testSuite?.fullyQualifiedName ?? fqn
                          )}"`
                        : undefined
                    }
                    showButton={false}
                    testCaseParams={{ testSuiteId }}
                  />
                </Form.Item>
              </Col>
            )}
          </Row>
        </Col>
      </ScheduleInterval>
    </Form.Provider>
  );
};

export default AddTestSuitePipeline;
