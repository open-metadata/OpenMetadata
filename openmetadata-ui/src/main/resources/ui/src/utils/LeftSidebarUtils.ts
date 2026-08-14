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
import { PLACEHOLDER_ROUTE_FQN, ROUTES } from '../constants/constants';
import { SIDEBAR_ENTITY_PATH_ALIASES } from '../constants/LeftSidebar.constants';

interface BreadcrumbLocationState {
  breadcrumbData?: Array<{ url?: string }>;
}

const TEST_CASE_ROUTE_PREFIX = ROUTES.TEST_CASE_DETAILS.replace(
  `/${PLACEHOLDER_ROUTE_FQN}`,
  ''
);
const TEST_SUITE_ROUTE_PREFIX = ROUTES.TEST_SUITES_WITH_FQN.replace(
  `/${PLACEHOLDER_ROUTE_FQN}`,
  ''
);

export const getSidebarPathname = (
  pathname: string,
  locationState: unknown
): string => {
  const originUrl = (locationState as BreadcrumbLocationState | null)
    ?.breadcrumbData?.[0]?.url;

  if (originUrl) {
    return originUrl;
  }

  if (pathname.startsWith(`${TEST_CASE_ROUTE_PREFIX}/`)) {
    return ROUTES.INCIDENT_MANAGER;
  }

  if (pathname.startsWith(`${TEST_SUITE_ROUTE_PREFIX}/`)) {
    return ROUTES.DATA_QUALITY;
  }

  return pathname;
};

export const getSidebarActiveKeys = (
  pathname: string,
  nestedKeys: Record<string, string>,
  aliases: Record<string, string> = SIDEBAR_ENTITY_PATH_ALIASES
): string[] => {
  const pathArray = pathname.split('/');
  const deepPath = [...pathArray].splice(0, 3).join('/');

  if (nestedKeys[deepPath]) {
    return [deepPath];
  }

  if (aliases[deepPath]) {
    return [aliases[deepPath]];
  }

  const shallowPath = pathArray.splice(0, 2).join('/');

  return [aliases[shallowPath] ?? shallowPath];
};
