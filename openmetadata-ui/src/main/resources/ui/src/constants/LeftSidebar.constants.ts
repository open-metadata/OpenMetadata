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

import GovernIcon from '../assets/svg/bank.svg?react';
import ClassificationIcon from '../assets/svg/classification.svg?react';
import ExploreIcon from '../assets/svg/explore.svg?react';
import GlossaryIcon from '../assets/svg/glossary.svg?react';
import AlertIcon from '../assets/svg/ic-alert.svg?react';
import DataQualityIcon from '../assets/svg/ic-data-contract.svg?react';
import DomainsIcon from '../assets/svg/ic-domain.svg?react';
import HomeIcon from '../assets/svg/ic-home.svg?react';
import IncidentMangerIcon from '../assets/svg/ic-incident-manager.svg?react';
import ObservabilityIcon from '../assets/svg/ic-observability.svg?react';
import PlatformLineageIcon from '../assets/svg/ic-platform-lineage.svg?react';
import SettingsIcon from '../assets/svg/ic-settings-v1.svg?react';
import InsightsIcon from '../assets/svg/lamp-charge.svg?react';
import LogoutIcon from '../assets/svg/logout.svg?react';
import MetricIcon from '../assets/svg/metric.svg?react';
import { LeftSidebarItem } from '../components/MyData/LeftSidebar/LeftSidebar.interface';
import { SidebarItem } from '../enums/sidebar.enum';
import { DataInsightTabs } from '../interface/data-insight.interface';
import { PLACEHOLDER_ROUTE_TAB, ROUTES } from './constants';

export const SIDEBAR_NESTED_KEYS = {
  [ROUTES.OBSERVABILITY_ALERTS]: ROUTES.OBSERVABILITY_ALERTS,
};

export const SIDEBAR_LIST: Array<LeftSidebarItem> = [
  {
    key: ROUTES.MY_DATA,
    title: 'label.home',
    redirect_url: ROUTES.MY_DATA,
    icon: HomeIcon,
    dataTestId: `app-bar-item-${SidebarItem.HOME}`,
  },
  {
    key: ROUTES.EXPLORE,
    title: 'label.explore',
    redirect_url: ROUTES.EXPLORE,
    icon: ExploreIcon,
    dataTestId: `app-bar-item-${SidebarItem.EXPLORE}`,
  },
  {
    key: ROUTES.PLATFORM_LINEAGE,
    title: 'label.lineage',
    redirect_url: ROUTES.PLATFORM_LINEAGE,
    icon: PlatformLineageIcon,
    dataTestId: `app-bar-item-${SidebarItem.LINEAGE}`,
  },
  {
    key: ROUTES.OBSERVABILITY,
    title: 'label.observability',
    icon: ObservabilityIcon,
    dataTestId: SidebarItem.OBSERVABILITY,
    children: [
      {
        key: ROUTES.DATA_QUALITY,
        title: 'label.data-quality',
        redirect_url: ROUTES.DATA_QUALITY,
        icon: DataQualityIcon,
        dataTestId: `app-bar-item-${SidebarItem.DATA_QUALITY}`,
      },
      {
        key: ROUTES.INCIDENT_MANAGER,
        title: 'label.incident-manager',
        redirect_url: ROUTES.INCIDENT_MANAGER,
        icon: IncidentMangerIcon,
        dataTestId: `app-bar-item-${SidebarItem.INCIDENT_MANAGER}`,
      },
      {
        key: ROUTES.OBSERVABILITY_ALERTS,
        title: 'label.alert-plural',
        redirect_url: ROUTES.OBSERVABILITY_ALERTS,
        icon: AlertIcon,
        dataTestId: `app-bar-item-${SidebarItem.OBSERVABILITY_ALERT}`,
      },
    ],
  },
  {
    key: ROUTES.DATA_INSIGHT,
    title: 'label.insight-plural',
    redirect_url: ROUTES.DATA_INSIGHT_WITH_TAB.replace(
      PLACEHOLDER_ROUTE_TAB,
      DataInsightTabs.DATA_ASSETS
    ),
    icon: InsightsIcon,
    dataTestId: `app-bar-item-${SidebarItem.DATA_INSIGHT}`,
  },
  {
    key: ROUTES.DOMAIN,
    title: 'label.domain-plural',
    redirect_url: ROUTES.DOMAIN,
    icon: DomainsIcon,
    dataTestId: `app-bar-item-${SidebarItem.DOMAIN}`,
  },
  {
    key: 'governance',
    title: 'label.govern',
    icon: GovernIcon,
    dataTestId: SidebarItem.GOVERNANCE,
    children: [
      {
        key: ROUTES.GLOSSARY,
        title: 'label.glossary',
        redirect_url: ROUTES.GLOSSARY,
        icon: GlossaryIcon,
        dataTestId: `app-bar-item-${SidebarItem.GLOSSARY}`,
      },
      {
        key: ROUTES.TAGS,
        title: 'label.classification',
        redirect_url: ROUTES.TAGS,
        icon: ClassificationIcon,
        dataTestId: `app-bar-item-${SidebarItem.TAGS}`,
      },
      {
        key: ROUTES.METRICS,
        title: 'label.metric-plural',
        redirect_url: ROUTES.METRICS,
        icon: MetricIcon,
        dataTestId: `app-bar-item-${SidebarItem.METRICS}`,
      },
    ],
  },
];

export const SETTING_ITEM = {
  key: ROUTES.SETTINGS,
  title: 'label.setting-plural',
  redirect_url: ROUTES.SETTINGS,
  icon: SettingsIcon,
  dataTestId: `app-bar-item-${SidebarItem.SETTINGS}`,
};

export const LOGOUT_ITEM = {
  key: SidebarItem.LOGOUT,
  title: 'label.logout',
  icon: LogoutIcon,
  dataTestId: `app-bar-item-${SidebarItem.LOGOUT}`,
};
