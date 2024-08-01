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
import { Button, Col, Form, FormProps, Row, Space } from 'antd';
import { isString } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { TestCase } from '../../../../generated/tests/testCase';
import { useFqn } from '../../../../hooks/useFqn';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../../interface/FormUtils.interface';
import { generateFormFields } from '../../../../utils/formUtils';
import { AddTestCaseList } from '../../AddTestCaseList/AddTestCaseList.component';
import { AddTestSuitePipelineProps } from '../AddDataQualityTest.interface';
import './add-test-suite-pipeline.style.less';

const AddTestSuitePipeline = ({
  initialData,
  isLoading,
  onSubmit,
  onCancel,
  includePeriodOptions,
  testSuiteFQN,
}: AddTestSuitePipelineProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn } = useFqn();
  const [form] = Form.useForm();
  const selectAllTestCases = Form.useWatch('selectAllTestCases', form);

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
    {
      name: 'enableDebugLog',
      label: t('label.enable-debug-log'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        'data-testid': 'enable-debug-log',
      },
      id: 'root/enableDebugLog',
      formItemLayout: FormItemLayout.HORIZONTAL,
    },
    {
      name: 'repeatFrequency',
      label: t('label.schedule-for-entity', {
        entity: t('label.test-case-plural'),
      }),
      type: FieldTypes.CRON_EDITOR,
      required: false,
      props: {
        'data-testid': 'repeat-frequency',
        includePeriodOptions,
      },
      id: 'root/repeatFrequency',
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
    history.goBack();
  };

  const onFinish: FormProps['onFinish'] = (values) => {
    const { testCases, ...rest } = values;
    onSubmit({
      ...rest,
      testCases: testCases?.map((testCase: TestCase | string) =>
        isString(testCase) ? testCase : testCase.name
      ),
    });
  };

  const onValuesChange: FormProps['onValuesChange'] = (changedValues) => {
    if (changedValues?.selectAllTestCases) {
      form.setFieldsValue({ testCases: undefined });
    }
  };

  return (
    <Form
      form={form}
      initialValues={initialData}
      layout="vertical"
      onFinish={onFinish}
      onValuesChange={onValuesChange}>
      {generateFormFields(formFields)}
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
                filters={`testSuite.fullyQualifiedName:${testSuiteFQN ?? fqn}`}
                showButton={false}
              />
            </Form.Item>
          </Col>
        )}
      </Row>
      <Form.Item>
        <Space className="w-full justify-end m-t-md" size={16}>
          <Button
            data-testid="cancel"
            type="link"
            onClick={onCancel ?? handleCancelBtn}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid="deploy-button"
            htmlType="submit"
            loading={isLoading}
            type="primary">
            {t('label.submit')}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default AddTestSuitePipeline;
