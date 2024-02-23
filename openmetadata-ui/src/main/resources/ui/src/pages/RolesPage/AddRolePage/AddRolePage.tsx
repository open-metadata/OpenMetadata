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

import { Button, Form, Input, Select, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import { trim } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ERROR_MESSAGE } from '../../../constants/constants';
import { GlobalSettingOptions } from '../../../constants/GlobalSettings.constants';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import { Policy } from '../../../generated/entity/policies/policy';
import { addRole, getPolicies } from '../../../rest/rolesAPIV1';
import { getIsErrorMatch } from '../../../utils/CommonUtils';
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
    name: t('label.setting-plural'),
    url: getSettingPath(),
  },
  {
    name: t('label.role-plural'),
    url: rolesPath,
  },
  {
    name: t('label.add-new-entity', { entity: t('label.role') }),
    url: '',
  },
];

const AddRolePage = () => {
  const history = useHistory();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);
  const [isSaveLoading, setIsSaveLoading] = useState<boolean>(false);

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

  const handleSubmit = async () => {
    setIsSaveLoading(true);
    const data = {
      name: trim(name),
      description,
      // TODO the policies should be names instead of ID
      policies: selectedPolicies.map((policy) => policy),
    };

    try {
      const dataResponse = await addRole(data);
      if (dataResponse) {
        history.push(getRoleWithFqnPath(dataResponse.fullyQualifiedName || ''));
      }
    } catch (error) {
      showErrorToast(
        getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
          ? t('server.entity-already-exist', {
              entity: t('label.role'),
              entityPlural: t('label.role-lowercase-plural'),
              name: data.name,
            })
          : (error as AxiosError)
      );
    } finally {
      setIsSaveLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  return (
    <ResizablePanels
      firstPanel={{
        children: (
          <div
            className="max-width-md w-9/10 service-form-container"
            data-testid="add-role-container">
            <TitleBreadcrumb titleLinks={breadcrumb} />
            <div className="m-t-md">
              <Typography.Paragraph
                className="text-base"
                data-testid="form-title">
                {t('label.add-new-entity', { entity: t('label.role') })}
              </Typography.Paragraph>
              <Form
                data-testid="role-form"
                id="role-form"
                layout="vertical"
                onFinish={handleSubmit}>
                <Form.Item
                  label={`${t('label.name')}:`}
                  name="name"
                  rules={[
                    {
                      required: true,
                      max: 128,
                      min: 1,
                      message: `${t('message.entity-size-in-between', {
                        entity: `${t('label.name')}`,
                        max: '128',
                        min: '1',
                      })}`,
                    },
                    {
                      pattern: ENTITY_NAME_REGEX,
                      message: t('message.entity-name-validation'),
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
                <Form.Item
                  label={`${t('label.description')}:`}
                  name="description">
                  <RichTextEditor
                    height="200px"
                    initialValue={description}
                    placeHolder={t('message.write-your-description')}
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
                      message: t('message.at-least-one-policy'),
                    },
                  ]}>
                  <Select
                    data-testid="policies"
                    mode="multiple"
                    placeholder={t('label.select-a-policy')}
                    value={selectedPolicies}
                    onChange={(values) => setSelectedPolicies(values)}>
                    {policies.map((policy) => (
                      <Option key={policy.fullyQualifiedName}>
                        {policy.displayName || policy.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Space align="center" className="w-full justify-end">
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
                    loading={isSaveLoading}
                    type="primary">
                    {t('label.submit')}
                  </Button>
                </Space>
              </Form>
            </div>
          </div>
        ),
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.add-new-entity', {
        entity: t('label.role'),
      })}
      secondPanel={{
        children: (
          <>
            <Typography.Paragraph className="text-base font-medium">
              {t('label.add-entity', {
                entity: t('label.role'),
              })}
            </Typography.Paragraph>
            <Typography.Text>{t('message.add-role-message')}</Typography.Text>
          </>
        ),
        className: 'p-md service-doc-panel',
        minWidth: 60,
        overlay: {
          displayThreshold: 200,
          header: t('label.setup-guide'),
          rotation: 'counter-clockwise',
        },
      }}
    />
  );
};

export default AddRolePage;
