/*
 *  Copyright 2021 Collate
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

import { ProfilerDashboardTab } from '../components/ProfilerDashboard/profilerDashboard.interface';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import {
  IN_PAGE_SEARCH_ROUTES,
  PLACEHOLDER_DASHBOARD_TYPE,
  PLACEHOLDER_ENTITY_TYPE_FQN,
  PLACEHOLDER_GLOSSARY_NAME,
  PLACEHOLDER_GLOSSARY_TERMS_FQN,
  PLACEHOLDER_ROUTE_FQN,
  PLACEHOLDER_ROUTE_INGESTION_FQN,
  PLACEHOLDER_ROUTE_INGESTION_TYPE,
  PLACEHOLDER_ROUTE_SEARCHQUERY,
  PLACEHOLDER_ROUTE_SERVICE_CAT,
  PLACEHOLDER_ROUTE_SERVICE_FQN,
  PLACEHOLDER_ROUTE_TAB,
  PLACEHOLDER_RULE_NAME,
  PLACEHOLDER_SETTING_CATEGORY,
  PLACEHOLDER_TAG_NAME,
  PLACEHOLDER_TEST_SUITE_FQN,
  ROUTES,
} from '../constants/constants';
import { initialFilterQS } from '../constants/explore.constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../constants/globalSettings.constants';
import { ProfilerDashboardType } from '../enums/table.enum';

export const isDashboard = (pathname: string): boolean => {
  return pathname === ROUTES.FEEDS;
};

export const isInPageSearchAllowed = (pathname: string): boolean => {
  return Boolean(
    Object.keys(IN_PAGE_SEARCH_ROUTES).find((route) => pathname.includes(route))
  );
};

export const inPageSearchOptions = (pathname: string): Array<string> => {
  let strOptions: Array<string> = [];
  for (const route in IN_PAGE_SEARCH_ROUTES) {
    if (pathname.includes(route)) {
      strOptions = IN_PAGE_SEARCH_ROUTES[route];

      break;
    }
  }

  return strOptions;
};

export const getAddServicePath = (serviceCategory: string) => {
  let path = ROUTES.ADD_SERVICE;
  path = path.replace(PLACEHOLDER_ROUTE_SERVICE_CAT, serviceCategory);

  return path;
};

export const getEditConnectionPath = (
  serviceCategory: string,
  serviceFQN: string
) => {
  let path = ROUTES.EDIT_SERVICE_CONNECTION;
  path = path
    .replace(PLACEHOLDER_ROUTE_SERVICE_CAT, serviceCategory)
    .replace(PLACEHOLDER_ROUTE_SERVICE_FQN, serviceFQN)
    .replace(PLACEHOLDER_ROUTE_TAB, 'connection');

  return path;
};

export const getPathByServiceFQN = (
  serviceCategory: string,
  serviceFQN: string
) => {
  let path = ROUTES.SERVICE_WITH_TAB;
  path = path
    .replace(PLACEHOLDER_ROUTE_SERVICE_CAT, serviceCategory)
    .replace(PLACEHOLDER_ROUTE_SERVICE_FQN, serviceFQN)
    .replace(PLACEHOLDER_ROUTE_TAB, 'connection');

  return path;
};

export const getAddIngestionPath = (
  serviceCategory: string,
  serviceFQN: string,
  ingestionType: string
) => {
  let path = ROUTES.ADD_INGESTION;
  path = path
    .replace(PLACEHOLDER_ROUTE_SERVICE_CAT, serviceCategory)
    .replace(PLACEHOLDER_ROUTE_SERVICE_FQN, serviceFQN)
    .replace(PLACEHOLDER_ROUTE_INGESTION_TYPE, ingestionType);

  return path;
};

export const getEditIngestionPath = (
  serviceCategory: string,
  serviceFQN: string,
  ingestionFQN: string,
  ingestionType: string
) => {
  let path = ROUTES.EDIT_INGESTION;
  path = path
    .replace(PLACEHOLDER_ROUTE_SERVICE_CAT, serviceCategory)
    .replace(PLACEHOLDER_ROUTE_SERVICE_FQN, serviceFQN)
    .replace(PLACEHOLDER_ROUTE_INGESTION_FQN, ingestionFQN)
    .replace(PLACEHOLDER_ROUTE_INGESTION_TYPE, ingestionType);

  return path;
};

/**
 *
 * @param searchQuery search text
 * @param tab selected explore result tab
 * @param filter selected facet filters
 * @returns
 */
