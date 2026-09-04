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

import type { RJSFSchema } from '@rjsf/utils';
import type { AxiosError } from 'axios';
import type { ComponentType, FC } from 'react';
import { lazy } from 'react';
import { ReactComponent as DefaultAppLogo } from '../../../../assets/svg/application-colored.svg';
import { SEARCH_INDEXING_APPLICATION } from '../../../../constants/explore.constants';
import { AppType } from '../../../../generated/entity/applications/app';
import { getSearchEntityTypes } from '../../../../rest/searchAPI';
import { getScheduleOptionsFromSchedules } from '../../../../utils/CronExpressionUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import type { ApplicationConfigurationProps } from '../ApplicationConfiguration/ApplicationConfiguration';
import type { AppPlugin } from '../plugins/AppPlugin';
// Glob maps live in a sibling `.assets.ts` file so ts-jest can mock them (see
// jest.config.js `moduleNameMapper` — `import.meta.glob` is Vite-only syntax
// that ts-jest cannot parse). Runtime behaviour is unchanged.
import {
  applicationSchemaLoaders,
  appLogoLoaders,
  appScreenshotUrls,
} from './ApplicationsClassBase.assets';

const ApplicationConfiguration =
  withSuspenseFallback<ApplicationConfigurationProps>(
    lazy(() => import('../ApplicationConfiguration/ApplicationConfiguration'))
  );

// The sentinel the backend expands to every registered index. It is not an index itself, so the
// endpoint does not return it, but it has to be in the enum for the `["all"]` default to validate.
// TreeSelectWidget filters it out of the child nodes and renders it as the synthetic "All" parent.
const ALL_ENTITY_TYPES = 'all';

/**
 * Which entity types can be reindexed depends on the indexes the server has registered, and that
 * differs per distribution — Collate ships indexes OSS does not. So the list is fetched instead of
 * being an enum in the schema JSON, where every deployment shared one hardcoded copy that silently
 * went stale as entities were added.
 */
const withSearchEntityTypes = async (
  schema: RJSFSchema
): Promise<RJSFSchema> => {
  let entityTypes: string[] = [];
  try {
    entityTypes = await getSearchEntityTypes();
  } catch (error) {
    // Leaves the picker with only "All" selectable rather than failing the whole form.
    showErrorToast(error as AxiosError);
  }

  return {
    ...schema,
    properties: {
      ...schema.properties,
      entities: {
        ...(schema.properties?.entities as RJSFSchema),
        items: { type: 'string', enum: [ALL_ENTITY_TYPES, ...entityTypes] },
      },
    },
  };
};

class ApplicationsClassBase {
  public async importSchema(fqn: string) {
    const key = `../../../../jsons/applicationSchemas/${fqn}.json`;
    const loader = applicationSchemaLoaders[key];
    if (!loader) {
      // Callers (e.g. AppDetails.component) rely on a rejected promise to
      // surface a toast + fallback UI. Preserve that contract instead of
      // silently returning an empty object.
      throw new Error(`Application schema not found: ${fqn}`);
    }
    const module = await loader();
    const schema =
      (module as { default?: unknown }).default ??
      (module as Record<string, unknown>);

    return fqn === SEARCH_INDEXING_APPLICATION
      ? withSearchEntityTypes(schema as RJSFSchema)
      : schema;
  }
  public getJSONUISchema() {
    return {
      moduleConfiguration: {
        dataAssets: {
          serviceFilter: {
            'ui:widget': 'hidden',
          },
        },
      },
      entityLink: {
        'ui:widget': 'hidden',
      },
      type: {
        'ui:widget': 'hidden',
      },
    };
  }
  public async importAppLogo(appName: string) {
    const key = `../../../../assets/svg/${appName}.svg`;
    const loader = appLogoLoaders[key];
    if (!loader) {
      return { ReactComponent: DefaultAppLogo };
    }
    try {
      return await loader();
    } catch {
      return { ReactComponent: DefaultAppLogo };
    }
  }
  /**
   * Used to pass extra elements from installed Apps.
   *
   * @return {FC | null} The application extension, or null if none exists.
   */
  public getApplicationExtension(): FC | null {
    return null;
  }

  public getFloatingApplicationEntityList(): string[] {
    return [];
  }

  public async importAppScreenshot(screenshotName: string) {
    const key = `../../../../assets/img/appScreenshots/${screenshotName}.png`;
    const url = appScreenshotUrls[key];
    if (!url) {
      // Callers (e.g. MarketPlaceAppDetails) `try/catch` around this to drop
      // missing screenshots. Preserve the rejection semantics of the old
      // dynamic `import()` so the catch path still runs and we don't render
      // an `<img>` with no `src`.
      throw new Error(`App screenshot not found: ${screenshotName}`);
    }

    return { default: url };
  }

  public appPluginRegistry: Record<
    string,
    new (name: string, isInstalled: boolean) => AppPlugin
  > = {};

  public getScheduleOptionsForApp(
    app: string,
    appType: AppType,
    pipelineSchedules?: string[]
  ) {
    if (app === 'DataInsightsReportApplication') {
      return ['week'];
    } else if (appType === AppType.External) {
      return ['day'];
    }

    return pipelineSchedules
      ? getScheduleOptionsFromSchedules(pipelineSchedules)
      : undefined;
  }

  /**
   * Returns the ApplicationConfiguration component to use.
   * Base implementation returns the standard component.
   */
  public getApplicationConfigurationComponent(): ComponentType<ApplicationConfigurationProps> {
    return ApplicationConfiguration;
  }
}

const applicationsClassBase = new ApplicationsClassBase();

export default applicationsClassBase;
export { ApplicationsClassBase };
