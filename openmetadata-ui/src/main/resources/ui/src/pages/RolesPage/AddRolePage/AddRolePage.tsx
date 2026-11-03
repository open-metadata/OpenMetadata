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
  Autocomplete,
  Box,
  Button,
  FormField,
  FormItemLabel,
  HintText,
  HookForm,
  Input,
  SelectItemType,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { trim } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ADD_ROLE_PAGE_BREADCRUMB } from '../../../constants/Breadcrumb.constants';
import { ERROR_MESSAGE } from '../../../constants/constants';
import { NAME_FIELD_REGISTER_RULES } from '../../../constants/Form.constants';
import { GlobalSettingOptions } from '../../../constants/GlobalSettings.constants';
import { TabSpecificField } from '../../../enums/entity.enum';
import { Policy } from '../../../generated/entity/policies/policy';
import { withPageLayout } from '../../../hoc/withPageLayout';
import { addRole, getPolicies } from '../../../rest/rolesAPIV1';
import { getIsErrorMatch } from '../../../utils/APIUtils';
import { translateWithNestedKeys } from '../../../utils/i18next/LocalUtil';
import { getPath, getRoleWithFqnPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

interface AddRoleFormValues {
  name: string;
  policies: string[];
}

const rolesPath = getPath(GlobalSettingOptions.ROLES);

const AddRolePage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [policies, setPolicies] = useState<Policy[]>([]);
  // Validate while typing, as the antd form did.
  const form = useForm<AddRoleFormValues>({
    mode: 'onChange',
    defaultValues: { name: '', policies: [] },
  });
  const [description, setDescription] = useState<string>('');
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

  const handleSubmit = async ({ name, policies }: AddRoleFormValues) => {
    setIsSaveLoading(true);
    const data = {
      name: trim(name),
      description,
      policies,
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

  const policyItems = useMemo<SelectItemType[]>(
    () =>
      policies.map((policy) => ({
        id: policy.fullyQualifiedName ?? policy.name,
        label: policy.displayName || policy.name,
      })),
    [policies]
  );

  useEffect(() => {
    fetchPolicies();
  }, []);

  const translatedRoleBreadcrumb = useMemo(
    () =>
      ADD_ROLE_PAGE_BREADCRUMB.map((option) => ({
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
          <div data-testid="add-role-container">
            <TitleBreadcrumb titleLinks={translatedRoleBreadcrumb} />
            <div className="m-t-md">
              <Typography
                as="p"
                className="text-base tw:mb-4!"
                data-testid="form-title">
                {t('label.add-new-entity', {
                  entity: t('label.role'),
                })}
              </Typography>
              <HookForm
                className="tw:flex tw:flex-col tw:gap-4"
                data-testid="role-form"
                form={form}
                id="role-form"
                onSubmit={form.handleSubmit(handleSubmit)}>
                <FormField
                  control={form.control}
                  name="name"
                  rules={NAME_FIELD_REGISTER_RULES}>
                  {({ field, fieldState }) => (
                    <Input
                      isRequired
                      hint={fieldState.error?.message}
                      id="name"
                      inputDataTestId="name"
                      isInvalid={fieldState.invalid}
                      label={t('label.name')}
                      placeholder={t('label.role-name')}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                    />
                  )}
                </FormField>
                <Box direction="col" gap={1}>
                  <FormItemLabel label={t('label.description')} />
                  <RichTextEditor
                    data-testid="description"
                    initialValue=""
                    placeHolder={t('message.write-your-description')}
                    onTextChange={setDescription}
                  />
                </Box>
                <FormField
                  control={form.control}
                  name="policies"
                  rules={{
                    validate: (value) =>
                      value.length > 0 || t('message.at-least-one-policy'),
                  }}>
                  {({ field, fieldState }) => (
                    <Box direction="col" gap={1}>
                      <FormItemLabel
                        required
                        label={t('label.select-a-policy')}
                      />
                      <Autocomplete
                        data-testid="policies"
                        isInvalid={fieldState.invalid}
                        items={policyItems}
                        placeholder={t('label.select-a-policy')}
                        selectedItems={policyItems.filter((item) =>
                          field.value.includes(item.id)
                        )}
                        onItemCleared={(key) =>
                          field.onChange(
                            field.value.filter((id) => id !== String(key))
                          )
                        }
                        onItemInserted={(key) =>
                          field.onChange([...field.value, String(key)])
                        }>
                        {(item) => (
                          <Autocomplete.Item id={item.id} label={item.label} />
                        )}
                      </Autocomplete>
                      {fieldState.error && (
                        <HintText isInvalid>
                          {fieldState.error.message}
                        </HintText>
                      )}
                    </Box>
                  )}
                </FormField>
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
                    form="role-form"
                    isLoading={isSaveLoading}
                    type="submit">
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
      pageTitle={t('label.add-new-entity', {
        entity: t('label.role'),
      })}
      secondPanel={{
        children: (
          <>
            <Typography as="p" className="text-base font-medium tw:mb-4!">
              {t('label.add-entity', {
                entity: t('label.role'),
              })}
            </Typography>
            <Typography>{t('message.add-role-message')}</Typography>
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
