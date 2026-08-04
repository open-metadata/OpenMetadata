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
import { ReactComponent as AlertIcon } from '../assets/svg/alert.svg';
import { ReactComponent as AnnouncementIcon } from '../assets/svg/announcements-black.svg';
import { ReactComponent as ApplicationIcon } from '../assets/svg/application.svg';
import { ReactComponent as AutomatorBotIcon } from '../assets/svg/automator-bot.svg';
import { ReactComponent as BotIcon } from '../assets/svg/bot.svg';
import { ReactComponent as ClassificationIcon } from '../assets/svg/classification.svg';
import { ReactComponent as ConversationIcon } from '../assets/svg/comment.svg';
import { ReactComponent as DataQualityIcon } from '../assets/svg/ic-data-contract.svg';
import { ReactComponent as GovernanceIcon } from '../assets/svg/ic-governance.svg';
import { ReactComponent as PersonaIcon } from '../assets/svg/ic-personas.svg';
import { ReactComponent as TeamIcon } from '../assets/svg/ic-teams.svg';
import { ReactComponent as RoleIcon } from '../assets/svg/icon-role-grey.svg';
import { ReactComponent as KPIIcon } from '../assets/svg/kpi.svg';
import { ReactComponent as LocationIcon } from '../assets/svg/location.svg';
import { ReactComponent as NotificationIcon } from '../assets/svg/notification.svg';
import { ReactComponent as PolicyIcon } from '../assets/svg/policies.svg';
import { ReactComponent as ServicesIcon } from '../assets/svg/services.svg';
import { ReactComponent as TaskIcon } from '../assets/svg/task-ic.svg';
import { ReactComponent as UserIcon } from '../assets/svg/user.svg';
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
  [EntityType.BOT]: BotIcon,
  [EntityType.TEAM]: TeamIcon,
  [EntityType.APPLICATION]: ApplicationIcon,
  [EntityType.PERSONA]: PersonaIcon,
  [EntityType.ROLE]: RoleIcon,
  [EntityType.POLICY]: PolicyIcon,
  [EntityType.EVENT_SUBSCRIPTION]: AlertIcon,
  [EntityType.USER]: UserIcon,
  [EntityType.INGESTION_PIPELINE]:
    ENTITY_ICON_MAPPER[EntityType.INGESTION_PIPELINE].icon,
  [EntityType.ALERT]: AlertIcon,
  [EntityType.KPI]: KPIIcon,
  tagCategory: ClassificationIcon,
  announcement: AnnouncementIcon,
  conversation: ConversationIcon,
  task: TaskIcon,
  dataQuality: DataQualityIcon,
  services: ServicesIcon,
  automator: AutomatorBotIcon,
  notification: NotificationIcon,
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

export const getEntityIcon = (
  indexType: string,
  iconClass = '',
  iconStyle: CSSProperties = {},
  size?: EntityIconSize
) => {
  const className = classNames(
    iconClass,
    size && ENTITY_ICON_SIZE_CLASS_MAP[size]
  );
  const Icon = entityIconMapping[indexType];

  return Icon ? <Icon className={className} style={iconStyle} /> : null;
};

export const getEntityTypeIcon = (entityType?: string) =>
  getEntityIcon(entityType ?? '');
