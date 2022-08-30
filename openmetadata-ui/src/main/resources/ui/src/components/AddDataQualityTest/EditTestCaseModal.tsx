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

import { Col, Form, FormProps, Input, Row, Typography } from 'antd';
import Modal from 'antd/lib/modal/Modal';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { EditorContentRef } from 'Models';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import {
  getTestDefinitionById,
  updateTestCaseById,
} from '../../axiosAPIs/testAPI';
import { codeMirrorOption } from '../../constants/profiler.constant';
import { TestCaseParameterValue } from '../../generated/tests/testCase';
import {
  TestDataType,
  TestDefinition,
} from '../../generated/tests/testDefinition';
import jsonData from '../../jsons/en';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import RichTextEditor from '../common/rich-text-editor/RichTextEditor';
import Loader from '../Loader/Loader';
import { EditTestCaseModalProps } from './AddDataQualityTest.interface';
import ParameterForm from './components/ParameterForm';

const EditTestCaseModal: React.FC<EditTestCaseModalProps> = ({
  visible,
  testCase,
  onCancel,
  onUpdate,
}) => {
  const [form] = Form.useForm();
  const [selectedDefinition, setSelectedDefinition] =
    useState<TestDefinition>();
  const [sqlQuery, setSqlQuery] = useState(
    testCase?.parameterValues?.[0] ?? {
      name: 'sqlExpression',
      value: '',
    }
  );
  const [isLoading, setIsLoading] = useState(true);
  const markdownRef = useRef<EditorContentRef>();

  const GenerateParamsField = useCallback(() => {
    if (selectedDefinition && selectedDefinition.parameterDefinition) {
      const name = selectedDefinition.parameterDefinition[0].name;
      if (name === 'sqlExpression') {
        return (
          <Row>
            <Col data-testid="sql-editor-container" span={24}>
              <Typography.Paragraph className="tw-mb-1.5">
                Profile Sample Query
              </Typography.Paragraph>
              <CodeMirror
                data-testid="sql-editor"
                options={codeMirrorOption}
                value={sqlQuery.value || ''}
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
  }, [testCase, selectedDefinition, sqlQuery]);

  const fetchTestDefinitionById = async () => {
    setIsLoading(true);
    try {
      const definition = await getTestDefinitionById(
        testCase.testDefinition.id || ''
      );
      setSelectedDefinition(definition);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const createTestCaseObj = (value: {
    testName: string;
    params: Record<string, string | { [key: string]: string }[]>;
    testTypeId: string;
  }) => {
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
      parameterValues: parameterValues as TestCaseParameterValue[],
      description: markdownRef.current?.getEditorContent(),
    };
  };

  const handleFormSubmit: FormProps['onFinish'] = async (value) => {
    const { parameterValues, description } = createTestCaseObj(value);
    const updatedTestCase = { ...testCase, parameterValues, description };
    const jsonPatch = compare(testCase, updatedTestCase);

    if (jsonPatch.length) {
      try {
        await updateTestCaseById(testCase.id || '', jsonPatch);
        onUpdate && onUpdate();
        showSuccessToast(
          jsonData['api-success-messages']['update-test-case-success']
        );
        onCancel();
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        form.resetFields();
      }
    }
  };

  const getParamsValue = () => {
    return testCase?.parameterValues?.reduce(
      (acc, curr) => ({
        ...acc,
        [curr.name || '']:
          selectedDefinition?.parameterDefinition?.[0].dataType ===
          TestDataType.Array
            ? (JSON.parse(curr.value || '[]') as string[]).map((val) => ({
                value: val,
              }))
            : curr.value,
      }),
      {}
    );
  };

  useEffect(() => {
    if (testCase) {
      fetchTestDefinitionById();
      form.setFieldsValue({
        name: testCase?.name,
        testDefinition: testCase?.testDefinition?.name,
        params: getParamsValue(),
      });
    }
  }, [testCase]);

  return (
    <Modal
      centered
      destroyOnClose
      afterClose={() => {
        form.resetFields();
        onCancel();
      }}
      title={`Edit ${testCase?.name}`}
      visible={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}>
      {isLoading ? (
        <Loader />
      ) : (
        <Form
          form={form}
          layout="vertical"
          name="tableTestForm"
          onFinish={handleFormSubmit}>
          <Form.Item required label="Name:" name="name">
            <Input disabled placeholder="Enter test case name" />
          </Form.Item>
          <Form.Item required label="Test Type:" name="testDefinition">
            <Input disabled placeholder="Enter test case name" />
          </Form.Item>

          {GenerateParamsField()}

          <Form.Item label="Description:" name="description">
            <RichTextEditor
              height="200px"
              initialValue={testCase?.description || ''}
              ref={markdownRef}
              style={{
                margin: 0,
              }}
            />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};

export default EditTestCaseModal;
