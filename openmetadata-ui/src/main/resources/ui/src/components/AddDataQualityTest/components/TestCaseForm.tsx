/*
 *  Copyright 2022 Collate
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

import { Button, Col, Form, FormProps, Input, Row, Select, Space } from 'antd';
import { AxiosError } from 'axios';
import 'codemirror/addon/fold/foldgutter.css';
import { isEmpty } from 'lodash';
import { EditorContentRef } from 'Models';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import { useParams } from 'react-router-dom';
import {
  getListTestCase,
  getListTestDefinitions,
} from '../../../axiosAPIs/testAPI';
import { API_RES_MAX_SIZE } from '../../../constants/constants';
import { codeMirrorOption } from '../../../constants/profiler.constant';
import { ProfilerDashboardType } from '../../../enums/table.enum';
import { EntityReference } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  TestCase,
  TestCaseParameterValue,
} from '../../../generated/tests/testCase';
import {
  EntityType,
  TestDataType,
  TestDefinition,
} from '../../../generated/tests/testDefinition';
import { getNameFromFQN } from '../../../utils/CommonUtils';
import { generateEntityLink } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import RichTextEditor from '../../common/rich-text-editor/RichTextEditor';
import { TestCaseFormProps } from '../AddDataQualityTest.interface';
import ParameterForm from './ParameterForm';

const TestCaseForm: React.FC<TestCaseFormProps> = ({
  initialValue,
  onSubmit,
  onCancel,
}) => {
  const { entityTypeFQN, dashboardType } = useParams<Record<string, string>>();
  const isColumnFqn = dashboardType === ProfilerDashboardType.COLUMN;
  const [form] = Form.useForm();
  const markdownRef = useRef<EditorContentRef>();
  const [testDefinitions, setTestDefinitions] = useState<TestDefinition[]>([]);
  const [selectedTestType, setSelectedTestType] = useState<string | undefined>(
    initialValue?.testDefinition?.id
  );
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [sqlQuery, setSqlQuery] = useState({
    name: 'sqlExpression',
    value: initialValue?.parameterValues?.[0]?.value || '',
  });

  const fetchAllTestDefinitions = async () => {
    try {
      const { data } = await getListTestDefinitions({
        limit: API_RES_MAX_SIZE,
        entityType: isColumnFqn ? EntityType.Column : EntityType.Table,
      });

      setTestDefinitions(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
  const fetchAllTestCases = async () => {
    try {
      const { data } = await getListTestCase({
        fields: 'testDefinition',
        limit: API_RES_MAX_SIZE,
        entityLink: generateEntityLink(entityTypeFQN, isColumnFqn),
      });

      setTestCases(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const getSelectedTestDefinition = () => {
    const testType = initialValue?.testDefinition?.id ?? selectedTestType;

    return testDefinitions.find((definition) => definition.id === testType);
  };

  const GenerateParamsField = useCallback(() => {
    const selectedDefinition = getSelectedTestDefinition();
    if (selectedDefinition && selectedDefinition.parameterDefinition) {
      const name = selectedDefinition.parameterDefinition[0]?.name;
      if (name === 'sqlExpression') {
        return (
          <Row>
            <Col data-testid="sql-editor-container" span={24}>
              <p className="tw-mb-1.5">Profile Sample Query</p>
              <CodeMirror
                className="profiler-setting-sql-editor"
                data-testid="profiler-setting-sql-editor"
                options={codeMirrorOption}
                value={sqlQuery.value}
                onBeforeChange={(_Editor, _EditorChange, value) => {
                  setSqlQuery((pre) => ({ ...pre, value }));
                }}
                onChange={(_Editor, _EditorChange, value) => {
                  setSqlQuery((pre) => ({ ...pre, value }));
                }}
              />
            </Col>
          </Row>
        );
      }

      return <ParameterForm definition={selectedDefinition} />;
    }

    return;
  }, [selectedTestType, initialValue, testDefinitions, sqlQuery]);

  const createTestCaseObj = (value: {
    testName: string;
    params: Record<string, string | { [key: string]: string }[]>;
    testTypeId: string;
  }) => {
    const selectedDefinition = getSelectedTestDefinition();
    const paramsValue = selectedDefinition?.parameterDefinition?.[0];

    const parameterValues =
      paramsValue?.name === 'sqlExpression'
        ? [sqlQuery]
        : Object.entries(value.params || {}).map(([key, value]) => ({
            name: key,
            value:
              paramsValue?.dataType === TestDataType.Array
                ? // need to send array as string formate
                  JSON.stringify(
                    (value as { value: string }[]).map((data) => data.value)
                  )
                : value,
          }));

    return {
      name: value.testName,
      entityLink: generateEntityLink(entityTypeFQN, isColumnFqn),
      parameterValues: parameterValues as TestCaseParameterValue[],
      testDefinition: {
        id: value.testTypeId,
        type: 'testDefinition',
      },
      description: markdownRef.current?.getEditorContent(),
      testSuite: {} as EntityReference,
    };
  };

  const handleFormSubmit: FormProps['onFinish'] = (value) => {
    onSubmit(createTestCaseObj(value));
  };

  const onBack = () => {
    const data = form.getFieldsValue();
    onCancel(createTestCaseObj(data));
  };

  const getParamsValue = () => {
    return initialValue?.parameterValues?.reduce(
      (acc, curr) => ({
        ...acc,
        [curr.name || '']:
          getSelectedTestDefinition()?.parameterDefinition?.[0].dataType ===
          TestDataType.Array
            ? (JSON.parse(curr?.value || '[]') as string[]).map((val) => ({
                value: val,
              }))
            : curr?.value,
      }),
      {}
    );
  };

  const handleValueChange: FormProps['onValuesChange'] = (value) => {
    if (value.testTypeId) {
      const testType = testDefinitions.find(
        (test) => test.id === value.testTypeId
      );
      setSelectedTestType(value.testTypeId);
      const testCount = testCases.filter((test) =>
        test.name.includes(`${getNameFromFQN(entityTypeFQN)}_${testType?.name}`)
      );
      // generating dynamic unique name based on entity_testCase_number
      form.setFieldsValue({
        testName: `${getNameFromFQN(entityTypeFQN)}_${testType?.name}${
          testCount.length ? `_${testCount.length}` : ''
        }`,
      });
    }
  };

  useEffect(() => {
    if (testDefinitions.length === 0) {
      fetchAllTestDefinitions();
    }
    if (isEmpty(testCases)) {
      fetchAllTestCases();
    }
    form.setFieldsValue({
      testName: initialValue?.name ?? getNameFromFQN(entityTypeFQN),
      testTypeId: initialValue?.testDefinition?.id,
      params: initialValue?.parameterValues?.length
        ? getParamsValue()
        : undefined,
    });
  }, []);

  return (
    <Form
      form={form}
      layout="vertical"
      name="tableTestForm"
      onFinish={handleFormSubmit}
      onValuesChange={handleValueChange}>
      <Form.Item
        label="Name:"
        name="testName"
        rules={[
          {
            required: true,
            message: 'Name is required!',
          },
          {
            validator: (_, value) => {
              if (testCases.some((test) => test.name === value)) {
                return Promise.reject('Name already exist!');
              }

              return Promise.resolve();
            },
          },
        ]}>
        <Input placeholder="Enter test case name" />
      </Form.Item>
      <Form.Item
        label="Test Type:"
        name="testTypeId"
        rules={[{ required: true, message: 'Test type is required' }]}>
        <Select
          options={testDefinitions.map((suite) => ({
            label: suite.name,
            value: suite.id,
          }))}
          placeholder="Select test type"
        />
      </Form.Item>

      {GenerateParamsField()}

      <Form.Item label="Description:" name="description">
        <RichTextEditor
          initialValue={initialValue?.description || ''}
          ref={markdownRef}
          style={{
            margin: 0,
          }}
        />
      </Form.Item>

      <Form.Item noStyle>
        <Space className="tw-w-full tw-justify-end" size={16}>
          <Button onClick={onBack}>Back</Button>
          <Button data-testid="submit-test" htmlType="submit" type="primary">
            Submit
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default TestCaseForm;
