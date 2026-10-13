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

import { PlusOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import {
  Box,
  Button,
  FormField,
  FormItemLabel,
  HintText,
  HookForm,
  RadioButton,
  RadioGroup,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { Input, Select } from 'antd';
import { AxiosError } from 'axios';
import {
  compact,
  debounce,
  isEmpty,
  isUndefined,
  map,
  trim,
  uniqBy,
} from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ReactComponent as IconSync } from '../../../../assets/svg/ic-sync.svg';
import { AGGREGATE_PAGE_SIZE_LARGE } from '../../../../constants/constants';
import {
  EMAIL_REG_EX,
  passwordRegex,
} from '../../../../constants/regex.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { CreatePasswordGenerator } from '../../../../enums/user.enum';
import {
  AuthType,
  CreatePasswordType,
} from '../../../../generated/api/teams/createUser';
import { JWTTokenExpiry } from '../../../../generated/entity/teams/user';
import { EntityReference } from '../../../../generated/entity/type';
import { AuthProvider } from '../../../../generated/settings/settings';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useDomainStore } from '../../../../hooks/useDomainStore';
import { generateRandomPwd } from '../../../../rest/auth-API';
import { getAllPersonas } from '../../../../rest/PersonaAPI';
import { searchRoles } from '../../../../rest/rolesAPIV1';
import { getJWTTokenExpiryOptions } from '../../../../utils/BotsUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getEntityReferenceListFromEntities } from '../../../../utils/EntityReferenceUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { AsyncSelect } from '../../../common/AsyncSelect/AsyncSelect';
import { AsyncSelectListProps } from '../../../common/AsyncSelect/AsyncSelectList.interface';
import CopyToClipboardButton from '../../../common/CopyToClipboardButton/CopyToClipboardButton';
import { DomainLabel } from '../../../common/DomainLabel/DomainLabel.component';
import DomainSelect from '../../../common/DomainSelect/DomainSelect';
import { DomainSelectTrigger } from '../../../common/DomainSelect/DomainSelectTrigger';
import InlineAlert from '../../../common/InlineAlert/InlineAlert';
import Loader from '../../../common/Loader/Loader';
import RichTextEditor from '../../../common/RichTextEditor/RichTextEditor';
import TeamsSelectable from '../../Team/TeamsSelectable/TeamsSelectable';
import { CreateUserFormData, CreateUserProps } from './CreateUser.interface';

type CreateUserValues = Omit<
  CreateUserFormData,
  'name' | 'domains' | 'teams' | 'personas'
> & {
  domains: EntityReference[];
  teams: EntityReference[];
  personas: string[];
  passwordGenerator: CreatePasswordGenerator;
  generatedPassword?: string;
  tokenExpiry?: JWTTokenExpiry;
};

interface BotFieldsProps {
  form: UseFormReturn<CreateUserValues>;
  isAdminUser: boolean;
}

