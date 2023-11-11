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
import {
  PLACEHOLDER_ACTION,
  PLACEHOLDER_ROUTE_FQN,
  PLACEHOLDER_ROUTE_TAB,
  PLACEHOLDER_SETTING_CATEGORY,
  ROUTES,
} from '../constants/constants';
import { getSettingPath, getSettingsPathWithFqn } from './RouterUtils';

describe('Global Setting routes', () => {
  describe('getSettingPath', () => {
    it('should return default path when category and tab are undefined', () => {
      const path = getSettingPath();

      expect(path).toEqual(ROUTES.SETTINGS);
    });

    it('should return default path when tab is undefined', () => {
      const category = 'exampleCategory';
      const path = getSettingPath(category);

      expect(path).toEqual(ROUTES.SETTINGS);
    });

    it('should return default path when category is undefined', () => {
      const tab = 'exampleTab';
      const path = getSettingPath(undefined, tab);

      expect(path).toEqual(ROUTES.SETTINGS);
    });

    it('should return path with category and tab when withFqn is false', () => {
      const category = 'exampleCategory';
      const tab = 'exampleTab';
      const path = getSettingPath(category, tab);
      const expectedPath = ROUTES.SETTINGS_WITH_TAB.replace(
        PLACEHOLDER_ROUTE_TAB,
        tab
      ).replace(PLACEHOLDER_SETTING_CATEGORY, category);

      expect(path).toEqual(expectedPath);
    });

    it('should return path with category, tab, and action when withFqn and withAction are true', () => {
      const category = 'exampleCategory';
      const tab = 'exampleTab';
      const withFqn = true;
      const withAction = true;
      const path = getSettingPath(category, tab, withFqn, withAction);
      const expectedPath = ROUTES.SETTINGS_WITH_TAB_FQN_ACTION.replace(
        PLACEHOLDER_ROUTE_TAB,
        tab
      ).replace(PLACEHOLDER_SETTING_CATEGORY, category);

      expect(path).toEqual(expectedPath);
    });

    it('should return path with category and tab when withFqn is true and withAction is false', () => {
      const category = 'exampleCategory';
      const tab = 'exampleTab';
      const withFqn = true;
      const withAction = false;
      const path = getSettingPath(category, tab, withFqn, withAction);
      const expectedPath = ROUTES.SETTINGS_WITH_TAB_FQN.replace(
        PLACEHOLDER_ROUTE_TAB,
        tab
      ).replace(PLACEHOLDER_SETTING_CATEGORY, category);

      expect(path).toEqual(expectedPath);
    });
  });

  describe('getSettingsPathWithFqn', () => {
    it('should return path with category, tab, and fqn when action is undefined', () => {
      const category = 'exampleCategory';
      const tab = 'exampleTab';
      const fqn = 'exampleFqn';
      const path = getSettingsPathWithFqn(category, tab, fqn);
      const expectedPath = ROUTES.SETTINGS_WITH_TAB_FQN.replace(
        PLACEHOLDER_ROUTE_TAB,
        tab
      )
        .replace(PLACEHOLDER_SETTING_CATEGORY, category)
        .replace(PLACEHOLDER_ROUTE_FQN, fqn);

      expect(path).toEqual(expectedPath);
    });

    it('should return path with category, tab, fqn, and action when action is defined', () => {
      const category = 'exampleCategory';
      const tab = 'exampleTab';
      const fqn = 'exampleFqn';
      const action = 'exampleAction';
      const path = getSettingsPathWithFqn(category, tab, fqn, action);
      const expectedPath = ROUTES.SETTINGS_WITH_TAB_FQN_ACTION.replace(
        PLACEHOLDER_ROUTE_TAB,
        tab
      )
        .replace(PLACEHOLDER_SETTING_CATEGORY, category)
        .replace(PLACEHOLDER_ROUTE_FQN, fqn)
        .replace(PLACEHOLDER_ACTION, action);

      expect(path).toEqual(expectedPath);
    });
  });
});
