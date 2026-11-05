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
  Card,
  FormField,
  FormItemLabel,
  Grid,
  HintText,
  HookForm,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { startCase, toString } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as DomainIcon } from '../../assets/svg/ic-domain.svg';
import { ReactComponent as ShareIcon } from '../../assets/svg/ic-share.svg';
import BrandImage from '../../components/common/BrandImage/BrandImage';
import ColorPicker from '../../components/common/ColorPicker/ColorPicker.component';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { HEX_COLOR_CODE_REGEX } from '../../constants/regex.constants';
import { LogoConfiguration } from '../../generated/configuration/logoConfiguration';
import { UIThemePreference } from '../../generated/configuration/uiThemePreference';
import { Settings, SettingType } from '../../generated/settings/settings';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { updateSettingsConfig } from '../../rest/settingConfigAPI';
import { generatePalette } from '../../styles/colorPallet';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { isValidUrl } from '../../utils/SSOUtils';
import { getThemeConfig } from '../../utils/ThemeUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './appearance-config-settings-page.less';

const orEmpty = (value?: string): string => value ?? '';

type AppearanceFormValues = Partial<
  LogoConfiguration & UIThemePreference['customTheme']
>;
type ThemeColorName = keyof UIThemePreference['customTheme'];

const toFormValues = (
  config?: Partial<UIThemePreference>
): AppearanceFormValues => ({
  ...config?.customLogoConfig,
  ...config?.customTheme,
});

