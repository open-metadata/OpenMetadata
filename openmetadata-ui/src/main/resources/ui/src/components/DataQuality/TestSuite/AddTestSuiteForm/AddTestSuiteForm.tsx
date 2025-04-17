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
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  PAGE_SIZE_MEDIUM,
  VALIDATION_MESSAGES,
} from '../../../../constants/constants';
import { NAME_FIELD_RULES } from '../../../../constants/Form.constants';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { TestSuite } from '../../../../generated/tests/testSuite';
import {
  FieldProp,
  FieldTypes,
} from '../../../../interface/FormUtils.interface';
import { DataQualityPageTabs } from '../../../../pages/DataQuality/DataQualityPage.interface';
import { getListTestSuites } from '../../../../rest/testAPI';
import { getField } from '../../../../utils/formUtils';
import { getDataQualityPagePath } from '../../../../utils/RouterUtils';
import Loader from '../../../common/Loader/Loader';
import { AddTestSuiteFormProps } from '../TestSuiteStepper/TestSuiteStepper.interface';

const AddTestSuiteForm: React.FC<AddTestSuiteFormProps> = ({
  onSubmit,
  testSuite,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [testSuites, setTestSuites] = useState<Array<TestSuite>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const fetchTestSuites = async () => {
    try {
      setIsLoading(true);
      const response = await getListTestSuites({
        fields: [TabSpecificField.OWNERS, TabSpecificField.TESTS],
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
    navigate(getDataQualityPagePath(DataQualityPageTabs.TEST_SUITES));
  };

  const descriptionField: FieldProp = useMemo(
    () => ({
      name: 'description',
      required: false,
      label: `${t('label.description')}:`,
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      props: {
        'data-testid': 'test-suite-description',
        initialValue: testSuite?.description ?? '',
      },
    }),
    [testSuite?.description]
  );

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
          ...NAME_FIELD_RULES,
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
      {getField(descriptionField)}
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
