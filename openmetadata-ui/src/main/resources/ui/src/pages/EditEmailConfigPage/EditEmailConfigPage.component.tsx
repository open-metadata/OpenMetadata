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

import { Skeleton } from 'antd';
import { AxiosError } from 'axios';
import React, {
  FocusEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../components/common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import EmailConfigForm from '../../components/Settings/Email/EmailConfigForm/EmailConfigForm.component';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import {
  EMAIL_CONFIG_SERVICE_CATEGORY,
  OPEN_METADATA,
} from '../../constants/service-guide.constant';
import { ServiceCategory } from '../../enums/service.enum';
import { SMTPSettings } from '../../generated/email/smtpSettings';
import { Settings, SettingType } from '../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

function EditEmailConfigPage() {
  const { t } = useTranslation();
  const history = useHistory();
  const [emailConfigValues, setEmailConfigValues] = useState<SMTPSettings>();
  const [loading, setLoading] = useState<boolean>(false);
  const [isSaveLoading, setIsSaveLoading] = useState<boolean>(false);
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

  const handleRedirectionToSettingsPage = useCallback(() => {
    history.push(
      getSettingPath(
        GlobalSettingsMenuCategory.OPEN_METADATA,
        GlobalSettingOptions.EMAIL
      )
    );
  }, [history]);

  const updateEmailConfigValues = useCallback(
    async (configValues: SMTPSettings) => {
      try {
        setIsSaveLoading(true);
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
        setIsSaveLoading(false);
      }
    },
    []
  );

  const handleFieldFocus = useCallback((event: FocusEvent<HTMLFormElement>) => {
    setActiveField(event.target.id);
  }, []);

  useEffect(() => {
    fetchEmailConfigValues();
  }, []);

  const firstPanelChildren = (
    <div className="max-width-md w-9/10 service-form-container">
      <TitleBreadcrumb titleLinks={slashedBreadcrumb} />
      <div className="m-t-md">
        {loading ? (
          <Skeleton title paragraph={{ rows: 8 }} />
        ) : (
          <EmailConfigForm
            emailConfigValues={emailConfigValues}
            isLoading={isSaveLoading}
            onCancel={handleRedirectionToSettingsPage}
            onFocus={handleFieldFocus}
            onSubmit={updateEmailConfigValues}
          />
        )}
      </div>
    </div>
  );

  const secondPanelChildren = (
    <ServiceDocPanel
      activeField={activeField}
      serviceName={EMAIL_CONFIG_SERVICE_CATEGORY}
      serviceType={OPEN_METADATA as ServiceCategory}
    />
  );

  return (
    <ResizablePanels
      firstPanel={{ children: firstPanelChildren, minWidth: 700, flex: 0.7 }}
      pageTitle={t('label.add-entity', { entity: t('label.service') })}
      secondPanel={{
        children: secondPanelChildren,
        className: 'service-doc-panel',
        minWidth: 60,
        overlay: {
          displayThreshold: 200,
          header: t('label.setup-guide'),
          rotation: 'counter-clockwise',
        },
      }}
    />
  );
}

export default EditEmailConfigPage;
