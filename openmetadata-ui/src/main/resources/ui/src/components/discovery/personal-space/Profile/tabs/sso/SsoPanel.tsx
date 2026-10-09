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

import type { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import {
  Box,
  Button,
  Tabs,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowUpRight,
  Hint,
  SingleSignOn,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import type { Key } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from '../../../../../../generated/settings/settings';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import {
  getSecurityConfiguration,
  patchSecurityConfiguration,
  SecurityConfiguration,
} from '../../../../../../rest/securityConfigAPI';
import {
  getProviderDisplayName,
  getProviderIcon,
  isValidNonBasicProvider,
} from '../../../../../../utils/SSOUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import type { ProfileHeaderOverride } from '../../profileNavConfig';
import { SettingsSkeleton } from '../platform-settings/SettingsFormLayout';
import SsoConfigureForm from './SsoConfigureForm';
import SsoOverview from './SsoOverview';
import type { SsoView } from './SsoPanel.types';
import {
  hashSubPathToView,
  SSO_HASH_TAB,
  viewToSubPath,
} from './SsoPanel.utils';
import SsoProviderGrid from './SsoProviderGrid';

interface SsoPanelProps {
  onHeaderChange?: (override: ProfileHeaderOverride | null) => void;
}

const ProviderLogo = ({ provider }: { provider: string }) => {
  const icon = getProviderIcon(provider);

  return (
    <span
      className="tw:flex tw:size-12 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-secondary tw:bg-primary"
      data-testid="sso-provider-logo">
      {icon ? (
        <img alt="" height={24} src={icon} width={24} />
      ) : (
        <SingleSignOn className="tw:size-6 tw:text-fg-quaternary" />
      )}
    </span>
  );
};

/**
 * SSO settings in the profile modal: the provider grid when nothing is set up
 * (or the admin changes provider), otherwise the configured provider's
 * Overview / Configure tabs. Navigation is kept in the settings hash.
 */
const SsoPanel = ({ onHeaderChange }: SsoPanelProps) => {
  const { t } = useTranslation();
  const { state: hashState, setHash } = useSettingsHash();
  const [config, setConfig] = useState<SecurityConfiguration>();
  const [isLoading, setIsLoading] = useState(true);
  const [pickedProvider, setPickedProvider] = useState<AuthProvider>();
  const [showHint, setShowHint] = useState(false);

  const hasExistingConfig = Boolean(config && isValidNonBasicProvider(config));
  const savedProvider = hasExistingConfig
    ? config?.authenticationConfiguration.provider
    : undefined;

  const view = useMemo(
    () =>
      hashSubPathToView(
        hashState.tab === SSO_HASH_TAB ? hashState.subPath : '',
        hasExistingConfig
      ),
    [hashState.tab, hashState.subPath, hasExistingConfig]
  );

  const onNavigate = useCallback(
    (next: SsoView) => setHash(SSO_HASH_TAB, viewToSubPath(next)),
    [setHash]
  );

  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await getSecurityConfiguration();
      setConfig(data);
    } catch {
      // No readable configuration: the provider grid is the way forward.
      setConfig(undefined);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const handleSelfSignupChange = useCallback(
    async (enabled: boolean) => {
      const previous = config;
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              authenticationConfiguration: {
                ...prev.authenticationConfiguration,
                enableSelfSignup: enabled,
              },
            }
          : prev
      );
      try {
        await patchSecurityConfiguration([
          {
            op: 'replace',
            path: '/authenticationConfiguration/enableSelfSignup',
            value: enabled,
          },
        ]);
      } catch (error) {
        setConfig(previous);
        showErrorToast(error as AxiosError);
      }
    },
    [config]
  );

  const getHeaderProvider = () => {
    if (view.type === 'new') {
      return view.provider;
    }

    return view.type === 'providers' ? undefined : savedProvider;
  };
  const headerProvider = getHeaderProvider();
  const showsForm = view.type === 'new' || view.type === 'configure';

  useEffect(() => {
    if (!onHeaderChange) {
      return;
    }

    const ssoLabel = t('label.single-sign-on');
    const breadcrumbs: BreadcrumbItemType[] = [
      { id: 'settings', label: t('label.setting-plural') },
      { id: SSO_HASH_TAB, label: ssoLabel },
    ];
    if (headerProvider) {
      breadcrumbs.push({
        id: 'current',
        label: getProviderDisplayName(headerProvider),
      });
    }

    const hintToggle = (
      <Box align="center" direction="row" gap={2}>
        <Hint className="tw:size-4.5 tw:text-secondary" />
        <Typography size="text-sm" weight="medium">
          {t('label.show-hint')}
        </Typography>
        <Toggle
          aria-label={t('label.show-hint')}
          data-testid="show-hint-toggle"
          isSelected={showHint}
          onChange={setShowHint}
        />
      </Box>
    );

    const actions =
      view.type === 'providers' ? (
        <Button
          color="primary"
          data-testid="sso-configure-provider"
          iconTrailing={ArrowUpRight}
          isDisabled={!pickedProvider}
          size="sm"
          onPress={() =>
            pickedProvider &&
            onNavigate({ type: 'new', provider: pickedProvider })
          }>
          {t('label.configure')}
        </Button>
      ) : (
        <Box align="center" direction="row" gap={4}>
          {showsForm && hintToggle}
          {hasExistingConfig && view.type !== 'new' && (
            <Button
              color="secondary"
              data-testid="change-provider-button"
              size="sm"
              onPress={() => onNavigate({ type: 'providers' })}>
              {t('label.change-provider')}
            </Button>
          )}
        </Box>
      );

    onHeaderChange({
      breadcrumbs,
      title: headerProvider ? getProviderDisplayName(headerProvider) : ssoLabel,
      description: t('message.sso-configuration-directly-from-the-ui'),
      icon: SingleSignOn,
      iconNode: headerProvider ? (
        <ProviderLogo provider={headerProvider} />
      ) : undefined,
      onBreadcrumbAction: (id: Key) => {
        if (id === SSO_HASH_TAB) {
          onNavigate({ type: 'overview' });
        }
      },
      actions: isLoading ? undefined : actions,
    });
  }, [
    hasExistingConfig,
    headerProvider,
    isLoading,
    onHeaderChange,
    onNavigate,
    pickedProvider,
    showHint,
    showsForm,
    t,
    view.type,
  ]);

  const content = (() => {
    if (isLoading) {
      return (
        <div className="tw:px-8">
          <SettingsSkeleton rows={6} />
        </div>
      );
    }

    if (view.type === 'providers') {
      return (
        <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-8 tw:pb-8">
          <SsoProviderGrid
            selectedProvider={pickedProvider}
            onSelect={setPickedProvider}
          />
        </div>
      );
    }

    if (view.type === 'new') {
      return (
        <SsoConfigureForm
          key={view.provider}
          selectedProvider={view.provider}
          showHint={showHint}
          onChangeProvider={() => onNavigate({ type: 'providers' })}
        />
      );
    }

    return (
      <Tabs
        className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:gap-6"
        selectedKey={view.type}
        onSelectionChange={(key) => {
          if (key === 'overview') {
            // A save on the Configure tab may have changed self signup.
            void fetchConfig();
          }
          onNavigate({ type: key === 'configure' ? 'configure' : 'overview' });
        }}>
        <Tabs.List className="tw:px-8" size="sm" type="underline">
          <Tabs.Item data-testid="sso-tab-overview" id="overview">
            {t('label.overview')}
          </Tabs.Item>
          <Tabs.Item data-testid="sso-tab-configure" id="configure">
            {t('label.configure')}
          </Tabs.Item>
        </Tabs.List>
        <Tabs.Panel className="tw:px-8" id="overview">
          <SsoOverview
            isSelfSignupEnabled={Boolean(
              config?.authenticationConfiguration.enableSelfSignup
            )}
            onSelfSignupChange={handleSelfSignupChange}
          />
        </Tabs.Panel>
        <Tabs.Panel
          className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col"
          id="configure">
          <SsoConfigureForm
            securityConfig={config}
            showHint={showHint}
            onChangeProvider={() => onNavigate({ type: 'providers' })}
          />
        </Tabs.Panel>
      </Tabs>
    );
  })();

  return (
    <Box
      className="tw:min-h-0 tw:flex-1 tw:overflow-hidden"
      data-testid="sso-panel"
      direction="col">
      {content}
    </Box>
  );
};

export default SsoPanel;