const AppearanceConfigSettingsPage = () => {
  const navigate = useNavigate();
  const { applicationConfig, setApplicationConfig } = useApplicationStore();
  const { t } = useTranslation();
  const form = useForm<AppearanceFormValues>({
    mode: 'onChange',
    defaultValues: toFormValues(applicationConfig),
  });
  const formState = form.watch();
  const [loading, setLoading] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.theme')
      ),
    []
  );

  const handleSave = async (values: AppearanceFormValues) => {
    setLoading(true);
    try {
      const configValues = {
        customLogoConfig: {
          customLogoUrlPath: orEmpty(values?.customLogoUrlPath),
          customMonogramUrlPath: orEmpty(values?.customMonogramUrlPath),
          customFaviconUrlPath: orEmpty(values?.customFaviconUrlPath),
        },
        customTheme: {
          primaryColor: orEmpty(values?.primaryColor),
          hoverColor: orEmpty(values?.hoverColor),
          selectedColor: orEmpty(values?.selectedColor),
          errorColor: orEmpty(values?.errorColor),
          successColor: orEmpty(values?.successColor),
          warningColor: orEmpty(values?.warningColor),
          infoColor: orEmpty(values?.infoColor),
          panelBackgroundColor: orEmpty(values?.panelBackgroundColor),
        },
      };

      const configData = {
        config_type: SettingType.CustomUIThemePreference,
        config_value: configValues,
      };
      await updateSettingsConfig(configData as Settings);
      setApplicationConfig(configValues);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const configValues = {
        customLogoConfig: {
          customLogoUrlPath: '',
          customMonogramUrlPath: '',
          customFaviconUrlPath: '',
        },
        customTheme: {
          primaryColor: '',
          hoverColor: '',
          selectedColor: '',
          errorColor: '',
          successColor: '',
          warningColor: '',
          infoColor: '',
          panelBackgroundColor: '',
        },
      };
      const configData = {
        config_type: SettingType.CustomUIThemePreference,
        config_value: configValues,
      };
      await updateSettingsConfig(configData as Settings);
      setApplicationConfig({
        ...configValues,
        customTheme: getThemeConfig(configValues.customTheme),
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setResetting(false);
    }
  };

  const themeFormFields: Array<{ name: ThemeColorName; label: string }> = [
    { name: 'primaryColor', label: 'Primary Color' },
    { name: 'selectedColor', label: 'Selected Color' },
    { name: 'hoverColor', label: 'Hover Color' },
    { name: 'panelBackgroundColor', label: t('label.panel-background-color') },
    { name: 'errorColor', label: 'Error Color' },
    { name: 'successColor', label: 'Success Color' },
    { name: 'warningColor', label: 'Warning Color' },
    { name: 'infoColor', label: 'Info Color' },
  ];

  const customLogoFormFields: Array<{
    name: keyof LogoConfiguration;
    label: string;
    placeholder: string;
  }> = [
    {
      name: 'customLogoUrlPath',
      label: t('label.logo-url'),
      placeholder: 'URL path for the login page logo',
    },
    {
      name: 'customMonogramUrlPath',
      label: t('label.monogram-url'),
      placeholder: 'URL path for the navbar logo',
    },
    {
      name: 'customFaviconUrlPath',
      label: t('label.favicon-url'),
      placeholder: 'URL path for the favicon',
    },
  ];

  // A new primary colour regenerates the hover and selected shades from its palette.
  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      if (name === 'primaryColor' && values.primaryColor) {
        const palette = generatePalette(values.primaryColor);
        form.setValue('hoverColor', palette[2]);
        form.setValue('selectedColor', palette[8]);
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    form.reset(toFormValues(applicationConfig));
  }, [applicationConfig, form]);

  return (
    <PageLayoutV1 pageTitle={t('label.theme')}>
      <Grid
        className="layout-row layout-grid tw:items-center"
        style={{ ...getLayoutGutter(0, 16) }}>
        <Grid.Item className="layout-column" span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Grid.Item>
        <Grid.Item className="layout-column" span={24}>
          <Box
            align="center"
            className="layout-row"
            justify="between"
            wrap="wrap">
            <Box
              className="layout-column tw:block"
              style={{ maxWidth: '100%', flex: '0 0 100%' }}>
              <Box
                inline
                align="center"
                className="layout-space layout-space-horizontal w-full justify-between"
                gap={2}
                itemClassName="layout-space-item">
                <PageHeader
                  data={{
                    header: t('label.theme'),
                    subHeader: t('message.appearance-configuration-message'),
                  }}
                />
                <Button
                  color="primary"
                  data-testid="reset-button"
                  isLoading={resetting}
                  onClick={handleReset}>
                  {t('label.reset')}
                </Button>
              </Box>
            </Box>
          </Box>
        </Grid.Item>
        <Grid.Item className="layout-column" span={24}>
          <HookForm form={form} onSubmit={form.handleSubmit(handleSave)}>
            <div className="white-label-card-wrapper m-b-md">
              <Card className="white-label-config-card">
                <Card.Header title={t('label.custom-logo')} />
                <Card.Content>
                  <Grid
                    className="layout-row layout-grid w-full"
                    style={{ ...getLayoutGutter(16, 16) }}>
                    {customLogoFormFields.map((field) => {
                      return (
                        <Grid.Item
                          className="layout-column w-full"
                          key={field.name}
                          span={24}>
                          <Box
                            className="layout-row"
                            style={{ ...getLayoutGutter(48, 16) }}
                            wrap="wrap">
                            <Box
                              className="layout-column tw:block"
                              style={{ maxWidth: '50%', flex: '0 0 50%' }}>
                              <FormField
                                control={form.control}
                                name={field.name}
                                rules={{
                                  validate: (value) =>
                                    !value ||
                                    isValidUrl(value) ||
                                    t('message.entity-is-not-valid-url', {
                                      entity: field.label,
                                    }),
                                }}>
                                {({ field: control, fieldState }) => (
                                  <Input
                                    hint={fieldState.error?.message}
                                    id={`root/${field.name}`}
                                    inputDataTestId={field.name}
                                    isInvalid={fieldState.invalid}
                                    label={field.label}
                                    placeholder={field.placeholder}
                                    value={control.value ?? ''}
                                    onBlur={control.onBlur}
                                    onChange={control.onChange}
                                  />
                                )}
                              </FormField>
                            </Box>
                            <Box className="layout-column tw:block">
                              <BrandImage
                                className="preview-image"
                                height={70}
                                isMonoGram={field.name !== 'customLogoUrlPath'}
                                src={formState[field.name]}
                                width={
                                  field.name !== 'customLogoUrlPath' ? 75 : 120
                                }
                              />
                            </Box>
                          </Box>
                        </Grid.Item>
                      );
                    })}
                  </Grid>
                </Card.Content>
              </Card>
              <Card className="white-label-config-card">
                <Card.Header
                  title={<Typography>{t('label.custom-theme')}</Typography>}
                />
                <Card.Content>
                  <Grid
                    className="layout-row layout-grid w-full"
                    style={{ ...getLayoutGutter(16, 16) }}>
                    {themeFormFields.map((field) => {
                      const currentColor = formState[field.name];

                      return (
                        <Grid.Item
                          className="layout-column w-full"
                          key={field.name}
                          span={24}>
                          <Box
                            className="layout-row"
                            style={{ ...getLayoutGutter(48, 16) }}
                            wrap="wrap">
                            <Box
                              className="layout-column tw:block"
                              style={{ maxWidth: '50%', flex: '0 0 50%' }}>
                              <FormField
                                control={form.control}
                                name={field.name}
                                rules={{
                                  pattern: {
                                    value: HEX_COLOR_CODE_REGEX,
                                    message: t('message.hex-color-validation'),
                                  },
                                }}>
                                {({ field: control, fieldState }) => (
                                  <Box direction="col" gap={1}>
                                    <FormItemLabel label={field.label} />
                                    <ColorPicker
                                      id={field.name}
                                      label={field.label}
                                      value={control.value ?? ''}
                                      onBlur={control.onBlur}
                                      onChange={control.onChange}
                                    />
                                    {fieldState.error && (
                                      <HintText isInvalid>
                                        {fieldState.error.message}
                                      </HintText>
                                    )}
                                  </Box>
                                )}
                              </FormField>
                            </Box>
                            <Box
                              className="layout-column tw:block"
                              style={{ placeSelf: 'center' }}>
                              <Card className="theme-preview">
                                <Card.Content className="tw:flex tw:flex-row tw:gap-4">
                                  {/* Colour swatches, not buttons: they preview an arbitrary
                                      brand colour that core Button colours can't express. */}
                                  <span
                                    className="tw:inline-flex tw:h-9 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:px-3 tw:text-sm tw:font-semibold"
                                    style={{
                                      background: currentColor,
                                      borderColor: currentColor,
                                      color: 'white',
                                    }}>
                                    {startCase(
                                      toString(field.name).replace('Color', '')
                                    )}
                                  </span>
                                  <span
                                    className="tw:inline-flex tw:h-9 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:px-3 tw:text-sm tw:font-semibold"
                                    style={{
                                      borderColor: currentColor,
                                      color: currentColor,
                                    }}>
                                    <ShareIcon className="tw:size-3.5 tw:shrink-0" />
                                  </span>
                                  <span
                                    className="tw:inline-flex tw:h-9 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:px-3 tw:text-sm tw:font-semibold"
                                    style={{
                                      borderColor: currentColor,
                                      color: currentColor,
                                    }}>
                                    {startCase(
                                      toString(field.name).replace('Color', '')
                                    )}
                                  </span>
                                  <DomainIcon
                                    style={{
                                      color: currentColor,
                                    }}
                                    width={32}
                                  />
                                  <span
                                    className="tw:inline-flex tw:items-center tw:text-sm tw:font-semibold"
                                    style={{ color: currentColor }}>
                                    {t('label.link')}
                                  </span>
                                </Card.Content>
                              </Card>
                            </Box>
                          </Box>
                        </Grid.Item>
                      );
                    })}
                  </Grid>
                </Card.Content>
              </Card>
            </div>

            <Box
              inline
              align="center"
              className="layout-space layout-space-horizontal w-full justify-end appearance-cta-buttons"
              data-testid="cta-buttons"
              gap={4}
              itemClassName="layout-space-item">
              <Button
                color="secondary"
                data-testid="cancel-btn"
                onClick={() => navigate(-1)}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="save-btn"
                isLoading={loading}
                type="submit">
                {t('label.save')}
              </Button>
            </Box>
          </HookForm>
        </Grid.Item>
      </Grid>
    </PageLayoutV1>
  );
};

export default AppearanceConfigSettingsPage;
