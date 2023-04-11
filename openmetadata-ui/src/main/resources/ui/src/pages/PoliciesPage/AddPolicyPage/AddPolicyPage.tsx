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
import RichTextEditor from 'components/common/rich-text-editor/RichTextEditor';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { ERROR_MESSAGE } from 'constants/constants';
import { t } from 'i18next';
import { trim } from 'lodash';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { addPolicy } from 'rest/rolesAPIV1';
import { getIsErrorMatch } from 'utils/CommonUtils';
import { GlobalSettingOptions } from '../../../constants/GlobalSettings.constants';
import { allowedNameRegEx } from '../../../constants/regex.constants';
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
              name: data.name,
            })
          : (error as AxiosError)
      );
    }
  };

  return (
    <div data-testid="add-policy-container">
      <PageLayoutV1
        center
        pageTitle={t('label.add-entity', { entity: t('label.policy') })}>
        <Row>
          <Col span={16}>
            <Space className="w-full" direction="vertical" size="middle">
              <TitleBreadcrumb titleLinks={breadcrumb} />
              <Card>
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
                        message: t('message.field-text-is-required', {
                          fieldText: t('label.name'),
                        }),
                      },
                      {
                        validator: (_, value) => {
                          if (allowedNameRegEx.test(value)) {
                            return Promise.reject(
                              t('message.field-text-is-invalid', {
                                fieldText: t('label.name'),
                              })
                            );
                          }

                          return Promise.resolve();
                        },
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
                      type="primary">
                      {t('label.submit')}
                    </Button>
                  </Space>
                </Form>
              </Card>
            </Space>
          </Col>
          <Col className="p-l-lg m-t-xlg" span={8}>
            <Typography.Paragraph className="text-base font-medium">
              {t('label.add-entity', {
                entity: t('label.policy'),
              })}
            </Typography.Paragraph>
            <Typography.Text>{t('message.add-policy-message')}</Typography.Text>
          </Col>
        </Row>
      </PageLayoutV1>
    </div>
  );
};

export default AddPolicyPage;
