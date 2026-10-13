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
  Box,
  Button,
  FormField,
  HookForm,
  NumberInput,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../../components/common/Loader/Loader';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../../components/common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import {
  CUSTOM_LOGIN_CONFIG_SERVICE_CATEGORY,
  OPEN_METADATA,
} from '../../../constants/service-guide.constant';
import { ServiceCategory } from '../../../enums/service.enum';
import { LoginConfiguration } from '../../../generated/configuration/loginConfiguration';
import { Settings, SettingType } from '../../../generated/settings/settings';
import { withPageLayout } from '../../../hoc/withPageLayout';
import {
  getLoginConfig,
  updateSettingsConfig,
} from '../../../rest/settingConfigAPI';
import { getSettingPath } from '../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const EditLoginConfiguration = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const form = useForm<LoginConfiguration>({ mode: 'onChange' });
  const [activeField, setActiveField] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);

  const fetchCustomLogoConfig = async () => {
    try {
      setLoading(true);

      const data = await getLoginConfig();

      form.reset(data ?? {});
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.setting-plural'),
        url: getSettingPath(),
      },
      {
        name: t('label.login-configuration'),
        url: getSettingPath(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.LOGIN_CONFIGURATION
        ),
      },
      {
        name: t('label.edit-entity', {
          entity: t('label.login-configuration'),
        }),
        url: '',
      },
    ],
    []
  );

  const formFields = [
    {
      name: 'maxLoginFailAttempts' as const,
      label: t('label.max-login-fail-attempt-plural'),
    },
    { name: 'accessBlockTime' as const, label: t('label.access-block-time') },
    {
      name: 'jwtTokenExpiryTime' as const,
      label: t('label.jwt-token-expiry-time'),
    },
  ];

  const handleGoBack = () => navigate(-1);

  const handleSubmit = async (configValues: LoginConfiguration) => {
    try {
      setUpdating(true);
      const configData = {
        config_type: SettingType.LoginConfiguration,
        config_value: configValues,
      };
      await updateSettingsConfig(configData as Settings);
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.login-configuration'),
        })
      );
      handleGoBack();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setUpdating(false);
    }
  };

  const firstPanelChildren = (
    <>
      <TitleBreadcrumb titleLinks={breadcrumb} />
      <HookForm
        className="m-t-md tw:flex tw:flex-col tw:gap-4"
        data-testid="custom-login-config-form"
        form={form}
        onSubmit={form.handleSubmit(handleSubmit)}>
        {formFields.map(({ name, label }) => (
          <FormField
            control={form.control}
            key={name}
            name={name}
            rules={{
              min: {
                value: 0,
                message: t('message.entity-size-less-than', {
                  entity: label,
                  min: 0,
                }),
              },
            }}>
            {({ field, fieldState }) => (
              <NumberInput
                {...field}
                hint={fieldState.error?.message}
                id={'root/' + name}
                inputDataTestId={name}
                isInvalid={!!fieldState.error}
                label={label}
                minValue={0}
                onChange={(value) => field.onChange(value ?? undefined)}
                onFocus={() => setActiveField('root/' + name)}
              />
            )}
          </FormField>
        ))}
        <Box className="layout-row" justify="end" wrap="wrap">
          <Box className="layout-column tw:block">
            <Button
              color="link-color"
              data-testid="cancel-button"
              onClick={handleGoBack}>
              {t('label.cancel')}
            </Button>
          </Box>
          <Box className="layout-column tw:block">
            <Button
              color="primary"
              data-testid="save-button"
              isLoading={updating}
              type="submit">
              {t('label.save')}
            </Button>
          </Box>
        </Box>
      </HookForm>
    </>
  );

  const secondPanelChildren = (
    <ServiceDocPanel
      activeField={activeField}
      serviceName={CUSTOM_LOGIN_CONFIG_SERVICE_CATEGORY}
      serviceType={OPEN_METADATA as ServiceCategory}
    />
  );

  useEffect(() => {
    fetchCustomLogoConfig();
  }, []);

  if (loading) {
    return <Loader />;
  }

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        children: firstPanelChildren,
        minWidth: 700,
        flex: 0.7,
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
      }}
      pageTitle={t('label.edit-entity', {
        entity: t('label.login-configuration'),
      })}
      secondPanel={{
        children: secondPanelChildren,
        className: 'service-doc-panel content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default withPageLayout(EditLoginConfiguration);
