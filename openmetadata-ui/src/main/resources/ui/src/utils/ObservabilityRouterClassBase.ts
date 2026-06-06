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

import { ROUTES } from '../constants/constants';
import { DataQualityPageTabs } from '../pages/DataQuality/DataQualityPage.interface';
import { TestCasePageTabs } from '../pages/IncidentManager/IncidentManager.interface';
import {
  getDataQualityPagePath,
  getObservabilityAlertDetailsPath,
  getObservabilityAlertsEditPath,
  getTestCaseDetailPagePath,
  getTestCaseDimensionsDetailPagePath,
  getTestCaseVersionPath,
  getTestSuitePath,
} from './RouterUtils';

class ObservabilityRouterClassBase {
  public setEmbeddedMode(_flag: boolean): void {
    // no-op in base; overridden in Collate
  }

  public isEmbeddedMode(): boolean {
    return false;
  }

  public getDataQualityPagePath(
    tab?: DataQualityPageTabs,
    subTab?: string
  ): string {
    return getDataQualityPagePath(tab, subTab);
  }

  public getAddObservabilityAlertsPath(): string {
    return ROUTES.ADD_OBSERVABILITY_ALERTS;
  }

  public getObservabilityAlertsListPath(): string {
    return ROUTES.OBSERVABILITY_ALERTS;
  }

  public getIncidentManagerPath(): string {
    return ROUTES.INCIDENT_MANAGER;
  }

  public getObservabilityAlertsEditPath(fqn: string): string {
    return getObservabilityAlertsEditPath(fqn);
  }

  public getObservabilityAlertDetailsPath(fqn: string, tab?: string): string {
    return getObservabilityAlertDetailsPath(fqn, tab);
  }

  public getTestSuitePath(testSuiteFqn: string): string {
    return getTestSuitePath(testSuiteFqn);
  }

  public getTestCaseDetailPagePath(
    fqn: string,
    tab: TestCasePageTabs = TestCasePageTabs.TEST_CASE_RESULTS
  ): string {
    return getTestCaseDetailPagePath(fqn, tab);
  }

  public getTestCaseVersionPath(
    fqn: string,
    version: string,
    tab?: string
  ): string {
    return getTestCaseVersionPath(fqn, version, tab);
  }

  public getTestCaseDimensionsDetailPagePath(
    fqn: string,
    dimensionKey: string,
    tab: TestCasePageTabs = TestCasePageTabs.TEST_CASE_RESULTS
  ): string {
    return getTestCaseDimensionsDetailPagePath(fqn, dimensionKey, tab);
  }
}

const observabilityRouterClassBase = new ObservabilityRouterClassBase();

export default observabilityRouterClassBase;
export { ObservabilityRouterClassBase };
