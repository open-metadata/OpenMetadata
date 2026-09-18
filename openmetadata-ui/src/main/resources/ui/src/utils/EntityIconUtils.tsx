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

import classNames from 'classnames';
import { CSSProperties, ElementType } from 'react';
import { ReactComponent as GovernanceIcon } from '../assets/svg/ic-governance.svg';
import { ReactComponent as LocationIcon } from '../assets/svg/location.svg';
import { ENTITY_ICON_MAPPER } from '../constants/Assets.constants';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';

const entityIconMapping: Record<string, ElementType> = {
  [SearchIndex.DATABASE]: ENTITY_ICON_MAPPER[EntityType.DATABASE].icon,
  [SearchIndex.DATABASE_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.DATABASE_SERVICE].icon,
  [SearchIndex.DATABASE_SCHEMA]:
    ENTITY_ICON_MAPPER[EntityType.DATABASE_SCHEMA].icon,
  [SearchIndex.TOPIC]: ENTITY_ICON_MAPPER[EntityType.TOPIC].icon,
  [EntityType.MESSAGING_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.MESSAGING_SERVICE].icon,
  [SearchIndex.DASHBOARD]: ENTITY_ICON_MAPPER[EntityType.DASHBOARD].icon,
  [EntityType.DASHBOARD_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.DASHBOARD_SERVICE].icon,
  [SearchIndex.MLMODEL]: ENTITY_ICON_MAPPER[EntityType.MLMODEL].icon,
  [EntityType.MLMODEL_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.MLMODEL_SERVICE].icon,
  [SearchIndex.PIPELINE]: ENTITY_ICON_MAPPER[EntityType.PIPELINE].icon,
  [EntityType.PIPELINE_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.PIPELINE_SERVICE].icon,
  [SearchIndex.CONTAINER]: ENTITY_ICON_MAPPER[EntityType.CONTAINER].icon,
  [EntityType.STORAGE_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.STORAGE_SERVICE].icon,
  [SearchIndex.DASHBOARD_DATA_MODEL]:
    ENTITY_ICON_MAPPER[EntityType.DASHBOARD_DATA_MODEL].icon,
  [SearchIndex.STORED_PROCEDURE]:
    ENTITY_ICON_MAPPER[EntityType.STORED_PROCEDURE].icon,
  [EntityType.CLASSIFICATION]:
    ENTITY_ICON_MAPPER[EntityType.CLASSIFICATION].icon,
  [SearchIndex.TAG]: ENTITY_ICON_MAPPER[EntityType.TAG].icon,
  [SearchIndex.GLOSSARY]: ENTITY_ICON_MAPPER[EntityType.GLOSSARY].icon,
  [SearchIndex.GLOSSARY_TERM]:
    ENTITY_ICON_MAPPER[EntityType.GLOSSARY_TERM].icon,
  [SearchIndex.DOMAIN]: ENTITY_ICON_MAPPER[EntityType.DOMAIN].icon,
  [SearchIndex.CHART]: ENTITY_ICON_MAPPER[EntityType.CHART].icon,
  [SearchIndex.TABLE]: ENTITY_ICON_MAPPER[EntityType.TABLE].icon,
  [SearchIndex.COLUMN]: ENTITY_ICON_MAPPER[EntityType.TABLE_COLUMN].icon,
  [SearchIndex.ML_MODEL_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.MLMODEL_SERVICE].icon,
  [EntityType.METADATA_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.METADATA_SERVICE].icon,
  [SearchIndex.DATA_PRODUCT]: ENTITY_ICON_MAPPER[EntityType.DATA_PRODUCT].icon,
  [EntityType.TEST_CASE]: ENTITY_ICON_MAPPER[EntityType.TEST_CASE].icon,
  [EntityType.TEST_SUITE]: ENTITY_ICON_MAPPER[EntityType.TEST_SUITE].icon,
  [EntityType.DATA_CONTRACT]: ENTITY_ICON_MAPPER[EntityType.DATA_CONTRACT].icon,
  [EntityType.BOT]: ENTITY_ICON_MAPPER[EntityType.BOT].icon,
  [EntityType.TEAM]: ENTITY_ICON_MAPPER[EntityType.TEAM].icon,
  [EntityType.APPLICATION]: ENTITY_ICON_MAPPER[EntityType.APPLICATION].icon,
  [EntityType.PERSONA]: ENTITY_ICON_MAPPER[EntityType.PERSONA].icon,
  [EntityType.ROLE]: ENTITY_ICON_MAPPER[EntityType.ROLE].icon,
  [EntityType.POLICY]: ENTITY_ICON_MAPPER[EntityType.POLICY].icon,
  [EntityType.EVENT_SUBSCRIPTION]:
    ENTITY_ICON_MAPPER[EntityType.EVENT_SUBSCRIPTION].icon,
  [EntityType.USER]: ENTITY_ICON_MAPPER[EntityType.USER].icon,
  [EntityType.INGESTION_PIPELINE]:
    ENTITY_ICON_MAPPER[EntityType.INGESTION_PIPELINE].icon,
  [EntityType.ALERT]: ENTITY_ICON_MAPPER[EntityType.ALERT].icon,
  [EntityType.KPI]: ENTITY_ICON_MAPPER[EntityType.KPI].icon,
  tagCategory: ENTITY_ICON_MAPPER['tagCategory'].icon,
  announcement: ENTITY_ICON_MAPPER['announcement'].icon,
  conversation: ENTITY_ICON_MAPPER['conversation'].icon,
  task: ENTITY_ICON_MAPPER['task'].icon,
  dataQuality: ENTITY_ICON_MAPPER['dataQuality'].icon,
  services: ENTITY_ICON_MAPPER['services'].icon,
  automator: ENTITY_ICON_MAPPER['automator'].icon,
  notification: ENTITY_ICON_MAPPER['notification'].icon,
  [EntityType.LLM_SERVICE]: ENTITY_ICON_MAPPER[EntityType.LLM_SERVICE].icon,
  [EntityType.MCP_SERVICE]: ENTITY_ICON_MAPPER[EntityType.MCP_SERVICE].icon,
  aiFrameworkControl: ENTITY_ICON_MAPPER['aiFrameworkControl'].icon,
  aiGovernancePolicy: ENTITY_ICON_MAPPER['aiGovernancePolicy'].icon,
  aiGovernanceFramework: ENTITY_ICON_MAPPER['aiGovernanceFramework'].icon,
  [EntityType.AUDIT_REPORT]: ENTITY_ICON_MAPPER[EntityType.AUDIT_REPORT].icon,
  [EntityType.API_ENDPOINT]: ENTITY_ICON_MAPPER[EntityType.API_ENDPOINT].icon,
  [EntityType.METRIC]: ENTITY_ICON_MAPPER[EntityType.METRIC].icon,
  [EntityType.API_SERVICE]: ENTITY_ICON_MAPPER[EntityType.API_SERVICE].icon,
  [EntityType.API_COLLECTION]:
    ENTITY_ICON_MAPPER[EntityType.API_COLLECTION].icon,
  location: LocationIcon,
  [EntityType.QUERY]: ENTITY_ICON_MAPPER[EntityType.QUERY].icon,
  [EntityType.DIRECTORY]: ENTITY_ICON_MAPPER[EntityType.DIRECTORY].icon,
  [EntityType.FILE]: ENTITY_ICON_MAPPER[EntityType.FILE].icon,
  [EntityType.SPREADSHEET]: ENTITY_ICON_MAPPER[EntityType.SPREADSHEET].icon,
  [EntityType.WORKSHEET]: ENTITY_ICON_MAPPER[EntityType.WORKSHEET].icon,
  [EntityType.DRIVE_SERVICE]: ENTITY_ICON_MAPPER[EntityType.DRIVE_SERVICE].icon,
  [EntityType.KNOWLEDGE_PAGE]:
    ENTITY_ICON_MAPPER[EntityType.KNOWLEDGE_PAGE].icon,
  [EntityType.KNOWLEDGE_CENTER]:
    ENTITY_ICON_MAPPER[EntityType.KNOWLEDGE_CENTER].icon,
  [EntityType.knowledgePanels]:
    ENTITY_ICON_MAPPER[EntityType.KNOWLEDGE_CENTER].icon,
  [EntityType.SEARCH_INDEX]: ENTITY_ICON_MAPPER[EntityType.SEARCH_INDEX].icon,
  [EntityType.SEARCH_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.SEARCH_SERVICE].icon,
  Governance: GovernanceIcon,
  contextFile: ENTITY_ICON_MAPPER.contextFile.icon,
  contextMemory: ENTITY_ICON_MAPPER.contextMemory.icon,
  aiAutomation: ENTITY_ICON_MAPPER.aiAutomation.icon,
  folder: ENTITY_ICON_MAPPER.folder.icon,
  contextPlugin: ENTITY_ICON_MAPPER.contextPlugin.icon,
  marketplace: ENTITY_ICON_MAPPER.marketplace.icon,
  dynamicAgent: ENTITY_ICON_MAPPER.dynamicAgent.icon,
  [EntityType.AI_APPLICATION]:
    ENTITY_ICON_MAPPER[EntityType.AI_APPLICATION].icon,
  [EntityType.LLM_MODEL]: ENTITY_ICON_MAPPER[EntityType.LLM_MODEL].icon,
  [EntityType.MCP_SERVER]: ENTITY_ICON_MAPPER[EntityType.MCP_SERVER].icon,
  dataObservability: ENTITY_ICON_MAPPER.dataObservability.icon,
  report: ENTITY_ICON_MAPPER.report.icon,
  testDefinition: ENTITY_ICON_MAPPER.testDefinition.icon,
};