const BotFields = ({ form, isAdminUser }: BotFieldsProps) => {
  const { t } = useTranslation();

  return (
    <>
      <FormField
        control={form.control}
        name="tokenExpiry"
        rules={{
          required: t('label.field-required', {
            field: t('label.token-expiration'),
          }),
        }}>
        {({ field, fieldState }) => (
          <Box direction="col" gap={2}>
            <FormItemLabel required label={t('label.token-expiration')} />
            <Select
              {...field}
              aria-label={t('label.token-expiration')}
              className="w-full"
              data-testid="token-expiry"
              placeholder={t('message.select-token-expiration')}>
              {getJWTTokenExpiryOptions()}
            </Select>
            {fieldState.error && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>
      {isAdminUser && (
        <FormField control={form.control} name="allowImpersonation">
          {({ field, fieldState }) => (
            <Box direction="col" gap={2}>
              <FormItemLabel
                label={t('label.allow-impersonation')}
                required={false}
                tooltip={t('message.allow-impersonation-help')}
              />
              <Toggle
                data-testid="allow-impersonation"
                isSelected={!!field.value}
                onChange={field.onChange}
              />
              {fieldState.error && (
                <HintText isInvalid>{fieldState.error.message}</HintText>
              )}
            </Box>
          )}
        </FormField>
      )}
    </>
  );
};

interface PasswordConfigSectionProps {
  form: UseFormReturn<CreateUserValues>;
  generatedPassword?: string;
  isAuthProviderBasic: boolean;
  isPasswordGenerating: boolean;
  password?: string;
  passwordGenerator?: string;
  onGeneratePassword: () => void;
}

const PasswordConfigSection = ({
  form,
  generatedPassword,
  isAuthProviderBasic,
  isPasswordGenerating,
  passwordGenerator,
  onGeneratePassword,
}: PasswordConfigSectionProps) => {
  const { t } = useTranslation();

  if (!isAuthProviderBasic) {
    return null;
  }

  return (
    <>
      <FormField control={form.control} name="passwordGenerator">
        {({ field, fieldState }) => (
          <Box direction="col" gap={2}>
            <RadioGroup
              {...field}
              aria-label={t('label.password-type', {
                type: t('label.create'),
              })}>
              <RadioButton
                label={<>{t('label.automatically-generate')}</>}
                value={CreatePasswordGenerator.AutomaticGenerate}
              />
              <RadioButton
                label={
                  <>
                    {t('label.password-type', {
                      type: t('label.create'),
                    })}
                  </>
                }
                value={CreatePasswordGenerator.CreatePassword}
              />
            </RadioGroup>
            {fieldState.error && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>

      {passwordGenerator === CreatePasswordGenerator.CreatePassword ? (
        <div className="m-t-sm">
          <FormField
            control={form.control}
            name="password"
            rules={{
              required: t('label.field-required', {
                field: t('label.password'),
              }),
              pattern: {
                value: passwordRegex,
                message: t('message.password-error-message'),
              },
            }}>
            {({ field, fieldState }) => (
              <Box direction="col" gap={2}>
                <FormItemLabel required label={t('label.password')} />
                <Input.Password
                  {...field}
                  aria-label={t('label.password')}
                  autoComplete="off"
                  name="password"
                  placeholder={t('label.password-type', {
                    type: t('label.enter'),
                  })}
                />
                {fieldState.error && (
                  <HintText isInvalid>{fieldState.error.message}</HintText>
                )}
              </Box>
            )}
          </FormField>

          <FormField
            control={form.control}
            name="confirmPassword"
            rules={{
              deps: ['password'],
              validate: (value) =>
                value === form.getValues('password') ||
                t('label.password-not-match'),
            }}>
            {({ field, fieldState }) => (
              <Box direction="col" gap={2}>
                <FormItemLabel
                  required
                  label={t('label.password-type', {
                    type: t('label.confirm'),
                  })}
                />
                <Input.Password
                  {...field}
                  aria-label={t('label.password-type', {
                    type: t('label.confirm'),
                  })}
                  autoComplete="off"
                  name="confirmPassword"
                  placeholder={t('label.password-type', {
                    type: t('label.confirm'),
                  })}
                />
                {fieldState.error && (
                  <HintText isInvalid>{fieldState.error.message}</HintText>
                )}
              </Box>
            )}
          </FormField>
        </div>
      ) : (
        <div className="m-t-sm">
          <FormField
            control={form.control}
            name="generatedPassword"
            rules={{
              required: t('label.field-required', {
                field: t('label.password-type', {
                  type: t('label.generate'),
                }),
              }),
            }}>
            {({ field, fieldState }) => (
              <Box direction="col" gap={2}>
                <FormItemLabel
                  required
                  label={t('label.password-type', {
                    type: t('label.generate'),
                  })}
                />
                <Input.Password
                  {...field}
                  readOnly
                  addonAfter={
                    <div className="flex-center w-16">
                      <div
                        className="w-8 h-7 flex-center cursor-pointer"
                        data-testid="password-generator"
                        role="button"
                        tabIndex={0}
                        onClick={onGeneratePassword}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            onGeneratePassword();
                          }
                        }}>
                        {isPasswordGenerating ? (
                          <Loader size="small" type="default" />
                        ) : (
                          <Icon
                            className="align-middle"
                            component={IconSync}
                            style={{ fontSize: '16px' }}
                          />
                        )}
                      </div>

                      <div className="w-8 h-7 flex-center">
                        <CopyToClipboardButton
                          copyText={generatedPassword ?? ''}
                        />
                      </div>
                    </div>
                  }
                  aria-label={t('label.password-type', {
                    type: t('label.generate'),
                  })}
                  autoComplete="off"
                  name="generatedPassword"
                  value={generatedPassword}
                />
                {fieldState.error && (
                  <HintText isInvalid>{fieldState.error.message}</HintText>
                )}
              </Box>
            )}
          </FormField>
        </div>
      )}
    </>
  );
};

interface TeamRolePersonaFieldsProps {
  form: UseFormReturn<CreateUserValues>;
  debouncedFetchRoleOptions: (searchText?: string) => void;
  fetchPersonaOptions: AsyncSelectListProps['api'];
  isRolesLoading: boolean;
  roleOptions: Array<{ label: string; value: string }>;
  onTeamsSelectionChange: (teams: EntityReference[]) => void;
}

const TeamRolePersonaFields = ({
  form,
  debouncedFetchRoleOptions,
  fetchPersonaOptions,
  isRolesLoading,
  roleOptions,
  onTeamsSelectionChange,
}: TeamRolePersonaFieldsProps) => {
  const { t } = useTranslation();

  return (
    <>
      <FormField control={form.control} name="teams">
        {({ field, fieldState }) => (
          <Box direction="col" gap={2}>
            <FormItemLabel label={t('label.team-plural')} required={false} />
            <TeamsSelectable
              selectedTeams={field.value}
              onSelectionChange={(teams) => {
                field.onChange(teams);
                onTeamsSelectionChange(teams);
              }}
            />
            {fieldState.error && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>
      <FormField control={form.control} name="roles">
        {({ field, fieldState }) => (
          <Box direction="col" gap={2}>
            <FormItemLabel label={t('label.role-plural')} required={false} />
            <Select
              {...field}
              showSearch
              aria-label={t('label.role-plural')}
              data-testid="roles-dropdown"
              disabled={isRolesLoading && isEmpty(roleOptions)}
              filterOption={false}
              getPopupContainer={(triggerNode) => triggerNode.parentElement}
              loading={isRolesLoading}
              mode="multiple"
              options={roleOptions}
              placeholder={t('label.please-select-entity', {
                entity: t('label.role-plural'),
              })}
              onSearch={debouncedFetchRoleOptions}
            />
            {fieldState.error && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>
      <FormField control={form.control} name="personas">
        {({ field, fieldState }) => (
          <Box direction="col" gap={2}>
            <FormItemLabel label={t('label.persona-plural')} required={false} />
            <AsyncSelect
              {...field}
              enableInfiniteScroll
              showSearch
              api={fetchPersonaOptions}
              aria-label={t('label.persona-plural')}
              data-testid="personas-dropdown"
              filterOption={(input, option) => {
                const label = String(option?.label ?? option?.value ?? '');

                return (
                  !input || label.toLowerCase().includes(input.toLowerCase())
                );
              }}
              mode="multiple"
              placeholder={t('label.please-select-entity', {
                entity: t('label.persona-plural'),
              })}
            />
            {fieldState.error && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>
    </>
  );
};

interface AdminOnlyFieldsProps {
  form: UseFormReturn<CreateUserValues>;
  debouncedFetchRoleOptions: (searchText?: string) => void;
  fetchPersonaOptions: AsyncSelectListProps['api'];
  generatedPassword?: string;
  isAdmin: boolean;
  isAdminPage: boolean;
  isAuthProviderBasic: boolean;
  isPasswordGenerating: boolean;
  isRolesLoading: boolean;
  password?: string;
  passwordGenerator?: string;
  roleOptions: Array<{ label: string; value: string }>;
  onGeneratePassword: () => void;
  onTeamsSelectionChange: (teams: EntityReference[]) => void;
  onToggleAdmin: () => void;
}

const AdminOnlyFields = ({
  form,
  debouncedFetchRoleOptions,
  fetchPersonaOptions,
  generatedPassword,
  isAdmin,
  isAdminPage,
  isAuthProviderBasic,
  isPasswordGenerating,
  isRolesLoading,
  password,
  passwordGenerator,
  roleOptions,
  onGeneratePassword,
  onTeamsSelectionChange,
  onToggleAdmin,
}: AdminOnlyFieldsProps) => {
  const { t } = useTranslation();

  return (
    <>
      <PasswordConfigSection
        form={form}
        generatedPassword={generatedPassword}
        isAuthProviderBasic={isAuthProviderBasic}
        isPasswordGenerating={isPasswordGenerating}
        password={password}
        passwordGenerator={passwordGenerator}
        onGeneratePassword={onGeneratePassword}
      />
      {!isAdminPage && (
        <TeamRolePersonaFields
          debouncedFetchRoleOptions={debouncedFetchRoleOptions}
          fetchPersonaOptions={fetchPersonaOptions}
          form={form}
          isRolesLoading={isRolesLoading}
          roleOptions={roleOptions}
          onTeamsSelectionChange={onTeamsSelectionChange}
        />
      )}

      <div>
        <Box
          inline
          align="center"
          className="layout-space layout-space-horizontal"
          gap={2}
          itemClassName="layout-space-item">
          <Typography> {t('label.admin')}</Typography>
          <Toggle
            data-testid="admin"
            isSelected={isAdmin}
            onChange={onToggleAdmin}
          />
        </Box>
      </div>
    </>
  );
};

const DomainSection = ({
  form,
  selectedDomain,
}: {
  form: UseFormReturn<CreateUserValues>;
  selectedDomain: EntityReference[];
}) => {
  const { t } = useTranslation();

  return (
    <Box direction="col" gap={2}>
      <FormItemLabel label={t('label.domain-plural')} />
      <FormField control={form.control} name="domains">
        {({ field }) => (
          <DomainSelect
            hasPermission
            multiple
            renderTrigger={({ toggle }) => (
              <DomainSelectTrigger toggle={toggle}>
                <Button
                  aria-label={t('label.add-entity', {
                    entity: t('label.domain'),
                  })}
                  color="primary"
                  data-testid="add-domain"
                  iconLeading={
                    <PlusOutlined
                      style={{ color: 'white', fontSize: '12px' }}
                    />
                  }
                  size="xs"
                />
              </DomainSelectTrigger>
            )}
            selectedDomain={field.value}
            triggerVariant="button"
            onUpdate={field.onChange}
          />
        )}
      </FormField>
      {selectedDomain.length > 0 && (
        <DomainLabel
          multiple
          domains={selectedDomain}
          entityFqn=""
          entityId=""
          entityType={EntityType.USER}
          hasPermission={false}
        />
      )}
    </Box>
  );
};

const CreateUser = ({
  isLoading,
  onCancel,
  onSave,
  forceBot,
}: CreateUserProps) => {
  const {
    state,
  }: {
    state?: { isAdminPage: boolean };
  } = useLocation();
  const { t } = useTranslation();

  const isAdminPage = Boolean(state?.isAdminPage);
  const { authConfig, currentUser, inlineAlertDetails } = useApplicationStore();
  const isAdminUser = Boolean(currentUser?.isAdmin);
  const [isAdmin, setIsAdmin] = useState(isAdminPage);
  const [isBot, setIsBot] = useState(forceBot);
  const [selectedTeams, setSelectedTeams] = useState<
    Array<EntityReference | undefined>
  >([]);
  const [roleOptions, setRoleOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [isRolesLoading, setIsRolesLoading] = useState(false);
  const [isPasswordGenerating, setIsPasswordGenerating] = useState(false);
  const { activeDomainEntityRef } = useDomainStore();
  const form = useForm<CreateUserValues>({
    mode: 'onChange',
    defaultValues: {
      email: '',
      displayName: '',
      description: '',
      roles: [],
      teams: [],
      personas: [],
      domains:
        !forceBot && activeDomainEntityRef ? [activeDomainEntityRef] : [],
      passwordGenerator: CreatePasswordGenerator.AutomaticGenerate,
    },
  });
  const watchedDomains = useWatch({ control: form.control, name: 'domains' });
  const selectedDomain = watchedDomains ?? [];

  const isAuthProviderBasic = useMemo(
    () =>
      authConfig?.provider === AuthProvider.Basic ||
      authConfig?.provider === AuthProvider.LDAP,
    [authConfig]
  );

  const selectedRoles = useWatch({ control: form.control, name: 'roles' });
  const selectedPersonas = useWatch({
    control: form.control,
    name: 'personas',
  });

  const fetchRoleOptions = useCallback(
    async (searchText = '') => {
      setIsRolesLoading(true);

      try {
        const roles = await searchRoles(searchText);
        const nextOptions = map(roles, (role) => ({
          label: getEntityName(role),
          value: role.id,
        }));

        setRoleOptions((prevOptions) => {
          const selectedRoleOptions = prevOptions.filter((option) =>
            (selectedRoles ?? []).includes(String(option.value))
          );

          return uniqBy([...selectedRoleOptions, ...nextOptions], 'value');
        });
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', { entity: t('label.role-plural') })
        );
      } finally {
        setIsRolesLoading(false);
      }
    },
    [selectedRoles, t]
  );

  const fetchPersonaOptions = async (_searchText: string, page?: number) => {
    try {
      const params: Record<string, unknown> = {
        limit: AGGREGATE_PAGE_SIZE_LARGE,
      };

      if (page && page > 1) {
        params.after = String((page - 1) * AGGREGATE_PAGE_SIZE_LARGE);
      }

      const response = await getAllPersonas(params);
      const personaRefs = getEntityReferenceListFromEntities(
        response.data,
        EntityType.PERSONA
      );

      return {
        data: personaRefs.map((persona) => ({
          label: getEntityName(persona),
          value: persona.id,
          data: persona,
        })),
        paging: response.paging,
      };
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.persona-plural') })
      );

      return { data: [], paging: {} };
    }
  };

  const generatedPassword = useWatch({
    control: form.control,
    name: 'generatedPassword',
  });
  const passwordGenerator = useWatch({
    control: form.control,
    name: 'passwordGenerator',
  });
  const password = useWatch({ control: form.control, name: 'password' });

  const generateRandomPassword = async () => {
    setIsPasswordGenerating(true);
    try {
      const password = await generateRandomPwd();
      setTimeout(() => {
        form.setValue('generatedPassword', password, { shouldValidate: true });
      }, 500);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsPasswordGenerating(false);
    }
  };

  /**
   * Form submit handler
   */
  const handleSave = (values: CreateUserValues) => {
    const isPasswordGenerated =
      passwordGenerator === CreatePasswordGenerator.AutomaticGenerate;
    const validTeam = compact(selectedTeams).map((team) => team.id);
    const validPersonas = selectedPersonas?.map(
      (personaId: string) =>
        ({
          id: personaId,
          type: EntityType.PERSONA,
        } as EntityReference)
    );

    const {
      email,
      displayName,
      tokenExpiry,
      confirmPassword,
      description,
      allowImpersonation,
    } = values;

    let authMechanismConfig: Partial<CreateUserFormData> = {};
    if (forceBot) {
      authMechanismConfig = {
        authenticationMechanism: {
          authType: AuthType.Jwt,
          config: {
            JWTTokenExpiry: tokenExpiry,
          },
        },
        allowImpersonation,
      };
    } else if (isAuthProviderBasic) {
      authMechanismConfig = {
        password: isPasswordGenerated ? generatedPassword : password,
        confirmPassword: isPasswordGenerated
          ? generatedPassword
          : confirmPassword,
        createPasswordType: CreatePasswordType.AdminCreate,
      };
    }

    const userProfile: CreateUserFormData = {
      description,
      name: email.split('@')[0],
      displayName: trim(displayName),
      roles: selectedRoles,
      teams: validTeam.length ? validTeam : undefined,
      personas: validPersonas,
      email: email,
      isAdmin: isAdmin,
      domains: selectedDomain.map((domain) => domain.fullyQualifiedName ?? ''),
      isBot: isBot,
      ...authMechanismConfig,
    };
    onSave(userProfile);
  };

  useEffect(() => {
    generateRandomPassword();
  }, []);

  useEffect(() => {
    if (!forceBot && !isAdminPage) {
      fetchRoleOptions();
    }
  }, [forceBot, isAdminPage]);

  const debouncedFetchRoleOptions = useMemo(
    () => debounce(fetchRoleOptions, 300),
    [fetchRoleOptions]
  );

  useEffect(() => {
    return () => {
      debouncedFetchRoleOptions.cancel();
    };
  }, [debouncedFetchRoleOptions]);

  const onToggleAdmin = useCallback(() => {
    setIsAdmin((prev) => !prev);
    setIsBot(false);
  }, []);

  return (
    <HookForm
      className="tw:flex tw:flex-col tw:gap-4"
      form={form}
      id="create-user-bot-form"
      onSubmit={form.handleSubmit(handleSave)}>
      <FormField
        control={form.control}
        name="email"
        rules={{
          required: t('message.field-text-is-invalid', {
            fieldText: t('label.email'),
          }),
          pattern: {
            value: EMAIL_REG_EX,
            message: t('message.field-text-is-invalid', {
              fieldText: t('label.email'),
            }),
          },
        }}>
        {({ field, fieldState }) => (
          <Box direction="col" gap={2}>
            <FormItemLabel required label={t('label.email')} />
            <Input
              {...field}
              aria-label={t('label.email')}
              data-testid="email"
              name="email"
              placeholder={t('label.email')}
            />
            {fieldState.error && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>
      <FormField control={form.control} name="displayName">
        {({ field, fieldState }) => (
          <Box direction="col" gap={2}>
            <FormItemLabel label={t('label.display-name')} required={false} />
            <Input
              {...field}
              aria-label={t('label.display-name')}
              data-testid="displayName"
              name="displayName"
              placeholder={t('label.display-name')}
            />
            {fieldState.error && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>
      {forceBot && <BotFields form={form} isAdminUser={isAdminUser} />}
      <FormField control={form.control} name="description">
        {({ field }) => (
          <Box direction="col" gap={2}>
            <FormItemLabel label={t('label.description')} />
            <RichTextEditor
              data-testid="description"
              initialValue=""
              onTextChange={field.onChange}
            />
          </Box>
        )}
      </FormField>
      {!forceBot && (
        <AdminOnlyFields
          debouncedFetchRoleOptions={debouncedFetchRoleOptions}
          fetchPersonaOptions={fetchPersonaOptions}
          form={form}
          generatedPassword={generatedPassword}
          isAdmin={isAdmin}
          isAdminPage={isAdminPage}
          isAuthProviderBasic={isAuthProviderBasic}
          isPasswordGenerating={isPasswordGenerating}
          isRolesLoading={isRolesLoading}
          password={password}
          passwordGenerator={passwordGenerator}
          roleOptions={roleOptions}
          onGeneratePassword={generateRandomPassword}
          onTeamsSelectionChange={setSelectedTeams}
          onToggleAdmin={onToggleAdmin}
        />
      )}
      {!isBot && <DomainSection form={form} selectedDomain={selectedDomain} />}
      {!isUndefined(inlineAlertDetails) && (
        <InlineAlert alertClassName="m-b-xs" {...inlineAlertDetails} />
      )}
      <Box
        inline
        align="center"
        className="layout-space layout-space-horizontal w-full justify-end"
        gap={1}
        itemClassName="layout-space-item">
        <Button color="link-color" data-testid="cancel-user" onClick={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="save-user"
          form="create-user-bot-form"
          isLoading={isLoading}
          type="submit">
          {t('label.create')}
        </Button>
      </Box>
    </HookForm>
  );
};

export default CreateUser;
