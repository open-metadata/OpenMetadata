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
  ButtonUtility,
  FieldProp,
  FieldTypes,
  FormField,
  FormFields,
  FormItemLabel,
  HookForm,
  Input,
  RadioButton,
  RadioGroup,
  Select,
  SelectItemType,
  Toggle,
} from '@openmetadata/ui-core-components';
import {
  Copy01,
  Plus,
  RefreshCw01,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compact, debounce, isUndefined, trim } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFilter } from 'react-aria';
import { Control, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
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
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { DomainLabel } from '../../../common/DomainLabel/DomainLabel.component';
import DomainSelectableList from '../../../common/DomainSelectableList/DomainSelectableList.component';
import InlineAlert from '../../../common/InlineAlert/InlineAlert';
import RichTextEditor from '../../../common/RichTextEditor/RichTextEditor';
import {
  mergeRoleItems,
  withoutId,
} from '../../../discovery/personal-space/Profile/tabs/members/Members.utils';
import TeamsSelectable from '../../Team/TeamsSelectable/TeamsSelectable';
import { CreateUserFormData, CreateUserProps } from './CreateUser.interface';

interface CreateUserFormValues {
  email: string;
  displayName: string;
  tokenExpiry?: JWTTokenExpiry;
  allowImpersonation: boolean;
  passwordGenerator: CreatePasswordGenerator;
  password: string;
  confirmPassword: string;
  roles: string[];
  personas: string[];
  domains?: EntityReference[];
}

// Takes `control` explicitly: HookForm's provider belongs to the core package's
// react-hook-form copy, so useFormContext() here would not see it.
const BotFields = ({
  control,
  isAdminUser,
}: {
  control: Control<CreateUserFormValues>;
  isAdminUser: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <>
      <FormField
        control={control}
        name="tokenExpiry"
        rules={{
          required: t('label.field-required', {
            field: t('label.token-expiration'),
          }),
        }}>
        {({ field, fieldState }) => (
          <Select
            isRequired
            data-testid="token-expiry"
            hint={fieldState.error?.message}
            isInvalid={fieldState.invalid}
            items={getJWTTokenExpiryOptions()}
            label={t('label.token-expiration')}
            placeholder={t('message.select-token-expiration')}
            selectedKey={field.value ?? null}
            onSelectionChange={(key) => key !== null && field.onChange(key)}>
            {(item) => <Select.Item id={item.id} label={item.label} />}
          </Select>
        )}
      </FormField>
      {isAdminUser && (
        <FormField control={control} name="allowImpersonation">
          {({ field }) => (
            <Toggle
              data-testid="allow-impersonation"
              hint={t('message.allow-impersonation-help')}
              isSelected={field.value}
              label={t('label.allow-impersonation')}
              onChange={field.onChange}
            />
          )}
        </FormField>
      )}
    </>
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
  const { contains } = useFilter({ sensitivity: 'base' });
  const isAdminPage = Boolean(state?.isAdminPage);
  const { authConfig, currentUser, inlineAlertDetails } = useApplicationStore();
  const isAdminUser = Boolean(currentUser?.isAdmin);
  const { activeDomainEntityRef } = useDomainStore();
  const form = useForm<CreateUserFormValues>({
    defaultValues: {
      email: '',
      displayName: '',
      allowImpersonation: false,
      passwordGenerator: CreatePasswordGenerator.AutomaticGenerate,
      password: '',
      confirmPassword: '',
      roles: [],
      personas: [],
      domains: activeDomainEntityRef ? [activeDomainEntityRef] : undefined,
    },
  });
  const [isAdmin, setIsAdmin] = useState(isAdminPage);
  const [isBot, setIsBot] = useState(forceBot);
  const [description, setDescription] = useState('');
  const [selectedTeams, setSelectedTeams] = useState<EntityReference[]>([]);
  const [roleItems, setRoleItems] = useState<SelectItemType[]>([]);
  const [personaItems, setPersonaItems] = useState<SelectItemType[]>([]);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [isPasswordGenerating, setIsPasswordGenerating] = useState(false);
  const password = form.watch('password');
  const selectedDomain = form.watch('domains') ?? [];

  const isAuthProviderBasic =
    authConfig?.provider === AuthProvider.Basic ||
    authConfig?.provider === AuthProvider.LDAP;

  const nameFields: FieldProp[] = [
    {
      name: 'email',
      label: t('label.email'),
      type: FieldTypes.TEXT,
      required: true,
      placeholder: t('label.email'),
      props: { inputDataTestId: 'email' },
      rules: {
        required: t('label.field-required', { field: t('label.email') }),
        pattern: {
          value: EMAIL_REG_EX,
          message: t('message.field-text-is-invalid', {
            fieldText: t('label.email'),
          }),
        },
      },
    },
    {
      name: 'displayName',
      label: t('label.display-name'),
      type: FieldTypes.TEXT,
      required: false,
      placeholder: t('label.display-name'),
      props: { inputDataTestId: 'displayName' },
    },
  ];

  const passwordFields: FieldProp[] = [
    {
      name: 'password',
      label: t('label.password'),
      type: FieldTypes.PASSWORD,
      required: true,
      placeholder: t('label.password-type', { type: t('label.enter') }),
      props: { inputDataTestId: 'password' },
      rules: {
        required: t('label.field-required', { field: t('label.password') }),
        // passwordRegex is global; a fresh instance avoids lastIndex carry-over.
        pattern: {
          value: new RegExp(passwordRegex.source),
          message: t('message.password-error-message'),
        },
      },
    },
    {
      name: 'confirmPassword',
      label: t('label.password-type', { type: t('label.confirm') }),
      type: FieldTypes.PASSWORD,
      required: true,
      placeholder: t('label.password-type', { type: t('label.confirm') }),
      props: { inputDataTestId: 'confirmPassword' },
      rules: {
        validate: (value: string) =>
          value === password || t('label.password-not-match'),
      },
    },
  ];

  const generateRandomPassword = useCallback(async () => {
    setIsPasswordGenerating(true);
    try {
      setGeneratedPassword(await generateRandomPwd());
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPasswordGenerating(false);
    }
  }, []);

  const handleCopyPassword = async () => {
    if (!generatedPassword) {
      return;
    }
    await navigator.clipboard.writeText(generatedPassword);
    showSuccessToast(t('message.copied-to-clipboard'));
  };

  const fetchRoleOptions = useCallback(
    async (searchText = '') => {
      try {
        const roles = await searchRoles(searchText);
        const fetched = roles.map((role) => ({
          id: role.id,
          label: getEntityName(role),
        }));
        setRoleItems((prev) =>
          mergeRoleItems(prev, fetched, form.getValues('roles'))
        );
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', { entity: t('label.role-plural') })
        );
      }
    },
    [form, t]
  );

  const debouncedFetchRoleOptions = useMemo(
    () => debounce(fetchRoleOptions, 300),
    [fetchRoleOptions]
  );

  // ponytail: first page only; add paging if persona counts outgrow it.
  const fetchPersonaOptions = useCallback(async () => {
    try {
      const { data } = await getAllPersonas({
        limit: AGGREGATE_PAGE_SIZE_LARGE,
      });
      setPersonaItems(
        data.map((persona) => ({
          id: persona.id,
          label: getEntityName(persona),
        }))
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.persona-plural') })
      );
    }
  }, [t]);

  const handleSave = (values: CreateUserFormValues) => {
    const isPasswordGenerated =
      values.passwordGenerator === CreatePasswordGenerator.AutomaticGenerate;
    const validTeams = compact(selectedTeams).map((team) => team.id);

    let authMechanismConfig: Partial<CreateUserFormData> = {};
    if (forceBot) {
      authMechanismConfig = {
        authenticationMechanism: {
          authType: AuthType.Jwt,
          config: { JWTTokenExpiry: values.tokenExpiry },
        },
        allowImpersonation: values.allowImpersonation,
      };
    } else if (isAuthProviderBasic) {
      authMechanismConfig = {
        password: isPasswordGenerated ? generatedPassword : values.password,
        confirmPassword: isPasswordGenerated
          ? generatedPassword
          : values.confirmPassword,
        createPasswordType: CreatePasswordType.AdminCreate,
      };
    }

    onSave({
      description,
      name: values.email.split('@')[0],
      displayName: trim(values.displayName),
      roles: values.roles,
      teams: validTeams.length ? validTeams : undefined,
      personas: values.personas.map((id) => ({
        id,
        type: EntityType.PERSONA,
      })),
      email: values.email,
      isAdmin,
      domains: selectedDomain.map((domain) => domain.fullyQualifiedName ?? ''),
      isBot,
      ...authMechanismConfig,
    });
  };

  useEffect(() => {
    generateRandomPassword();
  }, [generateRandomPassword]);

  useEffect(() => {
    if (!forceBot && !isAdminPage) {
      fetchRoleOptions();
      fetchPersonaOptions();
    }

    return () => debouncedFetchRoleOptions.cancel();
  }, [
    forceBot,
    isAdminPage,
    fetchRoleOptions,
    fetchPersonaOptions,
    debouncedFetchRoleOptions,
  ]);

  const toSelectedItems = (ids: string[], items: SelectItemType[]) =>
    ids.map((id) => ({
      id,
      label: items.find((item) => String(item.id) === id)?.label ?? id,
    }));

  const renderMultiSelect = (
    name: 'roles' | 'personas',
    label: string,
    testId: string,
    items: SelectItemType[],
    onSearchChange?: (value: string) => void
  ) => (
    <FormField control={form.control} name={name}>
      {({ field }) => (
        <Box direction="col" gap={1}>
          <FormItemLabel label={label} />
          <Autocomplete
            data-testid={testId}
            filterOption={
              onSearchChange
                ? undefined
                : (item, filterText) => contains(item.label || '', filterText)
            }
            items={items}
            placeholder={t('label.please-select-entity', { entity: label })}
            selectedItems={toSelectedItems(field.value, items)}
            onItemCleared={(key) => field.onChange(withoutId(field.value, key))}
            onItemInserted={(key) =>
              field.onChange([...field.value, String(key)])
            }
            onSearchChange={onSearchChange}>
            {(item) => (
              <Autocomplete.Item id={item.id} key={item.id}>
                {item.label}
              </Autocomplete.Item>
            )}
          </Autocomplete>
        </Box>
      )}
    </FormField>
  );

  const renderPasswordSection = () => (
    <FormField control={form.control} name="passwordGenerator">
      {({ field }) => (
        <Box direction="col" gap={3}>
          <RadioGroup
            aria-label={t('label.password')}
            className="tw:flex-row tw:items-center tw:gap-6"
            orientation="horizontal"
            value={field.value}
            onChange={field.onChange}>
            <RadioButton
              data-testid="password-auto-generate"
              label={t('label.automatically-generate')}
              value={CreatePasswordGenerator.AutomaticGenerate}
            />
            <RadioButton
              data-testid="password-create"
              label={t('label.password-type', { type: t('label.create') })}
              value={CreatePasswordGenerator.CreatePassword}
            />
          </RadioGroup>
          {field.value === CreatePasswordGenerator.CreatePassword ? (
            <FormFields fields={passwordFields} />
          ) : (
            <Input
              isReadOnly
              inputDataTestId="generated-password"
              label={t('label.password-type', { type: t('label.generate') })}
              trailingSlot={
                <Box align="center" direction="row">
                  <ButtonUtility
                    color="tertiary"
                    data-testid="password-generator"
                    icon={RefreshCw01}
                    isDisabled={isPasswordGenerating}
                    size="sm"
                    tooltip={String(t('label.regenerate'))}
                    onClick={generateRandomPassword}
                  />
                  <ButtonUtility
                    color="tertiary"
                    data-testid="copy-password"
                    icon={Copy01}
                    size="sm"
                    tooltip={String(t('label.copy'))}
                    onClick={handleCopyPassword}
                  />
                </Box>
              }
              type="password"
              value={generatedPassword}
            />
          )}
        </Box>
      )}
    </FormField>
  );

  return (
    <HookForm
      className="tw:flex tw:flex-col tw:gap-4"
      data-testid="create-user-form"
      form={form}
      id="create-user-bot-form"
      onSubmit={form.handleSubmit(handleSave)}>
      <FormFields fields={nameFields} />
      {forceBot && (
        <BotFields control={form.control} isAdminUser={isAdminUser} />
      )}
      <Box direction="col" gap={1}>
        <FormItemLabel label={t('label.description')} />
        <RichTextEditor
          data-testid="description"
          initialValue=""
          onTextChange={setDescription}
        />
      </Box>
      {!forceBot && (
        <>
          {isAuthProviderBasic && renderPasswordSection()}
          {!isAdminPage && (
            <>
              <Box direction="col" gap={1}>
                <FormItemLabel label={t('label.team-plural')} />
                <TeamsSelectable onSelectionChange={setSelectedTeams} />
              </Box>
              {renderMultiSelect(
                'roles',
                t('label.role-plural'),
                'roles-dropdown',
                roleItems,
                debouncedFetchRoleOptions
              )}
              {renderMultiSelect(
                'personas',
                t('label.persona-plural'),
                'personas-dropdown',
                personaItems
              )}
            </>
          )}
          <Toggle
            data-testid="admin"
            isSelected={isAdmin}
            label={t('label.admin')}
            onChange={(selected) => {
              setIsAdmin(selected);
              setIsBot(false);
            }}
          />
        </>
      )}
      {!isBot && (
        <FormField control={form.control} name="domains">
          {({ field }) => (
            <Box direction="col" gap={1}>
              <Box align="center" gap={2}>
                <FormItemLabel label={t('label.domain-plural')} />
                <DomainSelectableList
                  hasPermission
                  multiple
                  selectedDomain={field.value}
                  onUpdate={async (domains) =>
                    field.onChange(
                      domains === undefined
                        ? undefined
                        : ([] as EntityReference[]).concat(domains)
                    )
                  }>
                  <Button
                    aria-label={t('label.add-entity', {
                      entity: t('label.domain'),
                    })}
                    color="primary"
                    data-testid="add-domain"
                    iconLeading={Plus}
                    size="xs"
                  />
                </DomainSelectableList>
              </Box>
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
          )}
        </FormField>
      )}
      {!isUndefined(inlineAlertDetails) && (
        <InlineAlert alertClassName="m-b-xs" {...inlineAlertDetails} />
      )}
      <Box gap={3} justify="end">
        <Button color="secondary" data-testid="cancel-user" onClick={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="save-user"
          isLoading={isLoading}
          type="submit">
          {t('label.create')}
        </Button>
      </Box>
    </HookForm>
  );
};

export default CreateUser;
