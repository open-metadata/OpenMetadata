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
  Alerts,
  Archive,
  Article,
  Building01,
  Classification,
  Column,
  Compass03,
  ContextCenter,
  DataContract,
  DataObservability,
  DataProduct,
  DataQualityRules,
  FolderCheck02,
  Globe01,
  Glossary,
  Grid01,
  Home02,
  IncidentManager02,
  Lightbulb01,
  LogOut01,
  Marketplace,
  Memories,
  Metric,
  Persona,
  PlatformLineage,
  Settings01,
  Workflow,
} from '@openmetadata/ui-core-components/icons';
import { LeftSidebarItem } from '../components/MyData/LeftSidebar/LeftSidebar.interface';
import { SidebarItem } from '../enums/sidebar.enum';
import { DataInsightTabs } from '../interface/data-insight.interface';
import { createIconWithStroke, OntologyStudioIcon } from '../utils/IconUtils';
import { ENTITY_PATH, PLACEHOLDER_ROUTE_TAB, ROUTES } from './constants';

type UntitledIconType = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}>;

const DataProductIcon = createIconWithStroke(
  DataProduct as UntitledIconType,
  1.2
);

export const SIDEBAR_NESTED_KEYS = {
  [ROUTES.OBSERVABILITY_ALERTS]: ROUTES.OBSERVABILITY_ALERTS,
  [ROUTES.ONTOLOGY_EXPLORER]: ROUTES.ONTOLOGY_EXPLORER,
  [ROUTES.CONTEXT_CENTER_OVERVIEW]: ROUTES.CONTEXT_CENTER,
  [ROUTES.CONTEXT_CENTER_ARTICLES]: ROUTES.CONTEXT_CENTER,
  [ROUTES.CONTEXT_CENTER_DOCUMENTS]: ROUTES.CONTEXT_CENTER,
  [ROUTES.CONTEXT_CENTER_MEMORIES]: ROUTES.CONTEXT_CENTER,
  [ROUTES.CONTEXT_CENTER_INTEGRATIONS]: ROUTES.CONTEXT_CENTER,
  [ROUTES.CONTEXT_CENTER_AI_CONTEXT]: ROUTES.CONTEXT_CENTER,
  [ROUTES.CONTEXT_CENTER_ARCHIVE]: ROUTES.CONTEXT_CENTER,
};

export const SIDEBAR_ENTITY_PATH_ALIASES: Record<string, string> = {
  [`/${ENTITY_PATH.metrics}`]: ROUTES.METRICS,
  [`/${ENTITY_PATH.tags}`]: ROUTES.TAGS,
  '/glossary-term': ROUTES.GLOSSARY,
  '/observability/alert': ROUTES.OBSERVABILITY_ALERTS,
  '/test-case': ROUTES.INCIDENT_MANAGER,
};

