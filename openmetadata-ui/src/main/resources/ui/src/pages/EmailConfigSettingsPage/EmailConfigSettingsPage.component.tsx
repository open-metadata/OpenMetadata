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

import Icon from '@ant-design/icons/lib/components/Icon';
import {
  Box,
  Grid,
  SkeletonParagraph,
  Typography,
} from '@openmetadata/ui-core-components';
import { Button } from 'antd';
import { AxiosError } from 'axios';
import { isBoolean, isEmpty, isNumber, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../assets/svg/edit-new.svg';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import ButtonSkeleton from '../../components/common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import SettingsSourceBanner from '../../components/platform/settings/SettingsSourceBanner/SettingsSourceBanner';
import TestEmail from '../../components/Settings/Email/TestEmail/TestEmail.component';
import { ROUTES } from '../../constants/constants';
import {
  EMAIL_CONFIG_FORM_FIELDS,
  NOT_INCLUDE_EMAIL_CONFIG_VALUE,
} from '../../constants/EmailConfig.constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { SMTPSettings } from '../../generated/email/smtpSettings';
import { SettingType } from '../../generated/settings/settings';
import { useAuth } from '../../hooks/authHooks';
import { useSettingsSource } from '../../hooks/platform/useSettingsSource';
import { getSettingsConfigFromConfigType } from '../../rest/settingConfigAPI';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import { getEmailConfigFieldLabels } from '../../utils/EmailConfigUtils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import {
  areAllPathsManaged,
  findSettingSource,
  toJsonPointer,
} from '../../utils/platform/settingsSource.utils';
import { showErrorToast } from '../../utils/ToastUtils';

const EMAIL_SETTING_TYPES = [SettingType.EmailConfiguration];
const EMAIL_FORM_POINTERS = EMAIL_CONFIG_FORM_FIELDS.map((field) =>
  toJsonPointer(field)
);

function EmailConfigSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdminUser } = useAuth();
  const [emailConfigValues, setEmailConfigValues] = useState<SMTPSettings>();
  const [loading, setLoading] = useState<boolean>(false);
  const [isTeamEmailOpen, setIsTestEmailOpen] = useState<boolean>(false);
  const {
    sources,
    isLoading: isSourceLoading,
    refetch: refetchSources,
  } = useSettingsSource(EMAIL_SETTING_TYPES);
  // Editing is pointless when the deployment owns every field the form shows.
  const isManagedByDeployment = areAllPathsManaged(
    findSettingSource(sources, SettingType.EmailConfiguration),
    EMAIL_FORM_POINTERS
  );

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.email')
      ),
    []
  );

  const fetchEmailConfigValues = useCallback(async () => {
    try {
      setLoading(true);

      const { data } = await getSettingsConfigFromConfigType(
        SettingType.EmailConfiguration
      );

      setEmailConfigValues(data.config_value as SMTPSettings);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.email-configuration-lowercase'),
        })
      );
    } finally {
      setLoading(false);
    }
  }, [setEmailConfigValues]);

  const handleEditClick = () => {
    navigate(ROUTES.SETTINGS_EDIT_EMAIL_CONFIG);
  };

  const handleTestEmailModal = useCallback(() => {
    setIsTestEmailOpen((prev) => !prev);
  }, [setIsTestEmailOpen]);

  const configValues = useMemo(() => {
    if (isUndefined(emailConfigValues)) {
      return null;
    }

    const emailConfigFieldsArray = Object.keys(emailConfigValues).sort();

    return emailConfigFieldsArray
      .filter((value) => !NOT_INCLUDE_EMAIL_CONFIG_VALUE.includes(value))
      .map((configValue) => {
        const title = getEmailConfigFieldLabels(configValue);
        const emailConfigValue =
          emailConfigValues[configValue as keyof SMTPSettings];
        const displayValue =
          isBoolean(emailConfigValue) || isNumber(emailConfigValue)
            ? `${emailConfigValue}`
            : emailConfigValue;

        return (
          <Grid.Item className="layout-column" key={title} span={12}>
            <Grid className="layout-row layout-grid tw:items-center">
              <Grid.Item className="layout-column" span={24}>
                <Typography className="m-0" color="secondary">
                  {`${title}:`}
                </Typography>
              </Grid.Item>
              <Grid.Item className="layout-column" span={24}>
                <Typography className="">
                  {isEmpty(displayValue) ? '--' : displayValue}
                </Typography>
              </Grid.Item>
            </Grid>
          </Grid.Item>
        );
      });
  }, [emailConfigValues]);

  const configValuesContainer = useMemo(() => {
    if (isUndefined(emailConfigValues) && !loading) {
      return (
        <ErrorPlaceHolder
          className="mt-24"
          heading={t('label.email-configuration-lowercase')}
          permissionValue={t('label.create-entity', {
            entity: t('label.email-configuration'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.CREATE}
        />
      );
    }

    return (
      <>
        {loading ? (
          <SkeletonParagraph animation={false} rows={8} />
        ) : (
          <Grid
            className="layout-row layout-grid tw:items-center"
            style={getLayoutGutter(16, 16)}>
            {configValues}
          </Grid>
        )}
      </>
    );
  }, [loading, emailConfigValues, configValues]);

  useEffect(() => {
    fetchEmailConfigValues();
  }, []);

  return (
    <PageLayoutV1 pageTitle={t('label.email-configuration')}>
      <Grid
        className="layout-row layout-grid tw:items-center p-lg bg-white border-radius-sm"
        style={{ ...getLayoutGutter(0, 16) }}>
        <Grid.Item className="layout-column" span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Grid.Item>
        <Grid.Item className="layout-column" span={24}>
          <Box
            align="start"
            className="layout-row"
            justify="between"
            wrap="wrap">
            <Box className="layout-column tw:block">
              <PageHeader
                data={{
                  header: t('label.email'),
                  subHeader: t('message.email-configuration-message'),
                }}
              />
            </Box>
            <Box className="layout-column d-flex">
              {isAdminUser && emailConfigValues?.senderMail && (
                <Button type="primary" onClick={handleTestEmailModal}>
                  {t('label.test-email')}
                </Button>
              )}

              {loading || isSourceLoading ? (
                <ButtonSkeleton />
              ) : (
                !isManagedByDeployment && (
                  <Button
                    className="m-l-md"
                    data-testid="edit-email-configuration"
                    icon={
                      !isUndefined(emailConfigValues) && (
                        <Icon component={IconEdit} size={12} />
                      )
                    }
                    onClick={handleEditClick}>
                    {isUndefined(emailConfigValues)
                      ? t('label.add')
                      : t('label.edit')}
                  </Button>
                )
              )}
            </Box>
          </Box>
        </Grid.Item>
        <Grid.Item className="layout-column" span={24}>
          <SettingsSourceBanner
            className="tw:mb-4"
            sources={sources}
            onAdopted={fetchEmailConfigValues}
            onRefetch={refetchSources}
          />
          {configValuesContainer}
        </Grid.Item>
      </Grid>

      {isTeamEmailOpen && <TestEmail onCancel={handleTestEmailModal} />}
    </PageLayoutV1>
  );
}

export default EmailConfigSettingsPage;
