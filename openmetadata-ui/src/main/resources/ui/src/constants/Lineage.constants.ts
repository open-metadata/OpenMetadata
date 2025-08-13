/*
 *  Copyright 2022 Collate.
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

import { ElementLoadingState } from '../components/Entity/EntityLineage/EntityLineage.interface';
import { EntityFields } from '../enums/AdvancedSearch.enum';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { Source } from '../generated/type/entityLineage';
import { t } from '../utils/i18next/LocalUtil';

export const FOREIGN_OBJECT_SIZE = 40;
export const ZOOM_VALUE = 0.65;
export const MIN_ZOOM_VALUE = 0.1;
export const MAX_ZOOM_VALUE = 2.5;

export const ZOOM_TRANSITION_DURATION = 800;
export const DATATYPES_HAVING_SUBFIELDS = [
  'RECORD',
  'STRUCT',
  'ARRAY',
  'UNION',
  'TABLE',
];

export const entityData = [
  {
    type: SearchIndex.TABLE,
    label: t('label.table-plural'),
  },
  {
    type: SearchIndex.DASHBOARD,
    label: t('label.dashboard-plural'),
  },
  {
    type: SearchIndex.TOPIC,
    label: t('label.topic-plural'),
  },
  {
    type: SearchIndex.MLMODEL,
    label: t('label.ml-model-plural'),
  },
  {
    type: SearchIndex.CONTAINER,
    label: t('label.container-plural'),
  },
  {
    type: SearchIndex.PIPELINE,
    label: t('label.pipeline-plural'),
  },
  {
    type: SearchIndex.SEARCH_INDEX,
    label: t('label.search-index-plural'),
  },
  {
    type: SearchIndex.DASHBOARD_DATA_MODEL,
    label: t('label.data-model-plural'),
  },
  {
    type: SearchIndex.API_ENDPOINT_INDEX,
    label: t('label.api-endpoint-plural'),
  },
  {
    type: SearchIndex.METRIC_SEARCH_INDEX,
    label: t('label.metric-plural'),
  },
];

export const NODE_WIDTH = 400;
export const NODE_HEIGHT = 90;

export const ELEMENT_DELETE_STATE = {
  loading: false,
  status: 'initial' as ElementLoadingState,
};

export const LINEAGE_DEFAULT_QUICK_FILTERS = [
  EntityFields.DOMAINS,
  EntityFields.OWNERS,
  EntityFields.TAG,
  EntityFields.COLUMN,
];

export const LINEAGE_SOURCE: { [key in Source]: string } = {
  [Source.ChildAssets]: 'Child Assets',
  [Source.DashboardLineage]: 'Dashboard Lineage',
  [Source.DbtLineage]: 'dbt Lineage',
  [Source.Manual]: 'Manual',
  [Source.PipelineLineage]: 'Pipeline Lineage',
  [Source.QueryLineage]: 'Query Lineage',
  [Source.SparkLineage]: 'Spark Lineage',
  [Source.ViewLineage]: 'View Lineage',
  [Source.OpenLineage]: 'OpenLineage',
  [Source.CrossDatabaseLineage]: 'Cross Database Lineage',
  [Source.ExternalTableLineage]: 'External Table Lineage',
};

export const LINEAGE_COLUMN_NODE_SUPPORTED = [
  EntityType.TABLE,
  EntityType.DASHBOARD,
  EntityType.MLMODEL,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.CONTAINER,
  EntityType.TOPIC,
  EntityType.SEARCH_INDEX,
  EntityType.API_ENDPOINT,
];

export const LINEAGE_EXPORT_HEADERS = [
  { field: 'name', title: 'Name' },
  { field: 'displayName', title: 'Display Name' },
  { field: 'fullyQualifiedName', title: 'Fully Qualified Name' },
  { field: 'entityType', title: 'Entity Type' },
  { field: 'direction', title: 'Direction' },
  { field: 'owners', title: 'Owner' },
  { field: 'domains', title: 'Domains' },
  { field: 'tags', title: 'Tags' },
  { field: 'tier', title: 'Tier' },
  { field: 'glossaryTerms', title: 'Glossary Terms' },
  { field: 'depth', title: 'Level' },
];

export const INITIAL_NODE_ITEMS_LENGTH = 50;
export const NODE_ITEMS_PAGE_SIZE = 50;
export const DEBOUNCE_TIMEOUT = 300;

export enum LINEAGE_TAB_VIEW {
  DIAGRAM_VIEW = 'diagram_view',
  TABLE_VIEW = 'table_view',
}

export const LINEAGE_TABLE_COLUMN_LOCALIZATION_KEYS: Record<string, string> = {
  fromEntityFQN: t('label.from-entity-fqn'),
  fromServiceName: t('label.from-service-name'),
  fromServiceType: t('label.from-service-type'),
  fromOwners: t('label.from-owner-plural'),
  fromDomain: t('label.from-domain'),
  toEntityFQN: t('label.to-entity-fqn'),
  toServiceName: t('label.to-service-name'),
  toServiceType: t('label.to-service-type'),
  toOwners: t('label.to-owner-plural'),
  toDomain: t('label.to-domain'),
  fromChildEntityFQN: t('label.from-child-entity-fqn'),
  toChildEntityFQN: t('label.to-child-entity-fqn'),
  pipelineName: t('label.pipeline-name'),
  pipelineDisplayName: t('label.pipeline-display-name'),
  pipelineType: t('label.pipeline-type'),
  pipelineDescription: t('label.pipeline-description'),
  pipelineOwners: t('label.pipeline-owner-plural'),
  pipelineDomain: t('label.pipeline-domain'),
  pipelineServiceName: t('label.pipeline-service-name'),
  pipelineServiceType: t('label.pipeline-service-type'),
};
