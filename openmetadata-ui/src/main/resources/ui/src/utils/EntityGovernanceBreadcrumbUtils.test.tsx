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
import { AI_APP_MODE, DEFAULT_APP_MODE } from '../constants/appMode.constants';
import { EntityType } from '../enums/entity.enum';
import {
  AlertType,
  EventSubscription,
} from '../generated/events/eventSubscription';
import { TestSuite } from '../generated/tests/testCase';
import { useAppModeStore } from '../hooks/useAppMode';
import {
  getBreadcrumbForEventSubscription,
  getBreadcrumbForTestSuite,
} from './EntityGovernanceBreadcrumbUtils';

jest.mock('./RouterUtils', () => ({
  getDataQualityPagePath: jest.fn(),
  getDomainPath: jest.fn(),
  getSettingPath: jest.fn(),
  getServiceDetailsPath: jest.fn(),
  getEntityDetailsPath: jest.fn(),
  getNotificationAlertDetailsPath: jest.fn(),
}));

describe('EntityGovernanceBreadcrumbUtils unit tests', () => {
  describe('getBreadcrumbForTestSuite', () => {
    const testSuiteData: TestSuite = {
      name: 'testSuite',
      basicEntityReference: {
        fullyQualifiedName: 'test/testSuite',
        id: '123',
        type: 'testType',
      },
    };

    it('should get breadcrumb if data is basic', () => {
      const result = getBreadcrumbForTestSuite({
        ...testSuiteData,
        basic: true,
      });

      expect(result).toEqual([
        { iconType: EntityType.TABLE, name: '', url: undefined },
        {
          name: 'label.test-suite',
          url: '',
        },
      ]);
    });

    it('should get breadcrumb if data is not basic', () => {
      const result = getBreadcrumbForTestSuite(testSuiteData);

      expect(result).toEqual([
        { name: 'label.test-suite-plural', url: undefined },
        { name: 'testSuite', url: '' },
      ]);
    });
  });

  describe('getBreadcrumbForEventSubscription', () => {
    afterEach(() => {
      useAppModeStore.getState().setMode(DEFAULT_APP_MODE);
    });

    it.each([
      [DEFAULT_APP_MODE, '/settings/notifications/alerts'],
      [AI_APP_MODE, '#notification/alerts'],
    ])('links a notification alert to its list in %s mode', (mode, listUrl) => {
      useAppModeStore.getState().setMode(mode);

      const [list] = getBreadcrumbForEventSubscription(
        { alertType: AlertType.Notification, name: 'a1' } as EventSubscription,
        'a1',
        {} as Parameters<typeof getBreadcrumbForEventSubscription>[2]
      );

      expect(list.url).toBe(listUrl);
    });
  });
});
