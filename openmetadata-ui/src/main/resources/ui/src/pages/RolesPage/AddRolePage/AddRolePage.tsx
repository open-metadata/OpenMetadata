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

import { Button, Form, Input, Space, Typography } from 'antd';
import { Select } from '../../../components/common/AntdCompat';;
import { AxiosError } from 'axios';
import { trim } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ADD_ROLE_PAGE_BREADCRUMB } from '../../../constants/Breadcrumb.constants';
import { ERROR_MESSAGE } from '../../../constants/constants';
import { NAME_FIELD_RULES } from '../../../constants/Form.constants';
import { GlobalSettingOptions } from '../../../constants/GlobalSettings.constants';
import { TabSpecificField } from '../../../enums/entity.enum';
import { Policy } from '../../../generated/entity/policies/policy';
import { withPageLayout } from '../../../hoc/withPageLayout';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { addRole, getPolicies } from '../../../rest/rolesAPIV1';
import { getIsErrorMatch } from '../../../utils/CommonUtils';
import { getField } from '../../../utils/formUtils';
import { getPath, getRoleWithFqnPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
const { Option } = Select;
const rolesPath = getPath(GlobalSettingOptions.ROLES);

const AddRolePage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);
  const [isSaveLoading, setIsSaveLoading] = useState<boolean>(false);

  const fetchPolicies = async () => {
    try {
      const data = await getPolicies(
        `${TabSpecificField.OWNERS},${TabSpecificField.LOCATION},${TabSpecificField.TEAMS},${TabSpecificField.ROLES}`,
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
    navigate(rolesPath);
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
        navigate(getRoleWithFqnPath(dataResponse.fullyQualifiedName || ''));
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

  const descriptionField: FieldProp = useMemo(
    () => ({
      name: 'description',
      required: false,
      label: `${t('label.description')}:`,
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      props: {
        'data-testid': 'description',
        initialValue: '',
        style: {
          margin: 0,
        },
        placeHolder: t('message.write-your-description'),
        onTextChange: (value: string) => setDescription(value),
      },
    }),
    []
  );

  useEffect(() => {
    fetchPolicies();
  }, []);

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
        children: (
          <div data-testid="add-role-container">
            <TitleBreadcrumb titleLinks={ADD_ROLE_PAGE_BREADCRUMB} />
            <div className="m-t-md">
              <Typography.Paragraph
                className="text-base"
                data-testid="form-title">
                {t('label.add-new-entity', {
                  entity: t('label.role'),
                })}
              </Typography.Paragraph>
              <Form
                data-testid="role-form"
                id="role-form"
                layout="vertical"
                onFinish={handleSubmit}>
                <Form.Item
                  label={`${t('label.name')}:`}
                  name="name"
                  rules={NAME_FIELD_RULES}>
                  <Input
                    data-testid="name"
                    placeholder={t('label.role-name')}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Form.Item>
                {getField(descriptionField)}

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
                    {t('label.create')}
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
        className: 'content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default withPageLayout(AddRolePage);
