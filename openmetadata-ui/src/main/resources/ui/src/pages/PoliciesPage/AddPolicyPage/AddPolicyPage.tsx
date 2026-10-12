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
  Box,
  Divider,
  FormField,
  FormItemLabel,
  HintText,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { Button, Input } from 'antd';
import { AxiosError } from 'axios';
import { trim } from 'lodash';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ADD_POLICY_PAGE_BREADCRUMB } from '../../../constants/Breadcrumb.constants';
import { ERROR_MESSAGE } from '../../../constants/constants';
import { NAME_FIELD_VALIDATION } from '../../../constants/Form.constants';
import { GlobalSettingOptions } from '../../../constants/GlobalSettings.constants';
import {
  CreatePolicy,
  Effect,
  Rule,
} from '../../../generated/api/policies/createPolicy';
import { withPageLayout } from '../../../hoc/withPageLayout';
import { addPolicy } from '../../../rest/rolesAPIV1';
import { getIsErrorMatch } from '../../../utils/APIUtils';
import { translateWithNestedKeys } from '../../../utils/i18next/LocalUtil';
import { getPath, getPolicyWithFqnPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import RuleForm, { PolicyRuleFormValues } from '../RuleForm/RuleForm';

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

  const form = useForm<PolicyRuleFormValues>({
    mode: 'onChange',
    defaultValues: {
      ruleName: '',
      resources: [],
      operations: [],
      ruleEffect: Effect.Allow,
      condition: '',
    },
  });

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

  const translatedAddPolicyBreadcrumb = useMemo(
    () =>
      ADD_POLICY_PAGE_BREADCRUMB.map((option) => ({
        ...option,
        name: translateWithNestedKeys(option.name, option.nameData),
      })),
    [t]
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
            <TitleBreadcrumb titleLinks={translatedAddPolicyBreadcrumb} />
            <div className="m-t-md">
              <Typography
                as="p"
                className="text-base tw:mb-4!"
                data-testid="form-title">
                {t('label.add-new-entity', {
                  entity: t('label.policy'),
                })}
              </Typography>
              <HookForm
                data-testid="policy-form"
                form={form}
                id="policy-form"
                onSubmit={form.handleSubmit(handleSubmit)}>
                <FormField
                  control={form.control}
                  name="name"
                  rules={NAME_FIELD_VALIDATION}>
                  {({ field, fieldState }) => (
                    <Box direction="col" gap={2}>
                      <FormItemLabel required label={t('label.name')} />
                      <Input
                        data-testid="policy-name"
                        placeholder={t('label.policy-name')}
                        type="text"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          field.onChange(e);
                          setName(e.target.value);
                        }}
                      />
                      {fieldState.error && (
                        <HintText isInvalid>
                          {fieldState.error.message}
                        </HintText>
                      )}
                    </Box>
                  )}
                </FormField>
                <Box direction="col" gap={2}>
                  <FormItemLabel label={t('label.description')} />
                  <RichTextEditor
                    data-testid="description"
                    initialValue=""
                    placeHolder={t('message.write-your-description')}
                    onTextChange={setDescription}
                  />
                </Box>
                <Divider
                  className="tw:my-4"
                  data-testid="add-rule-divider"
                  label={
                    <span className="tw:text-md tw:font-medium tw:text-primary">
                      {t('label.add-entity', { entity: t('label.rule') })}
                    </span>
                  }
                />
                <RuleForm
                  form={form}
                  ruleData={ruleData}
                  setRuleData={setRuleData}
                />
                <Box
                  inline
                  align="center"
                  className="layout-space layout-space-horizontal w-full justify-end"
                  gap={2}
                  itemClassName="layout-space-item">
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
                </Box>
              </HookForm>
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
            <Typography as="p" className="text-base font-medium tw:mb-4!">
              {t('label.add-entity', {
                entity: t('label.policy'),
              })}
            </Typography>
            <Typography>{t('message.add-policy-message')}</Typography>
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
