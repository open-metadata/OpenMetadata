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

import { Card, Skeleton } from 'antd';
import { AxiosError } from 'axios';
import ServiceRightPanel from 'components/common/ServiceRightPanel/ServiceRightPanel';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import PageContainerV1 from 'components/containers/PageContainerV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import EmailConfigForm from 'components/EmailConfigForm/EmailConfigForm.component';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from 'constants/GlobalSettings.constants';
import {
  EMAIL_CONFIG_SERVICE_CATEGORY,
  OPEN_METADATA,
} from 'constants/service-guide.constant';
import { ServiceCategory } from 'enums/service.enum';
import { SMTPSettings } from 'generated/email/smtpSettings';
import { Settings, SettingType } from 'generated/settings/settings';
import React, {
  FocusEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from 'rest/emailConfigAPI';
import { getSettingPath } from 'utils/RouterUtils';
import { showErrorToast, showSuccessToast } from 'utils/ToastUtils';

function EditEmailConfigPage() {
  const { t } = useTranslation();
  const history = useHistory();
  const [emailConfigValues, setEmailConfigValues] = useState<SMTPSettings>();
  const [loading, setLoading] = useState<boolean>(false);
  const [activeField, setActiveField] = useState<string>('');

  const slashedBreadcrumb = useMemo(
    () => [
      {
        name: t('label.setting-plural'),
        url: getSettingPath(),
      },
      {
        name: t('label.email'),
        url: getSettingPath(
          GlobalSettingsMenuCategory.OPEN_METADATA,
          GlobalSettingOptions.EMAIL
        ),
      },
      {
        name: t('label.edit-entity', {
          entity: t('label.email-configuration'),
        }),
        url: '',
      },
    ],
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
  }, []);

  const updateEmailConfigValues = useCallback(
    async (configValues: SMTPSettings) => {
      try {
        setLoading(true);
        const settingsConfigData: Settings = {
          config_type: SettingType.EmailConfiguration,
          config_value: configValues,
        };
        await updateSettingsConfig(settingsConfigData);

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.email-configuration'),
          })
        );
        handleRedirectionToSettingsPage();
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.email-configuration-lowercase'),
          })
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleFieldFocus = useCallback((event: FocusEvent<HTMLFormElement>) => {
    setActiveField(event.target.id);
  }, []);

  const handleBlur = useCallback(() => setActiveField(''), []);

  const handleRedirectionToSettingsPage = useCallback(() => {
    history.push(
      getSettingPath(
        GlobalSettingsMenuCategory.OPEN_METADATA,
        GlobalSettingOptions.EMAIL
      )
    );
  }, [history]);

  useEffect(() => {
    fetchEmailConfigValues();
  }, []);

  return (
    <PageContainerV1>
      <div className="self-center w-min-60">
        <PageLayoutV1
          className="tw-max-w-full-hd tw-h-full p-t-md self-center"
          header={<TitleBreadcrumb titleLinks={slashedBreadcrumb} />}
          pageTitle={t('label.add-entity', { entity: t('label.service') })}
          rightPanel={
            <ServiceRightPanel
              isUpdating
              activeField={activeField}
              activeStep={0}
              isIngestion={false}
              selectedService={EMAIL_CONFIG_SERVICE_CATEGORY}
              selectedServiceCategory={OPEN_METADATA as ServiceCategory}
              serviceName=""
            />
          }>
          <Card className="p-lg">
            {loading ? (
              <Skeleton title paragraph={{ rows: 8 }} />
            ) : (
              <EmailConfigForm
                emailConfigValues={emailConfigValues}
                onBlur={handleBlur}
                onCancel={handleRedirectionToSettingsPage}
                onFocus={handleFieldFocus}
                onSubmit={updateEmailConfigValues}
              />
            )}
          </Card>
        </PageLayoutV1>
      </div>
    </PageContainerV1>
  );
}

export default EditEmailConfigPage;
