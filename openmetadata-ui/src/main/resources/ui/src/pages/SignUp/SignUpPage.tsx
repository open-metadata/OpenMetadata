/*
 *  Copyright 2023 Collate.
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
  FieldProp,
  FieldTypes,
  FormField,
  FormFields,
  FormItemLabel,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { CookieStorage } from 'cookie-storage';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../../components/Auth/AuthProviders/AuthProvider.interface';
import DocumentTitle from '../../components/common/DocumentTitle/DocumentTitle';
import TeamsSelectable from '../../components/Settings/Team/TeamsSelectable/TeamsSelectable';
import { ROUTES } from '../../constants/constants';
import { REDIRECT_PATHNAME } from '../../constants/router.constants';
import { ClientType } from '../../generated/configuration/authenticationConfiguration';
import { EntityReference } from '../../generated/entity/type';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { createUser } from '../../rest/userAPI';
import {
  getNameFromUserData,
  setUrlPathnameExpiryAfterRoute,
} from '../../utils/AuthProvider.util';
import brandClassBase from '../../utils/BrandData/BrandClassBase';
import { Transi18next } from '../../utils/i18next/LocalUtil';
import { showErrorToast } from '../../utils/ToastUtils';
import { getImages } from '../../utils/UserDataUtils';

const cookieStorage = new CookieStorage();

interface SignUpFormValues {
  displayName: string;
  name: string;
  email: string;
  teams: EntityReference[];
  picture?: string;
}

const SignUp = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    setIsSigningUp,
    jwtPrincipalClaims = [],
    jwtPrincipalClaimsMapping = [],
    authorizerConfig,
    updateCurrentUser,
    newUser,
    authConfig,
  } = useApplicationStore();

  const [loading, setLoading] = useState<boolean>(false);
  const OMDLogo = brandClassBase.getMonogram().svg;

  const clientType = authConfig?.clientType ?? ClientType.Public;

  const initialValues = useMemo<SignUpFormValues>(
    () => ({
      teams: [],
      displayName: newUser?.name ?? '',
      name: newUser?.name ?? '',
      email: newUser?.email ?? '',
      ...(clientType === ClientType.Public
        ? getNameFromUserData(
            newUser as UserProfile,
            jwtPrincipalClaims,
            authorizerConfig?.principalDomain,
            jwtPrincipalClaimsMapping
          )
        : {}),
    }),
    [
      clientType,
      authorizerConfig?.principalDomain,
      jwtPrincipalClaims,
      jwtPrincipalClaimsMapping,
      newUser,
    ]
  );

  const form = useForm<SignUpFormValues>({
    defaultValues: initialValues,
  });

  const handleCreateNewUser = async (data: SignUpFormValues) => {
    setLoading(true);

    try {
      const res = await createUser({
        ...data,
        teams: (data.teams as EntityReference[])?.map((t) => t.id),
        profile: {
          images: getImages(data.picture ?? ''),
        },
      });
      updateCurrentUser(res);
      const urlPathname = cookieStorage.getItem(REDIRECT_PATHNAME);
      if (urlPathname) {
        setUrlPathnameExpiryAfterRoute(urlPathname);
      }
      setIsSigningUp(false);
      navigate(ROUTES.HOME);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', { entity: t('label.user') })
      );
    } finally {
      setLoading(false);
    }
  };

  const displayNameField: FieldProp = {
    name: 'displayName',
    type: FieldTypes.TEXT,
    label: t('label.full-name'),
    id: 'root/displayName',
    placeholder: t('label.your-entity', { entity: t('label.full-name') }),
    required: true,
    rules: {
      required: t('message.field-text-is-required', {
        fieldText: t('label.full-name'),
      }),
    },
    props: { 'data-testid': 'full-name-input', size: 'md' },
  };

  const emailField: FieldProp = {
    name: 'email',
    type: FieldTypes.TEXT,
    label: t('label.email'),
    id: 'root/email',
    placeholder: t('label.your-entity', {
      entity: `${t('label.email')} ${t('label.address')}`,
    }),
    required: true,
    rules: {
      required: t('message.field-text-is-required', {
        fieldText: t('label.email'),
      }),
    },
    props: { 'data-testid': 'email-input', isDisabled: true, size: 'md' },
  };

  return (
    <div
      className="tw:flex tw:min-h-screen tw:w-full tw:items-center tw:justify-center tw:bg-primary"
      data-testid="signup-page-container">
      <DocumentTitle title={t('label.sign-up')} />
      <Card
        className="tw:w-full tw:max-w-[500px] tw:shadow-xl"
        variant="elevated">
        <Card.Content className="tw:p-8">
          <div className="tw:mb-8 tw:flex tw:flex-col tw:items-center tw:gap-4">
            <OMDLogo
              data-testid="om-logo"
              height={50}
              name={t('label.brand-name-logo')}
              width={50}
            />
            <Typography
              as="h1"
              className="tw:text-center"
              data-testid="om-heading"
              size="display-xs"
              weight="semibold">
              <Transi18next
                i18nKey="label.join-entity"
                renderElement={<span className="tw:text-brand-secondary" />}
                values={{ entity: t('label.brand-name') }}
              />
            </Typography>
          </div>

          <HookForm
            className="tw:flex tw:flex-col tw:gap-4"
            data-testid="create-user-form"
            form={form}
            onSubmit={form.handleSubmit(handleCreateNewUser)}>
            <FormFields fields={[displayNameField, emailField]} />
            <input
              data-testid="username-input"
              type="hidden"
              {...form.register('name', { required: true })}
            />

            <FormField control={form.control} name="teams">
              {({ field }) => (
                <div
                  className="tw:flex tw:flex-col tw:gap-1.5"
                  data-testid="select-team-label">
                  <FormItemLabel
                    label={t('label.select-field', {
                      field: t('label.team-plural-lowercase'),
                    })}
                  />
                  <TeamsSelectable
                    filterJoinable
                    showTeamsAlert
                    onSelectionChange={field.onChange}
                  />
                </div>
              )}
            </FormField>

            <div className="tw:mt-4 tw:flex tw:justify-end">
              <Button
                showTextWhileLoading
                color="primary"
                data-testid="create-button"
                isDisabled={loading}
                isLoading={loading}
                size="md"
                type="submit">
                {t('label.create')}
              </Button>
            </div>
          </HookForm>
        </Card.Content>
      </Card>
    </div>
  );
};

export default SignUp;
