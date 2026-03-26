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

import { App, AppType } from '../generated/entity/applications/app';

/**
 * Mirrors backend AppBoundConfigurationUtil routing logic.
 * External apps use flat fields (appConfiguration, appSchedule, privateConfiguration).
 * Internal apps use nested fields (configuration.globalAppConfig.{config, schedule, privateConfig}).
 *
 * Intermediate type until generated types are regenerated to include 'configuration'.
 */
interface GlobalAppConfig {
  config?: unknown;
  schedule?: unknown;
  privateConfig?: unknown;
}

interface AppBoundConfig {
  globalAppConfig?: GlobalAppConfig;
}

const isExternalApp = (app: App) => app.appType === AppType.External;

const getGlobalAppConfig = (app: App): GlobalAppConfig | undefined =>
  (app as unknown as Record<string, AppBoundConfig>).configuration
    ?.globalAppConfig;

export const getAppConfig = (app?: App) => {
  if (!app) {
    return undefined;
  }

  // External apps always use flat fields
  if (isExternalApp(app)) {
    return app.appConfiguration;
  }

  // Internal apps: nested first, flat fallback
  return getGlobalAppConfig(app)?.config ?? app.appConfiguration;
};

export const getAppSchedule = (app?: App) => {
  if (!app) {
    return undefined;
  }

  if (isExternalApp(app)) {
    return app.appSchedule;
  }

  return getGlobalAppConfig(app)?.schedule ?? app.appSchedule;
};

export const getAppPrivateConfig = (app?: App) => {
  if (!app) {
    return undefined;
  }

  if (isExternalApp(app)) {
    return app.privateConfiguration;
  }

  return getGlobalAppConfig(app)?.privateConfig ?? app.privateConfiguration;
};

export const hasAppConfiguration = (app?: App) => {
  if (!app) {
    return false;
  }

  return getAppConfig(app) !== undefined;
};

/**
 * Create updated app object with new configuration.
 * External apps update flat appConfiguration field.
 * Internal apps update nested configuration.globalAppConfig.config.
 */
export const updateAppConfig = (app: App, newConfig: unknown) => {
  if (isExternalApp(app)) {
    return {
      ...app,
      appConfiguration: newConfig,
    };
  }

  const currentGlobal = getGlobalAppConfig(app);

  return {
    ...app,
    configuration: {
      ...(app as unknown as Record<string, unknown>).configuration,
      globalAppConfig: {
        ...currentGlobal,
        config: newConfig,
      },
    },
  };
};

/**
 * Create updated app object with new schedule.
 * External apps update flat appSchedule field.
 * Internal apps update nested configuration.globalAppConfig.schedule.
 */
export const updateAppSchedule = (app: App, newSchedule: unknown) => {
  if (isExternalApp(app)) {
    return {
      ...app,
      appSchedule: newSchedule,
    };
  }

  const currentGlobal = getGlobalAppConfig(app);

  return {
    ...app,
    configuration: {
      ...(app as unknown as Record<string, unknown>).configuration,
      globalAppConfig: {
        ...currentGlobal,
        schedule: newSchedule,
      },
    },
  };
};
