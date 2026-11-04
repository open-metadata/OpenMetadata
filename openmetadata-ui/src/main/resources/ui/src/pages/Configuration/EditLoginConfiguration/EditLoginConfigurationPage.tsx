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
  FieldProp,
  FieldTypes,
  FormFields,
  HookForm,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
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

type LoginConfigField = keyof Pick<
  LoginConfiguration,
  'maxLoginFailAttempts' | 'accessBlockTime' | 'jwtTokenExpiryTime'
>;

// Number inputs hold strings; the configuration stores numbers.
type LoginConfigFormValues = Record<LoginConfigField, string>;

const LOGIN_CONFIG_FIELDS: LoginConfigField[] = [
  'maxLoginFailAttempts',
  'accessBlockTime',
  'jwtTokenExpiryTime',
];

const EditLoginConfiguration = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const form = useForm<LoginConfigFormValues>();
  const [activeField, setActiveField] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);

  const fetchCustomLogoConfig = async () => {
    try {
      setLoading(true);

      const data = await getLoginConfig();

      form.reset(
        Object.fromEntries(
          LOGIN_CONFIG_FIELDS.map((key) => [key, String(data?.[key] ?? '')])
        ) as LoginConfigFormValues
      );
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

  const minZeroRule = (label: string) => ({
    validate: (value: string) =>
      isEmpty(value) ||
      Number(value) >= 0 ||
      t('message.entity-size-less-than', { entity: label, min: 0 }),
  });

  const formFields: FieldProp[] = [
    {
      name: 'maxLoginFailAttempts',
      label: t('label.max-login-fail-attempt-plural'),
      type: FieldTypes.NUMBER,
      id: 'root/maxLoginFailAttempts',
      props: { inputDataTestId: 'maxLoginFailAttempts' },
      rules: minZeroRule(t('label.max-login-fail-attempt-plural')),
    },
    {
      name: 'accessBlockTime',
      label: t('label.access-block-time'),
      type: FieldTypes.NUMBER,
      id: 'root/accessBlockTime',
      props: { inputDataTestId: 'accessBlockTime' },
      rules: minZeroRule(t('label.access-block-time')),
    },
    {
      name: 'jwtTokenExpiryTime',
      label: t('label.jwt-token-expiry-time'),
      type: FieldTypes.NUMBER,
      id: 'root/jwtTokenExpiryTime',
      props: { inputDataTestId: 'jwtTokenExpiryTime' },
      rules: minZeroRule(t('label.jwt-token-expiry-time')),
    },
  ];

  const handleGoBack = () => navigate(-1);

  const handleSubmit = async (formValues: LoginConfigFormValues) => {
    const configValues = Object.fromEntries(
      LOGIN_CONFIG_FIELDS.map((key) => [
        key,
        isEmpty(formValues[key]) ? undefined : Number(formValues[key]),
      ])
    ) as LoginConfiguration;
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

  useEffect(() => {
    fetchCustomLogoConfig();
  }, []);

  const firstPanelChildren = (
    <>
      <TitleBreadcrumb titleLinks={breadcrumb} />
      {/* Tracks the focused field for the doc panel; focus events bubble. */}
      <div
        role="presentation"
        onFocus={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setActiveField(e.target.id);
        }}>
        <HookForm
          className="tw:mt-4 tw:flex tw:flex-col tw:gap-4"
          data-testid="custom-login-config-form"
          form={form}
          onSubmit={form.handleSubmit(handleSubmit)}>
          <FormFields fields={formFields} />
          <Box className="layout-row" gap={3} justify="end" wrap="wrap">
            <Box className="layout-column tw:block">
              <Button
                color="secondary"
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
      </div>
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
