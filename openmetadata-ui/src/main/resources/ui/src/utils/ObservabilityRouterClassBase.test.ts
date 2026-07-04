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

import { DataQualityPageTabs } from '../pages/DataQuality/DataQualityPage.interface';
import { TestCasePageTabs } from '../pages/IncidentManager/IncidentManager.interface';
import { Task } from '../rest/tasksAPI';
import observabilityRouterClassBase, {
  ObservabilityRouterClassBase,
} from './ObservabilityRouterClassBase';

jest.mock('./RouterUtils', () => ({
  getDataQualityPagePath: (tab?: string, subTab?: string) => {
    let path = '/data-quality';
    if (tab) {
      path = `/data-quality/${tab}`;
    }
    if (subTab) {
      path = `/data-quality/${tab}/${subTab}`;
    }

    return path;
  },
  getObservabilityAlertsEditPath: (fqn: string) =>
    `/observability/alerts/edit/${fqn}`,
  getObservabilityAlertDetailsPath: (fqn: string, tab?: string) =>
    `/observability/alert/${fqn}/${tab ?? 'configuration'}`,
  getTestSuitePath: (fqn: string) => `/test-suites/${fqn}`,
  getTestCaseDetailPagePath: (fqn: string, tab?: string) =>
    `/test-case/${fqn}/${tab ?? 'test-case-results'}`,
  getTestCaseVersionPath: (fqn: string, version: string, tab?: string) =>
    tab
      ? `/test-case/${fqn}/versions/${version}/${tab}`
      : `/test-case/${fqn}/versions/${version}`,
  getTestCaseDimensionsDetailPagePath: (
    fqn: string,
    dimensionKey: string,
    tab?: string
  ) =>
    `/test-case/${fqn}/dimensions/${dimensionKey}/${
      tab ?? 'test-case-results'
    }`,
}));

jest.mock('../constants/constants', () => ({
  ROUTES: {
    ADD_OBSERVABILITY_ALERTS: '/observability/alerts/add',
    INCIDENT_MANAGER: '/incident-manager',
    OBSERVABILITY_ALERTS: '/observability/alerts',
  },
}));

