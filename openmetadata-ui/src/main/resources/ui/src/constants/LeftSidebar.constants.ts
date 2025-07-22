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

import i18next from 'i18next';
import { ReactComponent as GovernIcon } from '../assets/svg/bank.svg';
import { ReactComponent as ClassificationIcon } from '../assets/svg/classification.svg';
import { ReactComponent as DataProductIcon } from '../assets/svg/data-product.svg';
import { ReactComponent as ExploreIcon } from '../assets/svg/explore.svg';
import { ReactComponent as GlossaryIcon } from '../assets/svg/glossary.svg';
import { ReactComponent as AlertIcon } from '../assets/svg/ic-alert.svg';
import { ReactComponent as DataQualityIcon } from '../assets/svg/ic-data-contract.svg';
import { ReactComponent as DomainsIcon } from '../assets/svg/ic-domain.svg';
import { ReactComponent as HomeIcon } from '../assets/svg/ic-home.svg';
import { ReactComponent as IncidentMangerIcon } from '../assets/svg/ic-incident-manager.svg';
import { ReactComponent as ObservabilityIcon } from '../assets/svg/ic-observability.svg';
import { ReactComponent as PlatformLineageIcon } from '../assets/svg/ic-platform-lineage.svg';
import { ReactComponent as SettingsIcon } from '../assets/svg/ic-settings-v1.svg';
import { ReactComponent as InsightsIcon } from '../assets/svg/lamp-charge.svg';
import { ReactComponent as LogoutIcon } from '../assets/svg/logout.svg';
import { ReactComponent as MetricIcon } from '../assets/svg/metric.svg';
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
  // TODO: Remove this after new experience is fully complete
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
    key: `${SidebarItem.DOMAINS}-new`,
    title: `${i18next.t('label.domain-plural')} (New)`,
    icon: DomainsIcon,
    dataTestId: `app-bar-item-${SidebarItem.DOMAINS}-new`,
    children: [
      {
        key: ROUTES.DOMAINS,
        title: i18next.t('label.domain'),
        redirect_url: ROUTES.DOMAINS,
        icon: DomainsIcon,
        dataTestId: `app-bar-item-${SidebarItem.DOMAINS}`,
      },
      {
        key: ROUTES.DATA_PRODUCTS,
        title: i18next.t('label.data-product'),
        redirect_url: ROUTES.DATA_PRODUCTS,
        icon: DataProductIcon,
        dataTestId: `app-bar-item-${SidebarItem.DATA_PRODUCTS}`,
      },
    ],
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
