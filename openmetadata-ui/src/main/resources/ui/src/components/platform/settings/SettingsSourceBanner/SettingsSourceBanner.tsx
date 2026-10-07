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
  Alert,
  Box,
  Button,
  SimpleModal,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { groupBy, isEmpty } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingSource } from '../../../../generated/system/settingsSourceResponse';
import { adoptDeploymentConfig } from '../../../../rest/settingConfigAPI';
import {
  getEnvSourceVariables,
  getOverriddenFields,
  OverriddenSettingField,
} from '../../../../utils/platform/settingsSource.utils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';

export interface SettingsSourceBannerProps {
  sources: SettingSource[];
  className?: string;
  /** Re-reads where the settings take their values from. */
  onRefetch: () => Promise<void>;
  /** Called once deployment values replace stored ones, so the page reloads the setting. */
  onAdopted?: () => void;
}

const OverriddenFieldList = ({
  fields,
}: {
  fields: OverriddenSettingField[];
}) => {
  const { t } = useTranslation();

  return (
    <ul
      className="tw:m-0 tw:list-disc tw:pl-5"
      data-testid="overridden-field-list">
      {fields.map(({ configType, path, envVariable }) => (
        <li key={`${configType}${path}`}>
          {envVariable
            ? t('message.overridden-field-env-variable', {
                field: path,
                variable: envVariable,
              })
            : path}
        </li>
      ))}
    </ul>
  );
};

const SettingsSourceBanner = ({
  sources,
  className,
  onRefetch,
  onAdopted,
}: SettingsSourceBannerProps) => {
  const { t } = useTranslation();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isAdopting, setIsAdopting] = useState(false);

  const envVariables = useMemo(() => getEnvSourceVariables(sources), [sources]);
  const overriddenFields = useMemo(
    () => getOverriddenFields(sources),
    [sources]
  );
  const reloadErrors = useMemo(
    () => sources.filter(({ lastReloadError }) => !isEmpty(lastReloadError)),
    [sources]
  );

  const handleCancel = useCallback(() => {
    if (!isAdopting) {
      setIsConfirmOpen(false);
    }
  }, [isAdopting]);

  // Adopts exactly the fields the admin was shown, so a field that drifted after the banner
  // loaded is not replaced without being confirmed.
  const handleAdopt = useCallback(async () => {
    setIsAdopting(true);
    let isAdopted = false;
    try {
      const fieldsBySetting = groupBy(overriddenFields, 'configType');
      await Promise.all(
        Object.values(fieldsBySetting).map((fields) =>
          adoptDeploymentConfig(
            fields[0].configType,
            fields.map(({ path }) => path)
          )
        )
      );
      isAdopted = true;
      showSuccessToast(t('message.deployment-values-adopted'));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsAdopting(false);
      setIsConfirmOpen(false);
    }
    await onRefetch();
    if (isAdopted) {
      onAdopted?.();
    }
  }, [overriddenFields, onRefetch, onAdopted, t]);

  if (
    isEmpty(envVariables) &&
    isEmpty(overriddenFields) &&
    isEmpty(reloadErrors)
  ) {
    return null;
  }

  return (
    <Box
      className={className}
      data-testid="settings-source-banner"
      direction="col"
      gap={3}>
      {envVariables.map((variable) => (
        <Alert
          data-testid="settings-source-env-alert"
          key={variable}
          title={t('label.managed-by-deployment-configuration')}
          variant="brand">
          {variable
            ? t('message.settings-managed-by-deployment', { variable })
            : t('message.settings-managed-by-deployment-without-variable')}
        </Alert>
      ))}

      {!isEmpty(overriddenFields) && (
        <Alert
          data-testid="settings-source-overridden-alert"
          title={t('label.deployment-values-overridden')}
          variant="warning">
          <Box align="start" direction="col" gap={2}>
            {t('message.settings-deployment-values-overridden')}
            <OverriddenFieldList fields={overriddenFields} />
            <Button
              color="secondary"
              data-testid="use-deployment-value-button"
              size="sm"
              onPress={() => setIsConfirmOpen(true)}>
              {t('label.use-deployment-value')}
            </Button>
          </Box>
        </Alert>
      )}

      {reloadErrors.map(({ configType, lastReloadError }) => (
        <Alert
          data-testid="settings-source-reload-error-alert"
          key={configType}
          title={t('label.settings-not-applied')}
          variant="error">
          {t('message.settings-reload-error', { error: lastReloadError })}
        </Alert>
      ))}

      <SimpleModal
        data-testid="use-deployment-value-modal"
        isDismissable={!isAdopting}
        isOkLoading={isAdopting}
        isOpen={isConfirmOpen}
        okText={t('label.use-deployment-value')}
        title={t('label.use-deployment-value')}
        onCancel={handleCancel}
        onOk={handleAdopt}>
        <Box direction="col" gap={2}>
          {t('message.use-deployment-value-confirmation')}
          <OverriddenFieldList fields={overriddenFields} />
        </Box>
      </SimpleModal>
    </Box>
  );
};

export default SettingsSourceBanner;