export enum EntityIconSize {
  Size14 = 14,
  Size16 = 16,
  Size18 = 18,
  Size20 = 20,
  Size24 = 24,
  Size32 = 32,
}

export const ENTITY_ICON_SIZE_CLASS_MAP: Record<EntityIconSize, string> = {
  [EntityIconSize.Size14]: 'tw:w-3.5 tw:h-3.5',
  [EntityIconSize.Size16]: 'tw:w-4 tw:h-4',
  [EntityIconSize.Size18]: 'tw:w-4.5 tw:h-4.5',
  [EntityIconSize.Size20]: 'tw:w-5 tw:h-5',
  [EntityIconSize.Size24]: 'tw:w-6 tw:h-6',
  [EntityIconSize.Size32]: 'tw:w-8 tw:h-8',
};

export type EntityIconBgSize =
  | EntityIconSize.Size14
  | EntityIconSize.Size16
  | EntityIconSize.Size18;

export const ENTITY_ICON_BG_SIZE_MAP: Record<
  EntityIconBgSize,
  {
    containerProps: { className: string };
    iconProps: { size: EntityIconSize };
  }
> = {
  [EntityIconSize.Size14]: {
    containerProps: { className: 'tw:h-5.5 tw:w-5.5 tw:rounded-sm' },
    iconProps: { size: EntityIconSize.Size14 },
  },
  [EntityIconSize.Size16]: {
    containerProps: { className: 'tw:h-7 tw:w-7 tw:rounded-sm' },
    iconProps: { size: EntityIconSize.Size16 },
  },
  [EntityIconSize.Size18]: {
    containerProps: { className: 'tw:h-8 tw:w-8 tw:rounded-md' },
    iconProps: { size: EntityIconSize.Size18 },
  },
};

export const getEntityIcon = (
  indexType: string,
  iconClass = '',
  iconStyle: CSSProperties = {},
  size?: EntityIconSize
) => {
  const className = classNames(
    'tw:text-fg-tertiary tw:[stroke-width:1.5]',
    iconClass,
    size && ENTITY_ICON_SIZE_CLASS_MAP[size]
  );
  const Icon = entityIconMapping[indexType];

  return Icon ? <Icon className={className} style={iconStyle} /> : null;
};

export const getEntityTypeIcon = (entityType?: string) =>
  getEntityIcon(entityType ?? '');