export const getExplorePathWithInitFilters = (
  searchQuery = '',
  tab = 'tables',
  filter = ''
) => {
  let path = ROUTES.EXPLORE_WITH_SEARCH;
  path = path
    .replace(PLACEHOLDER_ROUTE_SEARCHQUERY, searchQuery)
    .replace(PLACEHOLDER_ROUTE_TAB, tab);

  return filter
    ? `${path}?${initialFilterQS}=${encodeURIComponent(filter)}`
    : path;
};

export const getGlossaryPath = (fqn?: string) => {
  let path = ROUTES.GLOSSARY;
  if (fqn) {
    path = ROUTES.GLOSSARY_DETAILS;
    path = path.replace(PLACEHOLDER_GLOSSARY_NAME, fqn);
  }

  return path;
};

export const getParentGlossaryPath = (fqn?: string) => {
  if (fqn) {
    const parts = fqn.split(FQN_SEPARATOR_CHAR);
    if (parts.length > 1) {
      // remove the last part to get parent FQN
      fqn = parts.slice(0, -1).join(FQN_SEPARATOR_CHAR);
    }
  }

  return getGlossaryPath(fqn);
};

export const getGlossaryTermsPath = (
  glossaryName: string,
  glossaryTerm = ''
) => {
  let path = glossaryTerm ? ROUTES.GLOSSARY_TERMS : ROUTES.GLOSSARY_DETAILS;
  path = path.replace(PLACEHOLDER_GLOSSARY_NAME, glossaryName);

  if (glossaryTerm) {
    path = path.replace(PLACEHOLDER_GLOSSARY_TERMS_FQN, glossaryTerm);
  }

  return path;
};

export const getAddGlossaryTermsPath = (
  glossaryName: string,
  glossaryTerm = ''
) => {
  let path = glossaryTerm
    ? ROUTES.ADD_GLOSSARY_TERMS_CHILD
    : ROUTES.ADD_GLOSSARY_TERMS;
  path = path.replace(PLACEHOLDER_GLOSSARY_NAME, glossaryName);

  if (glossaryTerm) {
    path = path.replace(PLACEHOLDER_GLOSSARY_TERMS_FQN, glossaryTerm);
  }

  return path;
};

export const getSettingPath = (
  category?: string,
  tab?: string,
  withFqn = false
) => {
  let path = '';
  if (withFqn) {
    path = ROUTES.SETTINGS_WITH_TAB_FQN;
  } else {
    path = tab && category ? ROUTES.SETTINGS_WITH_TAB : ROUTES.SETTINGS;
  }

  if (tab && category) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
    path = path.replace(PLACEHOLDER_SETTING_CATEGORY, category);
  }

  return path;
};

export const getSettingCategoryPath = (category: string) => {
  let path = ROUTES.SETTINGS_WITH_TAB;

  if (category) {
    path = path.replace(PLACEHOLDER_SETTING_CATEGORY, category);
  }

  return path;
};

export const getTeamsWithFqnPath = (fqn: string) => {
  let path = ROUTES.SETTINGS_WITH_TAB_FQN;

  path = path
    .replace(PLACEHOLDER_SETTING_CATEGORY, GlobalSettingsMenuCategory.MEMBERS)
    .replace(PLACEHOLDER_ROUTE_TAB, GlobalSettingOptions.TEAMS)
    .replace(PLACEHOLDER_ROUTE_FQN, fqn);

  return path;
};

export const getRoleWithFqnPath = (fqn: string) => {
  let path = ROUTES.SETTINGS_WITH_TAB_FQN;

  path = path
    .replace(PLACEHOLDER_SETTING_CATEGORY, GlobalSettingsMenuCategory.ACCESS)
    .replace(PLACEHOLDER_ROUTE_TAB, GlobalSettingOptions.ROLES)
    .replace(PLACEHOLDER_ROUTE_FQN, fqn);

  return path;
};

