/*
 *  Copyright 2025 Collate.
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
  Input,
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
import SettingsSourceBanner from '../../../components/platform/settings/SettingsSourceBanner/SettingsSourceBanner';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import {
  OPENMETADATA_URL_CONFIG_SERVICE_CATEGORY,
  OPEN_METADATA,
} from '../../../constants/service-guide.constant';
import { ServiceCategory } from '../../../enums/service.enum';
import { OpenMetadataBaseURLConfiguration } from '../../../generated/configuration/openMetadataBaseUrlConfiguration';
import { Settings, SettingType } from '../../../generated/settings/settings';
import { withPageLayout } from '../../../hoc/withPageLayout';
import { useSettingsSource } from '../../../hooks/platform/useSettingsSource';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../../rest/settingConfigAPI';
import { getHyperlinkUrlValidationErrorKey } from '../../../utils/CustomProperty.utils';
import {
  findSettingSource,
  isPathManaged,
} from '../../../utils/platform/settingsSource.utils';
import { getSettingPath } from '../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const URL_SETTING_TYPES = [SettingType.OpenMetadataBaseURLConfiguration];
const EditUrlConfigurationPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const form = useForm<OpenMetadataBaseURLConfiguration>({
    defaultValues: { openMetadataUrl: '' },
  });
  const [activeField, setActiveField] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);
  const { sources, refetch: refetchSources } =
    useSettingsSource(URL_SETTING_TYPES);
  const isManagedByDeployment = isPathManaged(
    findSettingSource(sources, SettingType.OpenMetadataBaseURLConfiguration),
    '/openMetadataUrl'
  );

  const fetchCustomLogoConfig = async () => {
    try {
      setLoading(true);

      const { data } = await getSettingsConfigFromConfigType(
        SettingType.OpenMetadataBaseURLConfiguration
      );

      form.reset({ ...(data.config_value ?? {}) });
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
        name: t('label.entity-configuration', {
          entity: t('label.brand-name-url'),
        }),
        url: getSettingPath(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.OM_URL_CONFIG
        ),
      },
      {
        name: t('label.edit-entity', {
          entity: t('label.entity-configuration', {
            entity: t('label.brand-name-url'),
          }),
        }),
        url: '',
      },
    ],
    []
  );

  const handleGoBack = () => navigate(-1);

  const handleSubmit = async (
    configValues: OpenMetadataBaseURLConfiguration
  ) => {
    try {
      setUpdating(true);
      const configData = {
        config_type: SettingType.OpenMetadataBaseURLConfiguration,
        config_value: configValues,
      };
      await updateSettingsConfig(configData as Settings);
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.entity-configuration', {
            entity: t('label.brand-name-url'),
          }),
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
      <SettingsSourceBanner
        className="tw:mt-4"
        sources={sources}
        onAdopted={fetchCustomLogoConfig}
        onRefetch={refetchSources}
      />
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
          <FormField
            control={form.control}
            name="openMetadataUrl"
            rules={{
              required: t('message.field-text-is-required', {
                fieldText: t('label.brand-name-url'),
              }),
              validate: (value) => {
                const errorKey = getHyperlinkUrlValidationErrorKey(
                  typeof value === 'string' ? value : undefined
                );

                return errorKey ? t(errorKey) : true;
              },
            }}>
            {({ field, fieldState }) => (
              <Input
                isRequired
                hint={fieldState.error?.message}
                id="root/openMetadataUrl-input"
                inputDataTestId="open-metadata-url-input"
                isDisabled={isManagedByDeployment}
                isInvalid={fieldState.invalid}
                label={t('label.brand-name-url')}
                value={field.value ?? ''}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
            )}
          </FormField>
          <Box className="layout-row" gap={3} justify="end" wrap="wrap">
            <Box className="layout-column tw:block">
              <Button
                color="secondary"
                data-testid="cancel-button"
                onClick={handleGoBack}>
                {t('label.cancel')}
              </Button>
            </Box>
            {!isManagedByDeployment && (
              <Box className="layout-column tw:block">
                <Button
                  color="primary"
                  data-testid="save-button"
                  isLoading={updating}
                  type="submit">
                  {t('label.save')}
                </Button>
              </Box>
            )}
          </Box>
        </HookForm>
      </div>
    </>
  );

  const secondPanelChildren = (
    <ServiceDocPanel
      activeField={activeField}
      serviceName={OPENMETADATA_URL_CONFIG_SERVICE_CATEGORY}
      serviceType={OPEN_METADATA as ServiceCategory}
    />
  );

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
        entity: t('label.entity-configuration', {
          entity: t('label.brand-name-url'),
        }),
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

export default withPageLayout(EditUrlConfigurationPage);
