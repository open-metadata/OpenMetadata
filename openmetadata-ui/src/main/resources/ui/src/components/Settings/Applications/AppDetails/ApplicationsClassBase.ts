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

import type { ComponentType, FC, SVGProps } from 'react';
import { lazy } from 'react';
import { ReactComponent as DefaultAppLogo } from '../../../../assets/svg/application-colored.svg';
import { AppType } from '../../../../generated/entity/applications/app';
import { getScheduleOptionsFromSchedules } from '../../../../utils/CronExpressionUtils';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import type { ApplicationConfigurationProps } from '../ApplicationConfiguration/ApplicationConfiguration';
import type { AppPlugin } from '../plugins/AppPlugin';

// App logos follow the `*Application.svg` naming convention. The old code
// used `import(`../assets/svg/${appName}.svg`)` — Rolldown/Vite must emit a
// chunk for every possible template-literal match, which meant all 799 SVGs
// under `assets/svg/` became individual chunks. Narrowing the glob keeps the
// same lazy-load behaviour (each logo is still its own chunk, fetched on
// demand) but only for the ~9 files that could actually match.
const appLogoLoaders = import.meta.glob<{
  default: FC<SVGProps<SVGSVGElement>>;
  ReactComponent: FC<SVGProps<SVGSVGElement>>;
}>('../../../../assets/svg/*Application.svg', { query: '?react' });

// Screenshot PNGs are served as URL strings, not JSX modules — `eager` + `?url`
// emits each as a static asset with no JS chunk. Previously each screenshot
// was a tiny `import()` chunk.
const appScreenshotUrls = import.meta.glob<string>(
  '../../../../assets/img/appScreenshots/*.png',
  { eager: true, query: '?url', import: 'default' }
);

// Application form schemas. Same reasoning as the app-logo glob: the old
// template-literal `import()` matched every JSON under `applicationSchemas/`,
// producing one lazy chunk per schema (~10). The narrow glob emits the same
// N chunks but the graph is transparent to reviewers, and future refactors
// can eager-load them into a single bucket if needed.
const applicationSchemaLoaders = import.meta.glob<Record<string, unknown>>(
  '../../../../jsons/applicationSchemas/*.json'
);

const ApplicationConfiguration =
  withSuspenseFallback<ApplicationConfigurationProps>(
    lazy(() => import('../ApplicationConfiguration/ApplicationConfiguration'))
  );

class ApplicationsClassBase {
  public async importSchema(fqn: string) {
    const key = `../../../../jsons/applicationSchemas/${fqn}.json`;
    const loader = applicationSchemaLoaders[key];
    if (!loader) {
      return {};
    }
    const module = await loader();

    return (
      (module as { default?: unknown }).default ??
      (module as Record<string, unknown>)
    );
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

    return { default: url ?? null };
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
