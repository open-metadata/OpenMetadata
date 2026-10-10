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

import { isEmpty } from 'lodash';
import {
  App,
  ScheduleType,
} from '../../../../../../generated/entity/applications/app';
import {
  CreateAppRequest,
  ScheduleTimeline,
} from '../../../../../../generated/entity/applications/createAppRequest';
import {
  AppMarketPlaceDefinition,
  AppType,
} from '../../../../../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { EntityReference } from '../../../../../../generated/entity/type';
import {
  isCacheWarmupApplication,
  isMcpApplication,
} from '../../../../../../utils/ApplicationUtils';
import type { ApplicationsView, InstallStep } from './Applications.types';

export const APPLICATIONS_HASH_TAB = 'applications';
const PATH_MARKETPLACE = 'marketplace';
const PATH_INSTALL = 'install';

export const hashSubPathToView = (subPath: string): ApplicationsView => {
  if (!subPath) {
    return { type: 'list' };
  }

  const parts = subPath.split('/');

  if (parts[0] !== PATH_MARKETPLACE) {
    return { type: 'detail', fqn: decodeURIComponent(parts[0]) };
  }

  if (!parts[1]) {
    return { type: 'marketplace' };
  }

  const fqn = decodeURIComponent(parts[1]);

  return parts[2] === PATH_INSTALL
    ? { type: 'install', fqn }
    : { type: 'marketplace-detail', fqn };
};

export const viewToSubPath = (view: ApplicationsView): string | undefined => {
  switch (view.type) {
    case 'marketplace':
      return PATH_MARKETPLACE;
    case 'marketplace-detail':
      return `${PATH_MARKETPLACE}/${encodeURIComponent(view.fqn)}`;
    case 'install':
      return `${PATH_MARKETPLACE}/${encodeURIComponent(
        view.fqn
      )}/${PATH_INSTALL}`;
    case 'detail':
      return encodeURIComponent(view.fqn);
    default:
      return undefined;
  }
};

export const getInstallSteps = (
  app: Pick<AppMarketPlaceDefinition, 'allowConfiguration' | 'scheduleType'>
): InstallStep[] => [
  'details',
  ...(app.allowConfiguration ? (['configure'] as const) : []),
  ...(app.scheduleType === ScheduleType.NoSchedule
    ? []
    : (['schedule'] as const)),
];

/** Enabled flag is false but the app is not soft-deleted (e.g. CacheWarmup without a cache). */
export const isRuntimeDisabled = (app?: Pick<App, 'enabled' | 'deleted'>) =>
  app?.enabled === false && !app.deleted;

export const isAppUnavailable = (app?: Pick<App, 'enabled' | 'deleted'>) =>
  Boolean(app?.deleted) || isRuntimeDisabled(app);

export const canRunNow = (app: Pick<App, 'scheduleType'>) =>
  [ScheduleType.ScheduledOrManual, ScheduleType.OnlyManual].includes(
    app.scheduleType
  );

export const hasScheduleTab = (app: Pick<App, 'scheduleType'>) =>
  app.scheduleType !== ScheduleType.NoSchedule;

/** Message key explaining why a marketplace app cannot be installed, if any. */
export const getInstallBlockedReason = (
  app: Pick<AppMarketPlaceDefinition, 'enabled' | 'name'>,
  isInstalled: boolean
): string | undefined => {
  if (isInstalled) {
    return 'message.app-already-installed';
  }

  if (app.enabled === false) {
    return isCacheWarmupApplication(app.name)
      ? 'message.cache-service-not-configured-message'
      : 'message.paid-addon-description';
  }

  return undefined;
};

/** Message key for a runtime-disabled installed app, used on its list card. */
export const getRuntimeDisabledReasonKey = (
  app: Pick<App, 'enabled' | 'deleted' | 'name'>
): string | undefined => {
  if (!isRuntimeDisabled(app)) {
    return undefined;
  }

  return isCacheWarmupApplication(app.name)
    ? 'message.cache-service-not-configured-message'
    : 'message.application-disabled-message';
};

/**
 * Which configuration form an installed app gets, if any. The MCP app keeps its
 * settings in an admin-only system setting, so it has a dedicated form.
 */
export const getConfigTabKind = (
  app: Pick<
    App,
    'enabled' | 'deleted' | 'name' | 'appConfiguration' | 'allowConfiguration'
  >,
  isAdmin: boolean,
  hasSchema: boolean
): 'mcp' | 'app' | undefined => {
  if (!hasSchema || isRuntimeDisabled(app)) {
    return undefined;
  }

  if (isMcpApplication(app.name)) {
    return isAdmin ? 'mcp' : undefined;
  }

  return app.appConfiguration && app.allowConfiguration ? 'app' : undefined;
};

/** External links shown under "Resources" on the marketplace detail page. */
export const getAppResources = (
  app: Pick<
    AppMarketPlaceDefinition,
    'supportEmail' | 'developerUrl' | 'privacyPolicyUrl'
  >
): { id: string; labelKey: string; href: string }[] =>
  [
    app.supportEmail && {
      id: 'app-support-email',
      labelKey: 'label.get-app-support',
      href: `mailto:${app.supportEmail}`,
    },
    app.developerUrl && {
      id: 'developer-website',
      labelKey: 'label.developer-website',
      href: app.developerUrl,
    },
    app.privacyPolicyUrl && {
      id: 'privacy-policy',
      labelKey: 'label.privacy-policy',
      href: app.privacyPolicyUrl,
    },
  ].filter((item): item is { id: string; labelKey: string; href: string } =>
    Boolean(item)
  );

/**
 * `cron` is undefined for apps without a schedule step (no `appSchedule` is
 * sent); an empty string means "on demand".
 */
export const buildCreateAppRequest = ({
  app,
  configuration,
  cron,
  ingestionRunner,
}: {
  app: AppMarketPlaceDefinition;
  configuration?: Record<string, unknown>;
  cron?: string;
  ingestionRunner?: EntityReference;
}): CreateAppRequest => ({
  name: app.fullyQualifiedName ?? app.name,
  description: app.description,
  displayName: app.displayName,
  appConfiguration: configuration ?? app.appConfiguration,
  ...(cron !== undefined && {
    appSchedule: {
      scheduleTimeline: isEmpty(cron)
        ? ScheduleTimeline.None
        : ScheduleTimeline.Custom,
      ...(cron ? { cronExpression: cron } : {}),
    },
  }),
  // Only External apps that opt in may carry an ingestion runner.
  ingestionRunner:
    app.appType === AppType.External && app.supportsIngestionRunner
      ? ingestionRunner
      : undefined,
});
