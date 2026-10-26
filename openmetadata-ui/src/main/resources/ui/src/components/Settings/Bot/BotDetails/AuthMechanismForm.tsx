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
  FormField,
  HookForm,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { FC, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ClientErrors } from '../../../../enums/Axios.enum';
import {
  PersonalAccessToken,
  TokenType,
} from '../../../../generated/auth/personalAccessToken';
import {
  AuthenticationMechanism,
  AuthType,
  JWTTokenExpiry,
} from '../../../../generated/entity/teams/user';
import { ScimConfiguration } from '../../../../generated/scim/scimConfiguration';
import { SettingType } from '../../../../generated/settings/settings';
import {
  patchSettingsConfig,
  updateSettingsConfig,
} from '../../../../rest/settingConfigAPI';
import { getJWTTokenExpiryOptions } from '../../../../utils/BotsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';

const DEFAULT_SCIM_CONFIGURATION: ScimConfiguration = {
  enabled: true,
  identityProvider: 'default',
};

/**
 * Patches only `enabled`, so the other SCIM fields an operator configured survive. A server whose
 * configuration file has no SCIM section stores nothing until the first write, and a patch needs a
 * stored value, so that case creates the setting instead.
 */
const enableScimProvisioning = async () => {
  try {
    await patchSettingsConfig(SettingType.ScimConfiguration, [
      { op: 'add', path: '/enabled', value: true },
    ]);
  } catch (error) {
    if ((error as AxiosError)?.response?.status !== ClientErrors.NOT_FOUND) {
      throw error;
    }
    await updateSettingsConfig({
      config_type: SettingType.ScimConfiguration,
      config_value: DEFAULT_SCIM_CONFIGURATION,
    });
  }
};

interface AuthFormValues {
  authType?: string;
  tokenExpiry: string;
}

interface Props {
  isUpdating: boolean;
  authenticationMechanism: AuthenticationMechanism | PersonalAccessToken;
  onSave: (updatedAuthMechanism: AuthenticationMechanism) => void;
  onCancel?: () => void;
  isBot: boolean;
  isSCIMBot?: boolean;
}

const AuthMechanismForm: FC<Props> = ({
  isUpdating,
  onSave,
  onCancel,
  authenticationMechanism,
  isBot,
  isSCIMBot,
}) => {
  const { t } = useTranslation();
  const handleSave = (values: AuthFormValues) => {
    const updatedAuthMechanism: AuthenticationMechanism = {
      authType: (values?.authType as AuthType) ?? AuthType.Jwt,
      config: {
        JWTTokenExpiry: values.tokenExpiry as JWTTokenExpiry,
      },
    };
    onSave(updatedAuthMechanism);
  };
  const authOptions = useMemo(() => {
    const botValue = {
      label: t('label.om-jwt-token'),
      value: 'JWT',
    };
    const accessTokenValue = {
      label: 'Personal Access Token',
      value: TokenType.PersonalAccessToken,
    };

    return isBot ? botValue : accessTokenValue;
  }, [isBot, t]);

  const { authType, tokenExpiry } = useMemo(() => {
    if (isBot) {
      const botData = authenticationMechanism as AuthenticationMechanism;

      return {
        authType: botData?.authType,
        tokenExpiry: JWTTokenExpiry.OneHour,
      };
    }

    const personalAccessData = authenticationMechanism as PersonalAccessToken;

    return {
      authType: personalAccessData?.tokenType ?? TokenType.PersonalAccessToken,
      tokenExpiry: JWTTokenExpiry.OneHour,
    };
  }, [isBot, authenticationMechanism]);

  const form = useForm<AuthFormValues>({
    values: { authType, tokenExpiry },
  });

  const handleGenerateSCIMToken = useCallback(async () => {
    if (isSCIMBot) {
      try {
        await enableScimProvisioning();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }

    onSave({
      authType: AuthType.Jwt,
      config: {
        // For SCIM we only want token with Unlimited expiry
        JWTTokenExpiry: JWTTokenExpiry.Unlimited,
      },
    });
  }, [onSave, isSCIMBot]);

  return isSCIMBot ? (
    <div className="flex  justify-between items-center">
      <div className="flex flex-col gap-2">
        <Typography className="card-title m-t-0 m-b-2 text-md">
          {t('message.automate-provisioning-with-scim')}
        </Typography>
        <Typography as="p" className="m-b-0 card-description">
          {t(
            'message.scim-allows-automatic-user-and-group-management-directly-from-your-sso-provider'
          )}
        </Typography>
      </div>
      <Button
        color="primary"
        data-testid="generate-scim-token"
        size="xs"
        onClick={handleGenerateSCIMToken}>
        {t('label.generate-token')}
      </Button>
    </div>
  ) : (
    <HookForm
      className="tw:flex tw:flex-col tw:gap-4"
      form={form}
      id="update-auth-mechanism-form"
      onSubmit={form.handleSubmit(handleSave)}>
      <Select
        isDisabled
        className="tw:w-full"
        data-testid="auth-mechanism"
        items={[{ id: authOptions.value, label: authOptions.label }]}
        label={t('label.auth-mechanism')}
        placeholder={t('label.select-field', {
          field: t('label.auth-mechanism'),
        })}
        selectedKey={authOptions.value}>
        {(item) => <Select.Item id={item.id} label={item.label} />}
      </Select>
      <FormField
        control={form.control}
        name="tokenExpiry"
        rules={{
          required: t('message.field-text-is-required', {
            fieldText: t('label.token-expiration'),
          }),
        }}>
        {({ field, fieldState }) => (
          <Select
            isRequired
            className="tw:w-full"
            data-testid="token-expiry"
            hint={fieldState.error?.message}
            isInvalid={fieldState.invalid}
            items={getJWTTokenExpiryOptions(!isBot)}
            label={t('label.token-expiration')}
            placeholder={t('message.select-token-expiration')}
            selectedKey={field.value ?? null}
            onSelectionChange={(key) => key !== null && field.onChange(key)}>
            {(item) => <Select.Item id={item.id} label={item.label} />}
          </Select>
        )}
      </FormField>
      <Box
        inline
        align="center"
        className="layout-space layout-space-horizontal w-full justify-end"
        gap={3}
        itemClassName="layout-space-item">
        {!isEmpty(authenticationMechanism) && (
          <Button
            color="secondary"
            data-testid="cancel-edit"
            onClick={onCancel}>
            {t('label.cancel')}
          </Button>
        )}
        <Button
          color="primary"
          data-testid="save-edit"
          form="update-auth-mechanism-form"
          isLoading={isUpdating}
          type="submit">
          {t('label.generate')}
        </Button>
      </Box>
    </HookForm>
  );
};

export default AuthMechanismForm;
