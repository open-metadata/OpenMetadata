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
import { t } from 'i18next';
import { trim } from 'lodash';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ERROR_MESSAGE } from '../../../constants/constants';
import { GlobalSettingOptions } from '../../../constants/GlobalSettings.constants';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import {
  CreatePolicy,
  Effect,
  Rule,
} from '../../../generated/api/policies/createPolicy';
import { addPolicy } from '../../../rest/rolesAPIV1';
import { getIsErrorMatch } from '../../../utils/CommonUtils';
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
    name: t('label.setting-plural'),
    url: getSettingPath(),
  },
  {
    name: t('label.policy-plural'),
    url: policiesPath,
  },
  {
    name: t('label.add-new-entity', { entity: t('label.policy') }),
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
  const [isSaveLoading, setIsSaveLoading] = useState<boolean>(false);

  const handleCancel = () => {
    history.push(policiesPath);
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
        history.push(
          getPolicyWithFqnPath(dataResponse.fullyQualifiedName || '')
        );
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

  return (
    <ResizablePanels
      firstPanel={{
        children: (
          <div
            className="max-width-md w-9/10 service-form-container"
            data-testid="add-policy-container">
            <TitleBreadcrumb titleLinks={breadcrumb} />
            <div className="m-t-md">
              <Typography.Paragraph
                className="text-base"
                data-testid="form-title">
                {t('label.add-new-entity', { entity: t('label.policy') })}
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
                    data-testid="policy-name"
                    placeholder={t('label.policy-name')}
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

export default AddPolicyPage;
