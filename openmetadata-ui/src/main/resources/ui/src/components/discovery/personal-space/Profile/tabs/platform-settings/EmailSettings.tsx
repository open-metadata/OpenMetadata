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
  Badge,
  Box,
  Button,
  EmptyPlaceholder,
  Toggle,
} from '@openmetadata/ui-core-components';
import { Edit01, Mail01, Plus } from '@openmetadata/ui-core-components/icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SMTPSettings } from '../../../../../../generated/email/smtpSettings';
import { SettingType } from '../../../../../../generated/settings/settings';
import { getSettingsConfigFromConfigType } from '../../../../../../rest/settingConfigAPI';
import SettingsSection, { ReadOnlyRow } from '../../components/SettingsSection';
import type { PlatformSettingsPageProps } from './PlatformSettings.types';
import { SettingsSkeleton } from './SettingsFormLayout';
import SettingValue from './SettingValue';
import TestEmailModal from './TestEmailModal';
import { useSettingsFetch } from './useSettingsFetch';

const fetchEmailConfig = async () => {
  const { data } = await getSettingsConfigFromConfigType(
    SettingType.EmailConfiguration
  );

  return data?.config_value as SMTPSettings | undefined;
};

const EmailSettings = ({
  onNavigate,
  onSetHeaderActions,
}: PlatformSettingsPageProps) => {
  const { t } = useTranslation();
  const { data: config, isLoading } = useSettingsFetch(fetchEmailConfig);
  const [isTestEmailOpen, setIsTestEmailOpen] = useState(false);

  useEffect(() => {
    if (isLoading) {
      return undefined;
    }

    onSetHeaderActions(
      <Box direction="row" gap={3}>
        {config?.senderMail && (
          <Button
            color="secondary"
            data-testid="test-email-button"
            size="sm"
            onPress={() => setIsTestEmailOpen(true)}>
            {t('label.test-email')}
          </Button>
        )}
        <Button
          color="primary"
          data-testid="edit-button"
          iconLeading={config ? Edit01 : Plus}
          size="sm"
          onPress={() =>
            onNavigate({ type: 'page', page: 'email', isEditing: true })
          }>
          {config ? t('label.edit') : t('label.add')}
        </Button>
      </Box>
    );

    return () => onSetHeaderActions(undefined);
  }, [config, isLoading, onNavigate, onSetHeaderActions, t]);

  if (isLoading) {
    return <SettingsSkeleton rows={8} />;
  }

  if (!config) {
    return (
      // The placeholder centres itself in its nearest positioned ancestor.
      <div className="tw:relative tw:min-h-90">
        <EmptyPlaceholder
          data-testid="email-config-empty"
          icon={<Mail01 className="tw:text-quaternary" />}
          title={t('label.no-entity', {
            entity: t('label.email-configuration'),
          })}
        />
      </div>
    );
  }

  return (
    <Box data-testid="email-settings" direction="col" gap={8}>
      <SettingsSection title={t('label.server')}>
        <ReadOnlyRow title={t('label.enable-smtp-server')}>
          <Toggle
            isReadOnly
            aria-label={t('label.enable-smtp-server')}
            data-testid="enable-smtp-server-value"
            isSelected={Boolean(config.enableSmtpServer)}
          />
        </ReadOnlyRow>
        <ReadOnlyRow title={t('label.server-endpoint')}>
          <SettingValue
            testId="server-endpoint-value"
            value={config.serverEndpoint}
          />
        </ReadOnlyRow>
        <ReadOnlyRow title={t('label.server-port')}>
          <SettingValue
            testId="server-port-value"
            value={config.serverPort?.toString()}
          />
        </ReadOnlyRow>
        <ReadOnlyRow title={t('label.transportation-strategy')}>
          {config.transportationStrategy ? (
            <Badge
              color="brand"
              data-testid="transportation-strategy-value"
              size="sm"
              type="color">
              {config.transportationStrategy}
            </Badge>
          ) : (
            <SettingValue testId="transportation-strategy-value" />
          )}
        </ReadOnlyRow>
      </SettingsSection>

      <SettingsSection title={t('label.sender-and-authentication')}>
        <ReadOnlyRow title={t('label.emailing-entity')}>
          <SettingValue
            testId="emailing-entity-value"
            value={config.emailingEntity}
          />
        </ReadOnlyRow>
        <ReadOnlyRow title={t('label.sender-email')}>
          <SettingValue testId="sender-email-value" value={config.senderMail} />
        </ReadOnlyRow>
        <ReadOnlyRow title={t('label.username')}>
          <SettingValue testId="username-value" value={config.username} />
        </ReadOnlyRow>
        <ReadOnlyRow title={t('label.password')}>
          <SettingValue testId="password-value" value={config.password} />
        </ReadOnlyRow>
        <ReadOnlyRow title={t('label.support-url')}>
          <SettingValue testId="support-url-value" value={config.supportUrl} />
        </ReadOnlyRow>
      </SettingsSection>

      {isTestEmailOpen && (
        <TestEmailModal onClose={() => setIsTestEmailOpen(false)} />
      )}
    </Box>
  );
};

export default EmailSettings;