export const getPolicyWithFqnPath = (fqn: string) => {
  let path = ROUTES.SETTINGS_WITH_TAB_FQN;

  path = path
    .replace(PLACEHOLDER_SETTING_CATEGORY, GlobalSettingsMenuCategory.ACCESS)
    .replace(PLACEHOLDER_ROUTE_TAB, GlobalSettingOptions.POLICIES)
    .replace(PLACEHOLDER_ROUTE_FQN, fqn);

  return path;
};

export const getPath = (pathName: string) => {
  switch (pathName) {
    case GlobalSettingOptions.TEAMS:
      return getSettingPath(
        GlobalSettingsMenuCategory.ACCESS,
        GlobalSettingOptions.TEAMS
      );

    case GlobalSettingOptions.USERS:
      return getSettingPath(
        GlobalSettingsMenuCategory.ACCESS,
        GlobalSettingOptions.USERS
      );

    case GlobalSettingOptions.ROLES:
      return getSettingPath(
        GlobalSettingsMenuCategory.ACCESS,
        GlobalSettingOptions.ROLES
      );

    case GlobalSettingOptions.POLICIES:
      return getSettingPath(
        GlobalSettingsMenuCategory.ACCESS,
        GlobalSettingOptions.POLICIES
      );

    default:
      return getSettingPath();
  }
};

export const getProfilerDashboardWithFqnPath = (
  dashboardType: ProfilerDashboardType,
  entityTypeFQN: string,
  tab?: ProfilerDashboardTab
) => {
  let path = tab
    ? ROUTES.PROFILER_DASHBOARD_WITH_TAB
    : ROUTES.PROFILER_DASHBOARD;

  path = path
    .replace(PLACEHOLDER_DASHBOARD_TYPE, dashboardType)
    .replace(PLACEHOLDER_ENTITY_TYPE_FQN, entityTypeFQN);

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  return path;
};

export const getAddPolicyRulePath = (fqn: string) => {
  let path = ROUTES.ADD_POLICY_RULE;

  path = path.replace(PLACEHOLDER_ROUTE_FQN, fqn);

  return path;
};

export const getEditPolicyRulePath = (fqn: string, ruleName: string) => {
  let path = ROUTES.EDIT_POLICY_RULE;

  path = path
    .replace(PLACEHOLDER_ROUTE_FQN, fqn)
    .replace(PLACEHOLDER_RULE_NAME, ruleName);

  return path;
};

export const getTagPath = (fqn?: string) => {
  let path = ROUTES.TAGS;
  if (fqn) {
    path = ROUTES.TAG_DETAILS;
    path = path.replace(PLACEHOLDER_TAG_NAME, fqn);
  }

  return path;
};

export const getAddDataQualityTableTestPath = (
  dashboardType: string,
  fqn: string
) => {
  let path = ROUTES.ADD_DATA_QUALITY_TEST_CASE;

  path = path
    .replace(PLACEHOLDER_DASHBOARD_TYPE, dashboardType)
    .replace(PLACEHOLDER_ENTITY_TYPE_FQN, fqn);

  return path;
};

export const getTestSuitePath = (testSuiteName: string) => {
  let path = ROUTES.TEST_SUITES;
  path = path.replace(PLACEHOLDER_TEST_SUITE_FQN, testSuiteName);

  return path;
};

export const getTestSuiteIngestionPath = (
  testSuiteName: string,
  ingestionFQN?: string
) => {
  let path = ingestionFQN
    ? ROUTES.TEST_SUITES_EDIT_INGESTION
    : ROUTES.TEST_SUITES_ADD_INGESTION;
  path = path.replace(PLACEHOLDER_TEST_SUITE_FQN, testSuiteName);

  if (ingestionFQN) {
    path = path.replace(PLACEHOLDER_ROUTE_INGESTION_FQN, ingestionFQN);
  }

  return path;
};
