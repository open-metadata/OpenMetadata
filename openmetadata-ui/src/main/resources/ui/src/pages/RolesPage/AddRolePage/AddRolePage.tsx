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
  Form,
  Input,
  Row,
  Select,
  Space,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import { trim } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { addRole, getPolicies } from '../../../axiosAPIs/rolesAPIV1';
import RichTextEditor from '../../../components/common/rich-text-editor/RichTextEditor';
import TitleBreadcrumb from '../../../components/common/title-breadcrumb/title-breadcrumb.component';
import { GlobalSettingOptions } from '../../../constants/GlobalSettings.constants';
import { Policy } from '../../../generated/entity/policies/policy';
import {
  getPath,
  getRoleWithFqnPath,
  getSettingPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
const { Option } = Select;
const rolesPath = getPath(GlobalSettingOptions.ROLES);

const breadcrumb = [
  {
    name: t('label.settings'),
    url: getSettingPath(),
  },
  {
    name: t('label.roles'),
    url: rolesPath,
  },
  {
    name: t('label.add-new-role'),
    url: '',
  },
];

const AddRolePage = () => {
  const history = useHistory();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);

  const fetchPolicies = async () => {
    try {
      const data = await getPolicies(
        'owner,location,roles,teams',
        undefined,
        undefined,
        100
      );

      setPolicies(data.data || []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleCancel = () => {
    history.push(rolesPath);
  };

  const handleSumbit = async () => {
    const data = {
      name: trim(name),
      description,
      policies: selectedPolicies.map((policy) => ({
        id: policy,
        type: 'policy',
      })),
    };

    try {
      const dataResponse = await addRole(data);
      if (dataResponse) {
        history.push(getRoleWithFqnPath(dataResponse.fullyQualifiedName || ''));
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  return (
    <Row
      className="tw-bg-body-main tw-h-full"
      data-testid="add-role-container"
      gutter={[16, 16]}>
      <Col offset={4} span={12}>
        <TitleBreadcrumb className="m-y-md" titleLinks={breadcrumb} />
        <Card>
          <Typography.Paragraph
            className="tw-text-base"
            data-testid="form-title">
            {t('label.add-new-role')}
          </Typography.Paragraph>
          <Form
            data-testid="role-form"
            id="role-form"
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
                  message: t('label.invalid-name'),
                },
              ]}>
              <Input
                data-testid="name"
                placeholder={t('label.role-name')}
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
            <Form.Item
              label={`${t('label.select-a-policy')}:`}
              name="policies"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.at-least-one-policy'),
                  }),
                },
              ]}>
              <Select
                data-testid="policies"
                mode="multiple"
                placeholder={t('label.select-a-policy')}
                value={selectedPolicies}
                onChange={(values) => setSelectedPolicies(values)}>
                {policies.map((policy) => (
                  <Option key={policy.id}>
                    {policy.displayName || policy.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Space align="center" className="tw-w-full tw-justify-end">
              <Button
                data-testid="cancel-btn"
                type="link"
                onClick={handleCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                data-testid="submit-btn"
                form="role-form"
                htmlType="submit"
                type="primary">
                {t('label.submit')}
              </Button>
            </Space>
          </Form>
        </Card>
      </Col>
      <Col className="tw-mt-4" span={4}>
        <Typography.Paragraph className="tw-text-base tw-font-medium">
          {t('label.add-role')}
        </Typography.Paragraph>
        <Typography.Text>{t('message.add-role-message')}</Typography.Text>
      </Col>
    </Row>
  );
};

export default AddRolePage;
