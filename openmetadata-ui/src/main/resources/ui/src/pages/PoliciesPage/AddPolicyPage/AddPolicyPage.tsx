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

import { Button, Divider, Form, Input, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { trim } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ADD_POLICY_PAGE_BREADCRUMB } from '../../../constants/Breadcrumb.constants';
import { ERROR_MESSAGE } from '../../../constants/constants';
import { NAME_FIELD_RULES } from '../../../constants/Form.constants';
import { GlobalSettingOptions } from '../../../constants/GlobalSettings.constants';
import {
  CreatePolicy,
  Effect,
  Rule,
} from '../../../generated/api/policies/createPolicy';
import { withPageLayout } from '../../../hoc/withPageLayout';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { addPolicy } from '../../../rest/rolesAPIV1';
import { getIsErrorMatch } from '../../../utils/CommonUtils';
import { getField } from '../../../utils/formUtils';
import { getPath, getPolicyWithFqnPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import RuleForm from '../RuleForm/RuleForm';

const policiesPath = getPath(GlobalSettingOptions.POLICIES);

const AddPolicyPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

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
  const [isSaveLoading, setIsSaveLoading] = useState<boolean>(false);

  const handleCancel = () => {
    navigate(policiesPath);
  };

  const handleSubmit = async () => {
    const { condition, ...rest } = { ...ruleData, name: trim(ruleData.name) };
    const data: CreatePolicy = {
      name: trim(name),
      description,
      rules: [condition ? { ...rest, condition } : rest],
    };

    setIsSaveLoading(true);

    try {
      const dataResponse = await addPolicy(data);
      if (dataResponse) {
        navigate(getPolicyWithFqnPath(dataResponse.fullyQualifiedName || ''));
      }
    } catch (error) {
      showErrorToast(
        getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
          ? t('server.entity-already-exist', {
              entity: t('label.policy'),
              entityPlural: t('label.policy-lowercase-plural'),
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

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
        children: (
          <div data-testid="add-policy-container">
            <TitleBreadcrumb titleLinks={ADD_POLICY_PAGE_BREADCRUMB} />
            <div className="m-t-md">
              <Typography.Paragraph
                className="text-base"
                data-testid="form-title">
                {t('label.add-new-entity', {
                  entity: t('label.policy'),
                })}
              </Typography.Paragraph>
              <Form
                data-testid="policy-form"
                id="policy-form"
                initialValues={{
                  ruleEffect: ruleData.effect,
                }}
                layout="vertical"
                onFinish={handleSubmit}>
                <Form.Item
                  label={`${t('label.name')}:`}
                  name="name"
                  rules={NAME_FIELD_RULES}>
                  <Input
                    data-testid="policy-name"
                    placeholder={t('label.policy-name')}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Form.Item>

                {getField(descriptionField)}

                <Divider data-testid="add-rule-divider">
                  {t('label.add-entity', {
                    entity: t('label.rule'),
                  })}
                </Divider>
                <RuleForm ruleData={ruleData} setRuleData={setRuleData} />

                <Space align="center" className="w-full justify-end">
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
      pageTitle={t('label.add-entity', { entity: t('label.policy') })}
      secondPanel={{
        children: (
          <>
            <Typography.Paragraph className="text-base font-medium">
              {t('label.add-entity', {
                entity: t('label.policy'),
              })}
            </Typography.Paragraph>
            <Typography.Text>{t('message.add-policy-message')}</Typography.Text>
          </>
        ),
        className: 'content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default withPageLayout(AddPolicyPage);
