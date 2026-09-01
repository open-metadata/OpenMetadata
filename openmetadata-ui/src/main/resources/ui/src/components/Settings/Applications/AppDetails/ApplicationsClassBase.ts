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

import { RJSFSchema } from '@rjsf/utils';
import { AxiosError } from 'axios';
import { ComponentType, FC, lazy } from 'react';
import { ReactComponent as DefaultAppLogo } from '../../../../assets/svg/application-colored.svg';
import { AppType } from '../../../../generated/entity/applications/app';
import { getSearchEntityTypes } from '../../../../rest/searchAPI';
import { getScheduleOptionsFromSchedules } from '../../../../utils/CronExpressionUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import type { ApplicationConfigurationProps } from '../ApplicationConfiguration/ApplicationConfiguration';
import { AppPlugin } from '../plugins/AppPlugin';

const ApplicationConfiguration =
  withSuspenseFallback<ApplicationConfigurationProps>(
    lazy(() => import('../ApplicationConfiguration/ApplicationConfiguration'))
  );

const SEARCH_INDEXING_APPLICATION = 'SearchIndexingApplication';

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
        items: { type: 'string', enum: entityTypes },
      },
    },
  };
};

class ApplicationsClassBase {
  public async importSchema(fqn: string) {
    const module = await import(
      `../../../../jsons/applicationSchemas/${fqn}.json`
    );
    const schema = module.default || module;

    return fqn === SEARCH_INDEXING_APPLICATION
      ? withSearchEntityTypes(schema)
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
    try {
      return await import(`../../../../assets/svg/${appName}.svg`);
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

  public importAppScreenshot(screenshotName: string) {
    return import(
      `../../../../assets/img/appScreenshots/${screenshotName}.png`
    );
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
