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
  Dropdown,
  EmptyPlaceholder,
  Skeleton,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Clock,
  GridView,
  LinkExternal01,
  RefreshCcw01,
  SlashCircle01,
  Trash01,
  User01,
} from '@openmetadata/ui-core-components/icons';
import { RJSFSchema } from '@rjsf/utils';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { FC, ReactNode, useCallback, useEffect, useState } from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { SEARCH_INDEXING_APPLICATION } from '../../../../../../constants/explore.constants';
import { useLimitStore } from '../../../../../../context/LimitsProvider/useLimitsStore';
import { TabSpecificField } from '../../../../../../enums/entity.enum';
import { ResourceEntity } from '../../../../../../enums/permissions.enum';
import {
  App,
  ScheduleTimeline,
} from '../../../../../../generated/entity/applications/app';
import { Operation } from '../../../../../../generated/entity/policies/accessControl/resourcePermission';
import { EntityReference } from '../../../../../../generated/entity/type';
import { Include } from '../../../../../../generated/type/include';
import { useAuth } from '../../../../../../hooks/authHooks';
import { useEntityPermissions } from '../../../../../../hooks/useEntityPermissions/useEntityPermissions';
import {
  configureApp,
  deployApp,
  getApplicationByName,
  patchApplication,
  restoreApp,
  triggerOnDemandApp,
  uninstallApp,
} from '../../../../../../rest/applicationAPI';
import { isCacheWarmupApplication } from '../../../../../../utils/ApplicationUtils';
import { getRelativeTime } from '../../../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import applicationsClassBase from '../../../../../Settings/Applications/AppDetails/ApplicationsClassBase';
import { useApplicationsProvider } from '../../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import AppLiveIndexing from '../../../../../Settings/Applications/AppLiveIndexing/AppLiveIndexing.component';
import AppRunsHistory from '../../../../../Settings/Applications/AppRunsHistory/AppRunsHistory.component';
import AppSchedule from '../../../../../Settings/Applications/AppSchedule/AppSchedule.component';
import McpApplicationConfiguration from '../../../../../Settings/Applications/McpApplicationConfiguration/McpApplicationConfiguration';
import type { AppPlugin } from '../../../../../Settings/Applications/plugins/AppPlugin';
import ConfirmDialog from '../platform-settings/ConfirmDialog';
import { HintToggle } from './AppConfigForm';
import type { ApplicationsViewProps } from './Applications.types';
import {
  getConfigTabKind,
  hasScheduleTab,
  isAppUnavailable,
  isRuntimeDisabled,
} from './Applications.utils';

type AppAction = 'restore' | 'disable' | 'uninstall';

const TAB_SCHEDULE = 'schedule';
const TAB_CONFIGURATION = 'configuration';
const TAB_RUNS = 'recent-runs';
const TAB_LIVE_INDEXING = 'live-indexing';

interface AppDetailProps extends ApplicationsViewProps {
  fqn: string;
}

interface DetailTab {
  id: string;
  label: string;
  content: ReactNode;
}

// As on the legacy page, an installed app's plugin may replace the tabs.
const getPluginDetails = (plugins: AppPlugin[], app?: App) =>
  app
    ? plugins.find((plugin) => plugin.name === app.name)?.getAppDetails?.(app)
    : undefined;

