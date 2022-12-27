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

import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Space,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import { trim } from 'lodash';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { addPolicy } from '../../../axiosAPIs/rolesAPIV1';
import RichTextEditor from '../../../components/common/rich-text-editor/RichTextEditor';
import TitleBreadcrumb from '../../../components/common/title-breadcrumb/title-breadcrumb.component';
import { GlobalSettingOptions } from '../../../constants/GlobalSettings.constants';
import {
  CreatePolicy,
  Effect,
  Rule,
} from '../../../generated/api/policies/createPolicy';
import {
  getPath,
  getPolicyWithFqnPath,
  getSettingPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import RuleForm from '../RuleForm/RuleForm';

const policiesPath = getPath(GlobalSettingOptions.POLICIES);

const breadcrumb = [
  {
    name: t('label.settings'),
    url: getSettingPath(),
  },
  {
    name: t('label.policies'),
    url: policiesPath,
  },
  {
    name: t('label.add-new-policy'),
    url: '',
  },
];

const AddPolicyPage = () => {
  const history = useHistory();

  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [ruleData, setRuleData] = useState<Rule>({
    name: '',
    description: '',
    resources: [],
    operations: [],
    condition: '',
    effect: Effect.Allow,
  });

  const handleCancel = () => {
    history.push(policiesPath);
  };

  const handleSumbit = async () => {
    const { condition, ...rest } = { ...ruleData, name: trim(ruleData.name) };
    const data: CreatePolicy = {
      name: trim(name),
      description,
      rules: [condition ? { ...rest, condition } : rest],
    };

    try {
      const dataResponse = await addPolicy(data);
      if (dataResponse) {
        history.push(
          getPolicyWithFqnPath(dataResponse.fullyQualifiedName || '')
        );
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  return (
    <Row
      className="tw-bg-body-main tw-h-auto"
      data-testid="add-policy-container"
      gutter={[16, 16]}>
      <Col offset={4} span={12}>
        <TitleBreadcrumb className="m-y-md" titleLinks={breadcrumb} />
        <Card>
          <Typography.Paragraph
            className="tw-text-base"
            data-testid="form-title">
            {t('label.add-new-policy')}
          </Typography.Paragraph>
          <Form
            data-testid="policy-form"
            id="policy-form"
            initialValues={{
              ruleEffect: ruleData.effect,
            }}
            layout="vertical"
            onFinish={handleSumbit}>
            <Form.Item
              label={`${t('label.name')}:`}
              name="name"
              rules={[
                {
                  required: true,
                  max: 128,
                  min: 1,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.name'),
                  }),
                },
              ]}>
              <Input
                data-testid="policy-name"
                placeholder={t('label.policy-name')}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Form.Item>

            <Form.Item label={`${t('label.description')}:`} name="description">
              <RichTextEditor
                height="200px"
                initialValue={description}
                placeHolder={t('label.write-your-description')}
                style={{ margin: 0 }}
                onTextChange={(value) => setDescription(value)}
              />
            </Form.Item>

            <Divider data-testid="add-rule-divider">
              {t('label.add-rule')}
            </Divider>
            <RuleForm ruleData={ruleData} setRuleData={setRuleData} />

            <Space align="center" className="tw-w-full tw-justify-end">
              <Button
                data-testid="cancel-btn"
                type="link"
                onClick={handleCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                data-testid="submit-btn"
                form="policy-form"
                htmlType="submit"
                type="primary">
                {t('label.submit')}
              </Button>
            </Space>
          </Form>
        </Card>
      </Col>
      <Col className="m-t-xlg" span={4}>
        <Typography.Paragraph className="tw-text-base tw-font-medium">
          {t('label.add-policy')}
        </Typography.Paragraph>
        <Typography.Text>{t('message.add-policy-message')}</Typography.Text>
      </Col>
    </Row>
  );
};

export default AddPolicyPage;
