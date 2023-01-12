/*
 *  Copyright 2022 Collate.
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

import { Button, Form, Input, Space } from 'antd';
import RichTextEditor from 'components/common/rich-text-editor/RichTextEditor';
import Loader from 'components/Loader/Loader';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { getListTestSuites } from 'rest/testAPI';
import { PAGE_SIZE_MEDIUM, ROUTES } from '../../constants/constants';
import { TestSuite } from '../../generated/tests/testSuite';
import jsonData from '../../jsons/en';
import { AddTestSuiteFormProps } from './testSuite.interface';

const AddTestSuiteForm: React.FC<AddTestSuiteFormProps> = ({ onSubmit }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [testSuites, setTestSuites] = useState<Array<TestSuite>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const history = useHistory();

  const validateMessages = {
    required: t('message.field-text-is-required', {
      fieldText: '${label}',
    }),
  };

  const fetchTestSuites = async () => {
    try {
      setIsLoading(true);
      const response = await getListTestSuites({
        fields: 'owner,tests',
        limit: PAGE_SIZE_MEDIUM,
      });
      setTestSuites(response.data);
    } catch (err) {
      setTestSuites([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTestSuites();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Form
      data-testid="test-suite-form"
      form={form}
      layout="vertical"
      name="selectTestSuite"
      validateMessages={validateMessages}
      onFinish={(data) => onSubmit(data)}>
      <Form.Item
        label={t('label.name')}
        name="name"
        rules={[
          {
            required: true,
          },
          {
            pattern: /^[A-Za-z0-9_]*$/g,
            message: jsonData.label['special-character-error'],
          },
          {
            validator: (_, value) => {
              if (testSuites.some((suite) => suite.name === value)) {
                return Promise.reject(
                  `${t('message.entity-already-exists', {
                    entity: t('label.name'),
                  })}!`
                );
              }

              return Promise.resolve();
            },
          },
        ]}>
        <Input
          data-testid="test-suite-name"
          placeholder={t('label.enter-entity', {
            entity: `${t('label.test-suite')} ${t('label.name')}`,
          })}
        />
      </Form.Item>
      <Form.Item
        label={t('label.description')}
        name="description"
        rules={[
          {
            required: true,
          },
        ]}>
        <RichTextEditor
          data-testid="test-suite-description"
          initialValue=""
          onTextChange={(value) => form.setFieldsValue({ description: value })}
        />
      </Form.Item>

      <Form.Item noStyle>
        <Space className="w-full justify-end" size={16}>
          <Button
            data-testid="cancel-button"
            onClick={() => history.push(ROUTES.TEST_SUITES)}>
            {t('label.cancel')}
          </Button>
          <Button data-testid="submit-button" htmlType="submit" type="primary">
            {t('label.submit')}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default AddTestSuiteForm;