describe('ObservabilityRouterClassBase', () => {
  let router: ObservabilityRouterClassBase;

  beforeEach(() => {
    router = new ObservabilityRouterClassBase();
  });

  describe('embeddedMode', () => {
    it('setEmbeddedMode should be a no-op', () => {
      router.setEmbeddedMode(true);

      expect(router.isEmbeddedMode()).toBe(false);
    });

    it('isEmbeddedMode should always return false', () => {
      expect(router.isEmbeddedMode()).toBe(false);
    });
  });

  describe('getDataQualityPagePath', () => {
    it('should return base path without tab', () => {
      expect(router.getDataQualityPagePath()).toBe('/data-quality');
    });

    it('should return path with tab', () => {
      expect(
        router.getDataQualityPagePath(DataQualityPageTabs.TEST_CASES)
      ).toBe('/data-quality/test-cases');
    });

    it('should return path with tab and subTab', () => {
      expect(
        router.getDataQualityPagePath(
          DataQualityPageTabs.TEST_SUITES,
          'table-suites'
        )
      ).toBe('/data-quality/test-suites/table-suites');
    });
  });

  describe('getAddObservabilityAlertsPath', () => {
    it('should return the add alerts path', () => {
      expect(router.getAddObservabilityAlertsPath()).toBe(
        '/observability/alerts/add'
      );
    });
  });

  describe('getObservabilityAlertsEditPath', () => {
    it('should return the edit alerts path with fqn', () => {
      expect(router.getObservabilityAlertsEditPath('my-alert')).toBe(
        '/observability/alerts/edit/my-alert'
      );
    });
  });

  describe('getObservabilityAlertDetailsPath', () => {
    it('should return the details path with default configuration tab', () => {
      expect(router.getObservabilityAlertDetailsPath('my-alert')).toBe(
        '/observability/alert/my-alert/configuration'
      );
    });

    it('should return the details path with explicit tab', () => {
      expect(
        router.getObservabilityAlertDetailsPath('my-alert', 'diagnostics')
      ).toBe('/observability/alert/my-alert/diagnostics');
    });
  });

  describe('getTestSuitePath', () => {
    it('should delegate to RouterUtils helper with the test suite fqn', () => {
      expect(router.getTestSuitePath('finance.suites.daily')).toBe(
        '/test-suites/finance.suites.daily'
      );
    });
  });

  describe('getTestCaseDetailPagePath', () => {
    it('should default the tab to TEST_CASE_RESULTS when omitted', () => {
      expect(router.getTestCaseDetailPagePath('table.col')).toBe(
        '/test-case/table.col/test-case-results'
      );
    });

    it('should pass through an explicit tab', () => {
      expect(
        router.getTestCaseDetailPagePath('table.col', TestCasePageTabs.ISSUES)
      ).toBe(`/test-case/table.col/${TestCasePageTabs.ISSUES}`);
    });
  });

  describe('getTestCaseVersionPath', () => {
    it('should return path without tab segment when tab is omitted', () => {
      expect(router.getTestCaseVersionPath('table.col', '0.2')).toBe(
        '/test-case/table.col/versions/0.2'
      );
    });

    it('should include tab segment when tab is provided', () => {
      expect(
        router.getTestCaseVersionPath('table.col', '0.2', 'incidents')
      ).toBe('/test-case/table.col/versions/0.2/incidents');
    });
  });

  describe('getTestCaseDimensionsDetailPagePath', () => {
    it('should default the tab to TEST_CASE_RESULTS when omitted', () => {
      expect(
        router.getTestCaseDimensionsDetailPagePath('table.col', 'rowCount')
      ).toBe('/test-case/table.col/dimensions/rowCount/test-case-results');
    });

    it('should pass through an explicit tab', () => {
      expect(
        router.getTestCaseDimensionsDetailPagePath(
          'table.col',
          'rowCount',
          TestCasePageTabs.ISSUES
        )
      ).toBe(
        `/test-case/table.col/dimensions/rowCount/${TestCasePageTabs.ISSUES}`
      );
    });
  });

  describe('getIncidentManagerPath', () => {
    it('should return the incident manager route constant', () => {
      expect(router.getIncidentManagerPath()).toBe('/incident-manager');
    });
  });

  describe('getObservabilityAlertsListPath', () => {
    it('should return the observability alerts route constant', () => {
      expect(router.getObservabilityAlertsListPath()).toBe(
        '/observability/alerts'
      );
    });
  });

  describe('getIncidentTaskPath', () => {
    it('should return the test case issues tab path for test case tasks', () => {
      expect(
        router.getIncidentTaskPath({
          id: 'task-uuid',
          taskId: 6,
          about: {
            type: 'testCase',
            fullyQualifiedName: 'db.schema.table.col.test_case',
          },
        } as unknown as Task)
      ).toBe('/test-case/db.schema.table.col.test_case/issues');
    });

    it('should return the activity-feed task path for non test case tasks', () => {
      expect(
        router.getIncidentTaskPath({
          id: 'task-uuid',
          taskId: 6,
          about: { type: 'table', fullyQualifiedName: 'db.schema.table' },
        } as unknown as Task)
      ).toBe('/table/db.schema.table/activity_feed/tasks/6');
    });

    it('should fall back to the generic task path when the task has no entity reference', () => {
      expect(
        router.getIncidentTaskPath({
          id: 'task-uuid',
          taskId: 6,
        } as unknown as Task)
      ).toBe('/tasks/task-uuid');
    });
  });

  describe('singleton default export', () => {
    it('default export should be an instance of ObservabilityRouterClassBase', () => {
      expect(observabilityRouterClassBase).toBeInstanceOf(
        ObservabilityRouterClassBase
      );
    });

    it('repeated imports should reference the same singleton', () => {
      const { default: reimport } = jest.requireActual<{
        default: ObservabilityRouterClassBase;
      }>('./ObservabilityRouterClassBase');

      expect(reimport).toBe(observabilityRouterClassBase);
    });
  });
});
