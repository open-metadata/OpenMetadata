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

import { OBSERVABILITY_ROUTES } from '../components/observability/observability.constants';
import { AI_APP_MODE } from '../constants/appMode.constants';
import { ROUTES } from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { useAppModeStore } from '../hooks/useAppMode';
import { DataQualityPageTabs } from '../pages/DataQuality/DataQualityPage.interface';
import { TestCasePageTabs } from '../pages/IncidentManager/IncidentManager.interface';
import { Task } from '../rest/tasksAPI';
import { isAppModeSessionActive } from './appModeSession';
import {
  getDataQualityPagePath,
  getObservabilityAlertDetailsPath,
  getObservabilityAlertsEditPath,
  getTestCaseDetailPagePath,
  getTestCaseDimensionsDetailPagePath,
  getTestCaseVersionPath,
  getTestSuitePath,
} from './RouterUtils';
import {
  getTaskDetailPath,
  getTaskEntityFQN,
  getTaskEntityType,
} from './TaskUtils';

type AppModePrefixedPathMethod =
  | 'getDataQualityPagePath'
  | 'getIncidentManagerPath'
  | 'getTestSuitePath'
  | 'getTestCaseDetailPagePath'
  | 'getTestCaseVersionPath'
  | 'getTestCaseDimensionsDetailPagePath';

class ObservabilityRouterClassBase {
  public setEmbeddedMode(_flag: boolean): void {
    // no-op in base; embedded mode follows the active app mode
  }

  /**
   * True while `AppRouter` renders the AI app-mode shell (same condition), so
   * links resolve to the shell's `/observability/*` pages, not classic ones.
   */
  public isEmbeddedMode(): boolean {
    return (
      useAppModeStore.getState().currentMode === AI_APP_MODE ||
      isAppModeSessionActive()
    );
  }

  public getDataQualityPagePath(
    tab?: DataQualityPageTabs,
    subTab?: string
  ): string {
    return this.withAppModePrefix(
      getDataQualityPagePath(tab, subTab),
      'getDataQualityPagePath'
    );
  }

  public getAddObservabilityAlertsPath(): string {
    return ROUTES.ADD_OBSERVABILITY_ALERTS;
  }

  public getObservabilityAlertsListPath(): string {
    return ROUTES.OBSERVABILITY_ALERTS;
  }

  public getIncidentManagerPath(): string {
    return this.withAppModePrefix(
      ROUTES.INCIDENT_MANAGER,
      'getIncidentManagerPath'
    );
  }

  public getObservabilityAlertsEditPath(fqn: string): string {
    return getObservabilityAlertsEditPath(fqn);
  }

  public getObservabilityAlertDetailsPath(fqn: string, tab?: string): string {
    return getObservabilityAlertDetailsPath(fqn, tab);
  }

  public getTestSuitePath(testSuiteFqn: string): string {
    return this.withAppModePrefix(
      getTestSuitePath(testSuiteFqn),
      'getTestSuitePath'
    );
  }

  public getTestCaseDetailPagePath(
    fqn: string,
    tab: TestCasePageTabs = TestCasePageTabs.TEST_CASE_RESULTS
  ): string {
    return this.withAppModePrefix(
      getTestCaseDetailPagePath(fqn, tab),
      'getTestCaseDetailPagePath'
    );
  }

  public getTestCaseVersionPath(
    fqn: string,
    version: string,
    tab?: string
  ): string {
    return this.withAppModePrefix(
      getTestCaseVersionPath(fqn, version, tab),
      'getTestCaseVersionPath'
    );
  }

  public getTestCaseDimensionsDetailPagePath(
    fqn: string,
    dimensionKey: string,
    tab: TestCasePageTabs = TestCasePageTabs.TEST_CASE_RESULTS
  ): string {
    return this.withAppModePrefix(
      getTestCaseDimensionsDetailPagePath(fqn, dimensionKey, tab),
      'getTestCaseDimensionsDetailPagePath'
    );
  }

  /**
   * Test-case incident tasks live on the test case's own Issues tab —
   * the generic entity activity-feed route has no testCase page, so
   * `getTaskDetailPath` would land on Not Found for them. When the task
   * payload carries no `about` reference, `fallbackTestCaseFqn` (the test
   * case the caller is rendering) keeps the link on the Issues tab.
   */
  public getIncidentTaskPath(task: Task, fallbackTestCaseFqn?: string): string {
    const taskEntityFqn =
      getTaskEntityType(task) === EntityType.TEST_CASE
        ? getTaskEntityFQN(task)
        : undefined;
    const testCaseFqn = taskEntityFqn ?? fallbackTestCaseFqn;

    if (testCaseFqn) {
      return this.getTestCaseDetailPagePath(
        testCaseFqn,
        TestCasePageTabs.ISSUES
      );
    }

    return getTaskDetailPath(task);
  }

  /**
   * Alert paths are not listed: their classic routes already live under
   * `/observability`. Add/edit alert pages have no app-mode route and are
   * served by the shell's classic fallback.
   *
   * Collate's override still prefixes on top of `super`, so a method a
   * subclass overrides is left for that override to prefix — otherwise the
   * path would become `/observability/observability/...`. Drop the override
   * check once Collate removes those overrides.
   */
  private withAppModePrefix(
    path: string,
    method: AppModePrefixedPathMethod
  ): string {
    const isOverridden =
      this[method] !== ObservabilityRouterClassBase.prototype[method];

    return this.isEmbeddedMode() && !isOverridden
      ? `${OBSERVABILITY_ROUTES.OBSERVABILITY}${path}`
      : path;
  }
}

const observabilityRouterClassBase = new ObservabilityRouterClassBase();

export default observabilityRouterClassBase;
export { ObservabilityRouterClassBase };