/** Three-dot menu: Disable or Restore, plus Uninstall for non-system apps. */
const AppManageMenu: FC<{
  app: App;
  onAction: (action: AppAction) => void;
}> = ({ app, onAction }) => {
  const { t } = useTranslation();

  return (
    <Dropdown.Root>
      <Dropdown.DotsButton data-testid="manage-button" />
      <Dropdown.Popover className="tw:w-min">
        <Dropdown.Menu
          aria-label={t('label.manage-entity', {
            entity: t('label.application'),
          })}
          selectionMode="none"
          onAction={(key) => onAction(key as AppAction)}>
          {app.deleted ? (
            <Dropdown.Item
              data-testid="restore-button"
              icon={RefreshCcw01}
              id="restore"
              label={t('label.restore')}
            />
          ) : (
            <Dropdown.Item
              data-testid="disable-button"
              icon={SlashCircle01}
              id="disable"
              label={t('label.disable')}
            />
          )}
          {!app.system && (
            <Dropdown.Item
              data-testid="uninstall-button"
              icon={Trash01}
              id="uninstall"
              label={t('label.uninstall')}
            />
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

const AppDetailTabs: FC<{
  tabs: DetailTab[];
  activeTab?: Key;
  onSelectionChange: (key: Key) => void;
}> = ({ tabs, activeTab, onSelectionChange }) =>
  tabs.length > 0 ? (
    <Tabs
      className="tw:gap-4"
      data-testid="tabs"
      selectedKey={activeTab}
      onSelectionChange={onSelectionChange}>
      <Tabs.List size="sm" type="underline">
        {tabs.map(({ id, label }) => (
          <Tabs.Item id={id} key={id}>
            {label}
          </Tabs.Item>
        ))}
      </Tabs.List>
      {tabs.map(({ id, content }) => (
        <Tabs.Panel id={id} key={id}>
          {content}
        </Tabs.Panel>
      ))}
    </Tabs>
  ) : null;

const MetaItem: FC<{
  icon: FC<{ className?: string }>;
  children: ReactNode;
}> = ({ icon: Icon, children }) => (
  <Box align="center" className="tw:text-tertiary" direction="row" gap={1}>
    <Icon className="tw:size-4" />
    <Typography size="text-xs">{children}</Typography>
  </Box>
);

const AppDetail: FC<AppDetailProps> = ({ fqn, onNavigate, onHeaderChange }) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const { getResourceLimit } = useLimitStore();
  const { plugins } = useApplicationsProvider();
  const [appData, setAppData] = useState<App>();
  const [jsonSchema, setJsonSchema] = useState<RJSFSchema>();
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [action, setAction] = useState<AppAction>();
  const [selectedTab, setSelectedTab] = useState<Key>();
  const [showHint, setShowHint] = useState(false);
  // Bumped by Cancel to remount the configuration form with the saved values.
  const [configFormKey, setConfigFormKey] = useState(0);
  const { canEditAll, canDelete, can } = useEntityPermissions(
    ResourceEntity.APPLICATION,
    fqn,
    { deleted: appData?.deleted, enabled: Boolean(appData) }
  );

  const runtimeDisabled = isRuntimeDisabled(appData);
  const runtimeDisabledReason =
    runtimeDisabled && isCacheWarmupApplication(appData?.name)
      ? t('message.cache-service-not-configured-message')
      : undefined;

  const setLoadingFor = (key: string, value: boolean) =>
    setLoading((prev) => ({ ...prev, [key]: value }));

  const fetchAppDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getApplicationByName(fqn, {
        fields: [TabSpecificField.OWNERS, TabSpecificField.PIPELINES],
        include: Include.All,
      });
      setAppData(data);
      try {
        setJsonSchema(await applicationsClassBase.importSchema(fqn));
      } catch {
        setJsonSchema(undefined);
        showErrorToast(
          t('server.no-application-schema-found', { appName: fqn })
        );
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [fqn, t]);

  useEffect(() => {
    void fetchAppDetails();
  }, [fetchAppDetails]);

  const patchApp = async (updated: App, entity: string) => {
    if (!appData) {
      return;
    }
    const response = await patchApplication(
      appData.id,
      compare(appData, updated)
    );
    setAppData(response);
    showSuccessToast(t('message.entity-saved-successfully', { entity }));
  };

  const handleConfigSave = async ({
    formData,
    ingestionRunner,
  }: {
    formData: Record<string, unknown>;
    ingestionRunner?: EntityReference;
  }) => {
    if (!appData) {
      return;
    }
    setLoadingFor('save', true);
    try {
      await patchApp(
        {
          ...appData,
          appConfiguration: formData,
          ...(ingestionRunner && { ingestionRunner }),
        },
        t('label.configuration')
      );
      // The configure endpoint pushes the new config to the running app.
      await configureApp(appData.fullyQualifiedName ?? '', formData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoadingFor('save', false);
    }
  };

  const handleScheduleSave = async (cron: string) => {
    if (!appData) {
      return;
    }
    try {
      await patchApp(
        {
          ...appData,
          appSchedule: {
            scheduleTimeline: isEmpty(cron)
              ? ScheduleTimeline.None
              : ScheduleTimeline.Custom,
            ...(cron ? { cronExpression: cron } : {}),
          },
        },
        t('label.schedule')
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleRunNow = async () => {
    setLoadingFor('run', true);
    try {
      await triggerOnDemandApp(appData?.fullyQualifiedName ?? '');
      showSuccessToast(
        t('message.application-action-successfully', {
          action: t('label.triggered-lowercase'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoadingFor('run', false);
    }
  };

  const handleDeploy = async () => {
    setLoadingFor('deploy', true);
    try {
      await deployApp(appData?.fullyQualifiedName ?? '');
      showSuccessToast(
        t('message.application-action-successfully', {
          action: t('label.deploy'),
        })
      );
      void fetchAppDetails();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoadingFor('deploy', false);
    }
  };

  const handleConfirmAction = async () => {
    if (!appData || !action) {
      return;
    }
    setLoadingFor('action', true);
    try {
      if (action === 'restore') {
        await restoreApp(appData.id);
        showSuccessToast(
          t('message.entity-enabled-success', {
            entity: t('label.application'),
          })
        );
      } else {
        await uninstallApp(
          appData.fullyQualifiedName ?? '',
          action === 'uninstall'
        );
        showSuccessToast(
          action === 'disable'
            ? t('message.app-disabled-successfully')
            : t('message.app-uninstalled-successfully')
        );
        // Update current count when Create / Delete operation performed
        await getResourceLimit('app', true, true);
      }
      setAction(undefined);
      onNavigate({ type: 'list' });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoadingFor('action', false);
    }
  };

  const getTabs = (): DetailTab[] => {
    if (!appData) {
      return [];
    }
    const isAvailable = !isAppUnavailable(appData);
    const showSchedule = hasScheduleTab(appData);
    const configKind = getConfigTabKind(
      appData,
      Boolean(isAdminUser),
      Boolean(jsonSchema)
    );
    const ConfigurationComponent =
      applicationsClassBase.getModalAppConfigurationComponent();

    const candidates: (DetailTab & { show: boolean })[] = [
      {
        id: TAB_SCHEDULE,
        show: showSchedule,
        label: t('label.schedule'),
        content: (
          <AppSchedule
            appData={appData}
            canDeploy={can(Operation.Deploy)}
            canEdit={canEditAll}
            canTrigger={can(Operation.Trigger)}
            disabled={runtimeDisabled}
            disabledReason={runtimeDisabledReason}
            jsonSchema={jsonSchema}
            loading={{
              isRunLoading: Boolean(loading.run),
              isDeployLoading: Boolean(loading.deploy),
            }}
            onDemandTrigger={handleRunNow}
            onDeployTrigger={handleDeploy}
            onSave={handleScheduleSave}
          />
        ),
      },
      {
        id: TAB_CONFIGURATION,
        show: Boolean(configKind),
        label: t('label.configuration'),
        content:
          configKind === 'mcp' ? (
            <McpApplicationConfiguration
              appName={appData.name}
              jsonSchema={jsonSchema as RJSFSchema}
            />
          ) : (
            <ConfigurationComponent
              appData={appData}
              isReadOnly={!canEditAll}
              isSaving={Boolean(loading.save)}
              jsonSchema={jsonSchema as RJSFSchema}
              key={configFormKey}
              showHint={showHint}
              submitLabel={t('label.save')}
              onCancel={() => setConfigFormKey((key) => key + 1)}
              onSave={handleConfigSave}
            />
          ),
      },
      {
        id: TAB_RUNS,
        show: isAvailable && showSchedule,
        label: t('label.recent-run-plural'),
        content: <AppRunsHistory appData={appData} jsonSchema={jsonSchema} />,
      },
      {
        id: TAB_LIVE_INDEXING,
        show: isAvailable && appData.name === SEARCH_INDEXING_APPLICATION,
        label: t('label.live-indexing'),
        content: <AppLiveIndexing appData={appData} />,
      },
    ];

    return candidates.filter((tab) => tab.show);
  };
  const tabs = getTabs();
  const PluginDetails = getPluginDetails(plugins, appData);

  const activeTab = selectedTab ?? tabs[0]?.id;

  useEffect(() => {
    if (!appData) {
      // Not found: keep the trail pointing at the requested app.
      if (!isLoading) {
        onHeaderChange({ crumb: fqn });
      }

      return;
    }

    const appName = getEntityName(appData);

    onHeaderChange({
      title: appName,
      description: '',
      icon: applicationsClassBase.getAppIcon(appData.name),
      crumb: appName,
      titleSuffix:
        appData.deleted || runtimeDisabled ? (
          <Badge
            color="gray"
            data-testid="runtime-disabled-badge"
            size="sm"
            tooltip={runtimeDisabledReason ?? t('label.disabled')}
            type="pill-color">
            {t('label.disabled')}
          </Badge>
        ) : undefined,
      meta: (
        <Box
          align="center"
          className="tw:mt-1"
          data-testid="app-meta"
          direction="row"
          gap={4}
          wrap="wrap">
          <MetaItem icon={Clock}>
            {`${t('label.installed')} ${getRelativeTime(appData.updatedAt)}`}
          </MetaItem>
          <MetaItem icon={User01}>
            {t('label.developed-by-developer', {
              developer: appData.developer,
            })}
          </MetaItem>
          {appData.developerUrl && (
            <Button
              noTextPadding
              color="link-color"
              data-testid="developer-website"
              href={appData.developerUrl}
              iconLeading={LinkExternal01}
              rel="noopener noreferrer"
              size="sm"
              target="_blank">
              {t('label.visit-developer-website')}
            </Button>
          )}
        </Box>
      ),
      actions: (
        <Box align="center" direction="row" gap={4}>
          {activeTab === TAB_CONFIGURATION && (
            <HintToggle isSelected={showHint} onChange={setShowHint} />
          )}
          {canDelete && (
            <AppManageMenu app={appData} onAction={(key) => setAction(key)} />
          )}
        </Box>
      ),
    });
  }, [
    activeTab,
    appData,
    canDelete,
    fqn,
    isLoading,
    onHeaderChange,
    runtimeDisabled,
    runtimeDisabledReason,
    showHint,
    t,
  ]);

  if (isLoading) {
    return (
      <Box className="tw:px-8 tw:pt-4 tw:pb-8" direction="col" gap={4}>
        <Skeleton height={40} variant="rounded" width="100%" />
        <Skeleton height={240} variant="rounded" width="100%" />
      </Box>
    );
  }

  if (!appData) {
    return (
      <Box className="tw:relative tw:flex-1 tw:min-h-90 tw:mx-8">
        <EmptyPlaceholder
          data-testid="app-not-found"
          description={fqn}
          icon={GridView}
          title={t('label.no-entity', { entity: t('label.application') })}
        />
      </Box>
    );
  }

  const actionMessage: Record<AppAction, string> = {
    restore: t('message.restore-action-description', {
      entityType: getEntityName(appData),
    }),
    disable: t('message.disable-app', { app: getEntityName(appData) }),
    uninstall: t('message.uninstall-app', { app: getEntityName(appData) }),
  };

  const actionLabel: Record<AppAction, string> = {
    restore: t('label.restore'),
    disable: t('label.disable'),
    uninstall: t('label.uninstall'),
  };

  return (
    <Box
      className="tw:px-8 tw:pt-4 tw:pb-8"
      data-testid="app-detail"
      direction="col">
      {PluginDetails ? (
        <PluginDetails />
      ) : (
        <AppDetailTabs
          activeTab={activeTab}
          tabs={tabs}
          onSelectionChange={setSelectedTab}
        />
      )}

      <ConfirmDialog
        confirmLabel={action ? actionLabel[action] : ''}
        isDestructive={action !== 'restore'}
        isLoading={Boolean(loading.action)}
        isOpen={Boolean(action)}
        message={action ? actionMessage[action] : ''}
        testId="app-action-confirm"
        title={t('message.are-you-sure')}
        onCancel={() => setAction(undefined)}
        onConfirm={handleConfirmAction}
      />
    </Box>
  );
};

export default AppDetail;
