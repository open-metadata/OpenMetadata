/*
 *  Copyright 2026 Collate.
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

/**
 * Route builders with a leaf dependency set (route constants and one string
 * helper), split out of RouterUtils so a caller that needs only a profile URL
 * does not pull in RouterUtils' 900-line graph -- qs, lodash, the marketplace
 * store and the service constants. RouterUtils re-exports these, so existing
 * imports keep working; import from here when the call site is on a hot path
 * such as the app entry.
 */
import {
  PLACEHOLDER_ROUTE_FQN,
  PLACEHOLDER_ROUTE_SUB_TAB,
  PLACEHOLDER_ROUTE_TAB,
  PLACEHOLDER_SETTING_CATEGORY,
  ROUTES,
} from '../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../constants/GlobalSettings.constants';
import { EntityTabs } from '../enums/entity.enum';
import { getEncodedFqn } from './StringUtils';

export const getSettingPath = (
  category?: string,
  tab?: string,
  withFqn = false,
  withAction = false
) => {
  let path = ROUTES.SETTINGS;

  if (tab && category) {
    if (withFqn) {
      path = withAction
        ? ROUTES.SETTINGS_WITH_TAB_FQN_ACTION
        : ROUTES.SETTINGS_WITH_TAB_FQN;
    } else {
      path = ROUTES.SETTINGS_WITH_TAB;
    }

    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
    path = path.replace(PLACEHOLDER_SETTING_CATEGORY, category);
  } else if (category) {
    path = withFqn
      ? ROUTES.SETTINGS_WITH_CATEGORY_FQN
      : ROUTES.SETTINGS_WITH_CATEGORY;

    path = path.replace(PLACEHOLDER_SETTING_CATEGORY, category);
  }

  return path;
};

export const getTeamAndUserDetailsPath = (name?: string) => {
  let path = getSettingPath(
    GlobalSettingsMenuCategory.MEMBERS,
    GlobalSettingOptions.TEAMS
  );
  if (name) {
    path = getSettingPath(
      GlobalSettingsMenuCategory.MEMBERS,
      GlobalSettingOptions.TEAMS,
      true
    );
    path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(name));
  }

  return path;
};

export const getUserPath = (username: string, tab?: string, subTab = 'all') => {
  let path = tab ? ROUTES.USER_PROFILE_WITH_TAB : ROUTES.USER_PROFILE;

  if (tab === EntityTabs.ACTIVITY_FEED) {
    path = ROUTES.USER_PROFILE_WITH_SUB_TAB;
    path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
  }

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }
  path = path.replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(username));

  return path;
};
