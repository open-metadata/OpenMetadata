/*
 *  Copyright 2024 Collate.
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
export enum SidebarItem {
  EXPLORE = 'explore',
  OBSERVABILITY = 'observability',
  DATA_QUALITY = 'data-quality',
  INCIDENT_MANAGER = 'incident-manager',
  OBSERVABILITY_ALERT = 'observability-alert',
  DATA_INSIGHT = 'data-insight',
  DOMAIN = 'domain',
  GOVERNANCE = 'governance',
  GLOSSARY = 'glossary',
  TAGS = 'tags',
  INSIGHTS = 'data-insight',
  SETTINGS = 'settings',
  LOGOUT = 'logout',
  METRICS = 'metrics',
  LINEAGE = 'lineage',
}

export const SIDEBAR_LIST_ITEMS = {
  [SidebarItem.DATA_QUALITY]: [
    SidebarItem.OBSERVABILITY,
    SidebarItem.DATA_QUALITY,
  ],
  [SidebarItem.INCIDENT_MANAGER]: [
    SidebarItem.OBSERVABILITY,
    SidebarItem.INCIDENT_MANAGER,
  ],
  [SidebarItem.OBSERVABILITY_ALERT]: [
    SidebarItem.OBSERVABILITY,
    SidebarItem.OBSERVABILITY_ALERT,
  ],
  [SidebarItem.GLOSSARY]: [SidebarItem.GOVERNANCE, SidebarItem.GLOSSARY],
  [SidebarItem.TAGS]: [SidebarItem.GOVERNANCE, SidebarItem.TAGS],
  [SidebarItem.METRICS]: [SidebarItem.GOVERNANCE, SidebarItem.METRICS],

  // Profile Dropdown
  'user-name': ['dropdown-profile', 'user-name'],
};