export const SIDEBAR_LIST: Array<LeftSidebarItem> = [
  {
    key: ROUTES.MY_DATA,
    title: 'label.home',
    redirect_url: ROUTES.MY_DATA,
    icon: Home02,
    dataTestId: `app-bar-item-${SidebarItem.HOME}`,
  },
  {
    key: ROUTES.EXPLORE,
    title: 'label.explore',
    redirect_url: ROUTES.EXPLORE,
    icon: Compass03,
    dataTestId: `app-bar-item-${SidebarItem.EXPLORE}`,
  },
  {
    key: ROUTES.PLATFORM_LINEAGE,
    title: 'label.lineage',
    redirect_url: ROUTES.PLATFORM_LINEAGE,
    icon: PlatformLineage,
    dataTestId: `app-bar-item-${SidebarItem.LINEAGE}`,
  },
  {
    key: ROUTES.OBSERVABILITY,
    title: 'label.observability',
    icon: DataObservability,
    dataTestId: SidebarItem.OBSERVABILITY,
    children: [
      {
        key: ROUTES.DATA_QUALITY,
        title: 'label.data-quality',
        redirect_url: ROUTES.DATA_QUALITY,
        icon: DataContract,
        dataTestId: `app-bar-item-${SidebarItem.DATA_QUALITY}`,
      },
      {
        key: ROUTES.INCIDENT_MANAGER,
        title: 'label.incident-manager',
        redirect_url: ROUTES.INCIDENT_MANAGER,
        icon: IncidentManager02,
        dataTestId: `app-bar-item-${SidebarItem.INCIDENT_MANAGER}`,
      },
      {
        key: ROUTES.OBSERVABILITY_ALERTS,
        title: 'label.alert-plural',
        redirect_url: ROUTES.OBSERVABILITY_ALERTS,
        icon: Alerts,
        dataTestId: `app-bar-item-${SidebarItem.OBSERVABILITY_ALERT}`,
      },
      {
        key: ROUTES.TEST_LIBRARY,
        title: 'label.test-library',
        redirect_url: ROUTES.TEST_LIBRARY,
        icon: DataQualityRules,
        dataTestId: `app-bar-item-test-library`,
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
    icon: Lightbulb01,
    dataTestId: `app-bar-item-${SidebarItem.DATA_INSIGHT}`,
  },
  {
    key: ROUTES.DATA_MARKETPLACE_SECTION,
    title: 'label.data-marketplace-section',
    icon: Marketplace,
    dataTestId: SidebarItem.DATA_MARKETPLACE_SECTION,
    children: [
      {
        key: ROUTES.DATA_MARKETPLACE,
        title: 'label.overview',
        icon: Grid01,
        redirect_url: ROUTES.DATA_MARKETPLACE,
        dataTestId: `app-bar-item-${SidebarItem.DATA_MARKETPLACE}`,
      },
      {
        key: ROUTES.DOMAIN,
        title: 'label.domain-plural',
        redirect_url: ROUTES.DOMAIN,
        icon: Globe01,
        dataTestId: `app-bar-item-${SidebarItem.DOMAIN}`,
      },
      {
        key: ROUTES.DATA_PRODUCT,
        title: 'label.data-product-plural',
        redirect_url: ROUTES.DATA_PRODUCT,
        icon: DataProductIcon,
        dataTestId: `app-bar-item-${SidebarItem.DATA_PRODUCT}`,
      },
    ],
  },
  {
    key: 'governance',
    title: 'label.govern',
    icon: Building01,
    dataTestId: SidebarItem.GOVERNANCE,
    children: [
      {
        key: ROUTES.GLOSSARY,
        title: 'label.glossary',
        redirect_url: ROUTES.GLOSSARY,
        icon: Glossary,
        dataTestId: `app-bar-item-${SidebarItem.GLOSSARY}`,
      },
      {
        key: ROUTES.ONTOLOGY_EXPLORER,
        title: 'label.ontology-studio',
        redirect_url: ROUTES.ONTOLOGY_EXPLORER,
        icon: OntologyStudioIcon,
        dataTestId: `app-bar-item-${SidebarItem.ONTOLOGY_EXPLORER}`,
      },
      {
        key: ROUTES.TAGS,
        title: 'label.classification',
        redirect_url: ROUTES.TAGS,
        icon: Classification,
        dataTestId: `app-bar-item-${SidebarItem.TAGS}`,
      },
      {
        key: ROUTES.METRICS,
        title: 'label.metric-plural',
        redirect_url: ROUTES.METRICS,
        icon: Metric,
        dataTestId: `app-bar-item-${SidebarItem.METRICS}`,
      },
      {
        key: ROUTES.COLUMN_BULK_OPERATIONS,
        title: 'label.column-bulk-operations',
        redirect_url: ROUTES.COLUMN_BULK_OPERATIONS,
        icon: Column,
        dataTestId: `app-bar-item-${SidebarItem.COLUMN_BULK_OPERATIONS}`,
      },
      {
        key: ROUTES.WORKFLOWS,
        title: 'label.workflow-plural',
        redirect_url: ROUTES.WORKFLOWS,
        icon: Workflow,
        dataTestId: `app-bar-item-${SidebarItem.WORKFLOWS}`,
      },
    ],
  },
  {
    key: ROUTES.CONTEXT_CENTER,
    title: 'label.context-center',
    icon: ContextCenter,
    dataTestId: SidebarItem.CONTEXT_CENTER,
    children: [
      {
        key: ROUTES.CONTEXT_CENTER_OVERVIEW,
        title: 'label.overview',
        redirect_url: ROUTES.CONTEXT_CENTER_OVERVIEW,
        icon: Grid01,
        dataTestId: `app-bar-item-${SidebarItem.OVERVIEW}`,
      },
      {
        key: ROUTES.CONTEXT_CENTER_AI_CONTEXT,
        title: 'label.ai-context',
        redirect_url: ROUTES.CONTEXT_CENTER_AI_CONTEXT,
        icon: Persona,
        dataTestId: `app-bar-item-${SidebarItem.AI_CONTEXT}`,
      },
      {
        key: ROUTES.CONTEXT_CENTER_ARTICLES,
        title: 'label.article-plural',
        redirect_url: ROUTES.CONTEXT_CENTER_ARTICLES,
        icon: Article,
        dataTestId: `app-bar-item-${SidebarItem.ARTICLES}`,
      },
      {
        key: ROUTES.CONTEXT_CENTER_DOCUMENTS,
        title: 'label.document-plural',
        redirect_url: ROUTES.CONTEXT_CENTER_DOCUMENTS,
        icon: FolderCheck02,
        dataTestId: `app-bar-item-${SidebarItem.DOCUMENTS}`,
      },
      {
        key: ROUTES.CONTEXT_CENTER_MEMORIES,
        title: 'label.memory-plural',
        redirect_url: ROUTES.CONTEXT_CENTER_MEMORIES,
        icon: Memories,
        dataTestId: `app-bar-item-${SidebarItem.MEMORIES}`,
      },
      {
        key: ROUTES.CONTEXT_CENTER_ARCHIVE,
        title: 'label.archive',
        redirect_url: ROUTES.CONTEXT_CENTER_ARCHIVE,
        icon: Archive,
        dataTestId: `app-bar-item-context-center-archive`,
      },
    ],
  },
];

export const SETTING_ITEM = {
  key: ROUTES.SETTINGS,
  title: 'label.setting-plural',
  redirect_url: ROUTES.SETTINGS,
  icon: Settings01,
  dataTestId: `app-bar-item-${SidebarItem.SETTINGS}`,
};

export const LOGOUT_ITEM = {
  key: SidebarItem.LOGOUT,
  title: 'label.logout',
  icon: LogOut01,
  dataTestId: `app-bar-item-${SidebarItem.LOGOUT}`,
};
