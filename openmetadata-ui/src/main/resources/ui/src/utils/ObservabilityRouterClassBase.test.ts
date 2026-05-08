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
}));

jest.mock('../constants/constants', () => ({
  ROUTES: {
    ADD_OBSERVABILITY_ALERTS: '/observability/alerts/add',
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
