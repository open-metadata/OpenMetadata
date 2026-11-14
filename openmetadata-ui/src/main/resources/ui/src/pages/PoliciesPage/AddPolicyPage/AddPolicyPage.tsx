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
  Button,
  Divider,
  FormField,
  FormItemLabel,
  HookForm,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { trim } from 'lodash';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { INITIAL_RULE } from '../../../components/discovery/personal-space/Profile/tabs/access-control/AccessControl.constants';
import AccessControlRuleForm from '../../../components/discovery/personal-space/Profile/tabs/access-control/AccessControlRuleForm';
import { ADD_POLICY_PAGE_BREADCRUMB } from '../../../constants/Breadcrumb.constants';
import { ERROR_MESSAGE } from '../../../constants/constants';
import { NAME_FIELD_REGISTER_RULES } from '../../../constants/Form.constants';
import { GlobalSettingOptions } from '../../../constants/GlobalSettings.constants';
import {
  CreatePolicy,
  Rule,
} from '../../../generated/api/policies/createPolicy';
import { withPageLayout } from '../../../hoc/withPageLayout';
import { addPolicy } from '../../../rest/rolesAPIV1';
import { getIsErrorMatch } from '../../../utils/APIUtils';
import { translateWithNestedKeys } from '../../../utils/i18next/LocalUtil';
import { getPath, getPolicyWithFqnPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const policiesPath = getPath(GlobalSettingOptions.POLICIES);

const AddPolicyPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Validate while typing, as the antd form did.
  const form = useForm<{ name: string }>({
    mode: 'onChange',
    defaultValues: { name: '' },
  });
  const ruleForm = useForm<Rule>({ defaultValues: INITIAL_RULE });
  const [description, setDescription] = useState<string>('');
  const [isSaveLoading, setIsSaveLoading] = useState<boolean>(false);

  const handleCancel = () => {
    navigate(policiesPath);
  };

  const handleSubmit = async () => {
    let ruleData: Rule | undefined;
    let name: string | undefined;
    // Validate both forms so every invalid field shows its error at once.
    await ruleForm.handleSubmit((data) => {
      ruleData = data;
    })();
    await form.handleSubmit((data) => {
      name = data.name;
    })();
    if (!ruleData || name === undefined) {
      return;
    }

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
              <Box data-testid="policy-form" direction="col" gap={4}>
                <HookForm form={form}>
                  <FormField
                    control={form.control}
                    name="name"
                    rules={NAME_FIELD_REGISTER_RULES}>
                    {({ field, fieldState }) => (
                      <Input
                        isRequired
                        hint={fieldState.error?.message}
                        inputDataTestId="policy-name"
                        isInvalid={fieldState.invalid}
                        label={t('label.name')}
                        placeholder={t('label.policy-name')}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                      />
                    )}
                  </FormField>
                </HookForm>

                <Box direction="col" gap={1}>
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
                    <Typography
                      className="tw:text-primary"
                      size="text-md"
                      weight="medium">
                      {t('label.add-entity', { entity: t('label.rule') })}
                    </Typography>
                  }
                />
                <AccessControlRuleForm form={ruleForm} />

                <Box
                  inline
                  align="center"
                  className="layout-space layout-space-horizontal w-full justify-end"
                  gap={2}
                  itemClassName="layout-space-item">
                  <Button
                    color="secondary"
                    data-testid="cancel-btn"
                    onClick={handleCancel}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    color="primary"
                    data-testid="submit-btn"
                    isLoading={isSaveLoading}
                    onClick={handleSubmit}>
                    {t('label.create')}
                  </Button>
                </Box>
              </Box>
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
