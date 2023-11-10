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
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import Loader from '../../../components/Loader/Loader';
import {
  PAGE_SIZE_MEDIUM,
  VALIDATION_MESSAGES,
} from '../../../constants/constants';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import { TestSuite } from '../../../generated/tests/testSuite';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { getListTestSuites } from '../../../rest/testAPI';
import { getDataQualityPagePath } from '../../../utils/RouterUtils';
import { AddTestSuiteFormProps } from '../TestSuiteStepper/TestSuiteStepper.interface';

const AddTestSuiteForm: React.FC<AddTestSuiteFormProps> = ({
  onSubmit,
  testSuite,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [testSuites, setTestSuites] = useState<Array<TestSuite>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const history = useHistory();

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

  const handleCancelClick = () => {
    history.push(getDataQualityPagePath(DataQualityPageTabs.TEST_SUITES));
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
      initialValues={testSuite}
      layout="vertical"
      name="selectTestSuite"
      validateMessages={VALIDATION_MESSAGES}
      onFinish={onSubmit}>
      <Form.Item
        label={t('label.name')}
        name="name"
        rules={[
          {
            required: true,
          },
          {
            pattern: ENTITY_NAME_REGEX,
            message: t('message.entity-name-validation'),
          },
          {
            min: 1,
            max: 256,
            message: `${t('message.entity-size-in-between', {
              entity: `${t('label.name')}`,
              max: '256',
              min: '1',
            })}`,
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
      <Form.Item label={t('label.description')} name="description">
        <RichTextEditor
          data-testid="test-suite-description"
          height="200px"
          initialValue={testSuite?.description ?? ''}
          onTextChange={(value) => form.setFieldsValue({ description: value })}
        />
      </Form.Item>

      <Form.Item noStyle>
        <Space className="w-full justify-end" size={16}>
          <Button data-testid="cancel-button" onClick={handleCancelClick}>
            {t('label.cancel')}
          </Button>
          <Button data-testid="submit-button" htmlType="submit" type="primary">
            {t('label.next')}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default AddTestSuiteForm;
