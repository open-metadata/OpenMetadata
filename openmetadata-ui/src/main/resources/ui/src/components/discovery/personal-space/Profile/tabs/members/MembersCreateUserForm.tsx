/*
 *  Copyright 2026 Collate.
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
  SelectItemType,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Copy01,
  Eye,
  EyeOff,
  RefreshCw01,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compact, debounce } from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFilter } from 'react-aria';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AGGREGATE_PAGE_SIZE_LARGE } from '../../../../../../constants/constants';
import {
  EMAIL_REG_EX,
  passwordRegex,
} from '../../../../../../constants/regex.constants';
import { useLimitStore } from '../../../../../../context/LimitsProvider/useLimitsStore';
import { EntityType } from '../../../../../../enums/entity.enum';
import { CreatePasswordGenerator } from '../../../../../../enums/user.enum';
import { CreatePasswordType } from '../../../../../../generated/api/teams/createUser';
import { EntityReference } from '../../../../../../generated/entity/type';
import { AuthProvider } from '../../../../../../generated/settings/settings';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import { generateRandomPwd } from '../../../../../../rest/auth-API';
import { getAllPersonas } from '../../../../../../rest/PersonaAPI';
import { searchRoles } from '../../../../../../rest/rolesAPIV1';
import { getTeams } from '../../../../../../rest/teamsAPI';
import { createUser } from '../../../../../../rest/userAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import { getUserCreationErrorMessage } from '../../../../../../utils/UsersPureUtils';
import DomainSelect from '../../../../../common/DomainSelect/DomainSelect';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../../../common/RichTextEditor/RichTextEditor.interface';
import { CreateUserFormData } from '../../../../../Settings/Users/CreateUser/CreateUser.interface';
import type { MembersCreateUserFormProps } from './Members.types';

interface FormValues {
  email: string;
  displayName: string;
  passwordGenerator: CreatePasswordGenerator;
  password: string;
  confirmPassword: string;
  teams: string[];
  roles: string[];
  personas: string[];
}

const MembersCreateUserForm: React.FC<MembersCreateUserFormProps> = ({
  isAdmin,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const { contains } = useFilter({ sensitivity: 'base' });
  const descEditorRef = useRef<EditorContentRef>(null);

  const { authConfig } = useApplicationStore();
  const { getResourceLimit } = useLimitStore();

  const isAuthProviderBasic = useMemo(
    () =>
      authConfig?.provider === AuthProvider.Basic ||
      authConfig?.provider === AuthProvider.LDAP,
    [authConfig]
  );

  const form = useForm<FormValues>({
    defaultValues: {
      email: '',
      displayName: '',
      passwordGenerator: CreatePasswordGenerator.AutomaticGenerate,
      password: '',
      confirmPassword: '',
      teams: [],
      roles: [],
      personas: [],
    },
  });
  const { handleSubmit } = form;

  const [isAdminUser, setIsAdminUser] = useState(Boolean(isAdmin));
  const [isSaveLoading, setIsSaveLoading] = useState(false);

  const [generatedPassword, setGeneratedPassword] = useState('');
  const [isPasswordGenerating, setIsPasswordGenerating] = useState(false);
  const [showGeneratedPassword, setShowGeneratedPassword] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<EntityReference[]>([]);

  const [teamItems, setTeamItems] = useState<SelectItemType[]>([]);
  const [roleItems, setRoleItems] = useState<SelectItemType[]>([]);
  const [personaItems, setPersonaItems] = useState<SelectItemType[]>([]);

  const passwordGenerator = form.watch('passwordGenerator');
  const password = form.watch('password');

  const nameFields: FieldProp[] = [
    {
      name: 'email',
      label: t('label.email'),
      type: FieldTypes.TEXT,
      required: true,
      placeholder: t('label.email'),
      props: { 'data-testid': 'email' },
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
      props: { 'data-testid': 'displayName' },
    },
  ];

  const passwordFields: FieldProp[] = [
    {
      name: 'password',
      label: t('label.password'),
      type: FieldTypes.PASSWORD,
      required: true,
      placeholder: t('label.password-type', { type: t('label.enter') }),
      props: { 'data-testid': 'password' },
      rules: {
        required: t('label.field-required', { field: t('label.password') }),
        pattern: {
          value: passwordRegex,
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
      props: { 'data-testid': 'confirmPassword' },
      rules: {
        validate: (value: string) =>
          value === password || t('label.password-not-match'),
      },
    },
  ];

  const generateRandomPassword = async () => {
    setIsPasswordGenerating(true);
    try {
      const pwd = await generateRandomPwd();
      setGeneratedPassword(pwd);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPasswordGenerating(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!generatedPassword) {
      return;
    }
    await navigator.clipboard.writeText(generatedPassword);
    showSuccessToast(t('message.copied-to-clipboard'));
  };

  const fetchTeams = async () => {
    try {
      const { data } = await getTeams({
        parentTeam: 'Organization',
        limit: AGGREGATE_PAGE_SIZE_LARGE,
      });
      setTeamItems(
        data.map((team) => ({ id: team.id, label: getEntityName(team) }))
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.team-plural') })
      );
    }
  };

  const mergeRoleItems = (
    prev: SelectItemType[],
    fetched: SelectItemType[],
    selected: string[]
  ): SelectItemType[] => {
    const kept = prev.filter((item) => selected.includes(String(item.id)));
    const keptIds = new Set(kept.map((k) => k.id));

    return [...kept, ...fetched.filter((n) => !keptIds.has(n.id))];
  };

  const fetchRoleOptions = async (searchText = '') => {
    try {
      const roles = await searchRoles(searchText);
      const fetched: SelectItemType[] = roles.map((role) => ({
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
  };

  const debouncedFetchRoleOptions = useMemo(
    () => debounce(fetchRoleOptions, 300),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const fetchPersonaOptions = async () => {
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
  };

  useEffect(() => {
    void generateRandomPassword();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      void fetchTeams();
      void fetchRoleOptions();
      void fetchPersonaOptions();
    }

    return () => {
      debouncedFetchRoleOptions.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const selectedItems = (ids: string[], items: SelectItemType[]) =>
    ids.map((id) => {
      const match = items.find((item) => String(item.id) === id);

      return { id, label: match?.label ?? id };
    });

  const onSubmit = async (data: FormValues) => {
    const description = descEditorRef.current?.getEditorContent() ?? '';

    const isPasswordGenerated =
      passwordGenerator === CreatePasswordGenerator.AutomaticGenerate;

    let passwordConfig: Partial<CreateUserFormData> = {};
    if (isAuthProviderBasic) {
      passwordConfig = {
        password: isPasswordGenerated ? generatedPassword : data.password,
        confirmPassword: isPasswordGenerated
          ? generatedPassword
          : data.confirmPassword,
        createPasswordType: CreatePasswordType.AdminCreate,
      };
    }

    const validTeams = compact(data.teams);
    const validPersonas: EntityReference[] = data.personas.map((id) => ({
      id,
      type: EntityType.PERSONA,
    }));

    const userPayload: CreateUserFormData = {
      description,
      name: data.email.split('@')[0],
      displayName: data.displayName.trim(),
      roles: data.roles,
      teams: validTeams.length ? validTeams : undefined,
      personas: validPersonas,
      email: data.email,
      isAdmin: isAdminUser,
      isBot: false,
      domains: selectedDomains.length
        ? (selectedDomains
            .map((domain) => domain.fullyQualifiedName)
            .filter(Boolean) as string[])
        : undefined,
      ...passwordConfig,
    };

    setIsSaveLoading(true);
    try {
      await createUser(userPayload);
      await getResourceLimit('user', true, true);
      showSuccessToast(
        t('server.create-entity-success', { entity: t('label.user') })
      );
      onNavigate({ type: isAdmin ? 'admins' : 'users' });
    } catch (error) {
      // The Members tree never renders the app store's inlineAlert, so a toast is
      // the only visible feedback for 409 duplicate email / password rejection.
      showErrorToast(
        getUserCreationErrorMessage({
          error: error as AxiosError,
          entity: t('label.user'),
          entityLowercase: t('label.user-lowercase'),
          entityName: userPayload.name,
        })
      );
    } finally {
      setIsSaveLoading(false);
    }
  };

  // Teams / roles / personas are the same multi-select wired to a string[] field;
  // one renderer keeps them in sync. `filter` enables client-side contains filtering
  // (teams/personas, which load their full list); roles fetch server-side instead.
  const renderMultiSelect = (
    name: 'teams' | 'roles' | 'personas',
    label: string,
    testId: string,
    items: SelectItemType[],
    opts?: { filter?: boolean; onSearchChange?: (value: string) => void }
  ) => (
    <FormField control={form.control} name={name}>
      {({ field }) => (
        <Box direction="col" gap={1}>
          <FormItemLabel label={label} />
          <Autocomplete
            data-testid={testId}
            filterOption={
              opts?.filter
                ? (item, filterText) => contains(item.label || '', filterText)
                : undefined
            }
            items={items}
            placeholder={t('label.please-select-entity', { entity: label })}
            selectedItems={selectedItems(field.value as string[], items)}
            onItemCleared={(key) =>
              field.onChange(
                (field.value as string[]).filter((id) => id !== String(key))
              )
            }
            onItemInserted={(key) =>
              field.onChange([...(field.value as string[]), String(key)])
            }
            onSearchChange={opts?.onSearchChange}>
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

  return (
    <Box className="tw:h-full tw:min-h-0" direction="col" justify="between">
      <HookForm
        className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col"
        form={form}>
        <div className="tw:overflow-y-auto">
          <Box
            className="tw:flex-1 tw:p-6 tw:pt-0 tw:max-w-[50%] tw:w-full"
            data-testid="create-user-container"
            direction="col"
            gap={5}>
            <FormFields fields={nameFields} />

            <Box direction="col" gap={1}>
              <Typography
                className="tw:text-secondary"
                size="text-sm"
                weight="medium">
                {t('label.description')}
              </Typography>
              <RichTextEditor
                className="new-form-style"
                data-testid="description"
                placeHolder={t('message.write-your-description')}
                ref={descEditorRef}
              />
            </Box>

            {isAuthProviderBasic && (
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
                        label={t('label.password-type', {
                          type: t('label.create'),
                        })}
                        value={CreatePasswordGenerator.CreatePassword}
                      />
                    </RadioGroup>

                    {passwordGenerator ===
                    CreatePasswordGenerator.CreatePassword ? (
                      <FormFields fields={passwordFields} />
                    ) : (
                      <Box direction="col" gap={1}>
                        <FormItemLabel
                          label={t('label.password-type', {
                            type: t('label.generate'),
                          })}
                        />
                        <Input
                          isReadOnly
                          data-testid="generated-password"
                          trailingSlot={
                            <Box
                              align="stretch"
                              className="tw:self-stretch tw:border-l tw:border-primary"
                              direction="row">
                              <ButtonUtility
                                className="tw:h-full tw:rounded-none tw:hover:bg-transparent"
                                color="tertiary"
                                data-testid="toggle-password-visibility"
                                icon={showGeneratedPassword ? EyeOff : Eye}
                                size="sm"
                                tooltip={String(
                                  showGeneratedPassword
                                    ? t('label.hide')
                                    : t('label.show')
                                )}
                                onClick={() =>
                                  setShowGeneratedPassword((prev) => !prev)
                                }
                              />
                              <ButtonUtility
                                className="tw:h-full tw:rounded-none tw:border-l tw:border-primary tw:hover:bg-transparent"
                                color="tertiary"
                                data-testid="password-generator"
                                icon={RefreshCw01}
                                isDisabled={isPasswordGenerating}
                                size="sm"
                                tooltip={String(t('label.regenerate'))}
                                onClick={generateRandomPassword}
                              />
                              <ButtonUtility
                                className="tw:h-full tw:rounded-none tw:border-l tw:border-primary tw:hover:bg-transparent"
                                color="tertiary"
                                data-testid="copy-password"
                                icon={Copy01}
                                size="sm"
                                tooltip={String(t('label.copy'))}
                                onClick={handleCopyPassword}
                              />
                            </Box>
                          }
                          type={showGeneratedPassword ? 'text' : 'password'}
                          value={generatedPassword}
                        />
                      </Box>
                    )}
                  </Box>
                )}
              </FormField>
            )}

            <Toggle
              data-testid="admin"
              isSelected={isAdminUser}
              label={t('label.admin')}
              onChange={setIsAdminUser}
            />

            <Box direction="col" gap={1}>
              <FormItemLabel label={t('label.domain-plural')} />
              <DomainSelect
                multiple
                data-testid="domain-select"
                selectedDomain={selectedDomains}
                onUpdate={(domains) => {
                  if (Array.isArray(domains)) {
                    setSelectedDomains(domains);

                    return;
                  }
                  setSelectedDomains(domains ? [domains] : []);
                }}
              />
            </Box>

            {!isAdmin && (
              <>
                {renderMultiSelect(
                  'teams',
                  t('label.team-plural'),
                  'teams-dropdown',
                  teamItems,
                  { filter: true }
                )}
                {renderMultiSelect(
                  'roles',
                  t('label.role-plural'),
                  'roles-dropdown',
                  roleItems,
                  { onSearchChange: debouncedFetchRoleOptions }
                )}
                {renderMultiSelect(
                  'personas',
                  t('label.persona-plural'),
                  'personas-dropdown',
                  personaItems,
                  { filter: true }
                )}
              </>
            )}
          </Box>
        </div>
      </HookForm>

      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary tw:px-6 tw:py-4"
        data-testid="create-user-footer"
        direction="row"
        gap={3}
        justify="end">
        <Button
          color="tertiary"
          data-testid="cancel-user"
          onPress={() => onNavigate({ type: isAdmin ? 'admins' : 'users' })}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="save-user"
          isLoading={isSaveLoading}
          onPress={() => handleSubmit(onSubmit)()}>
          {t('label.create')}
        </Button>
      </Box>
    </Box>
  );
};

export default MembersCreateUserForm;
