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

import { t } from 'i18next';
import { ElementLoadingState } from '../components/Entity/EntityLineage/EntityLineage.interface';
import { EntityFields } from '../enums/AdvancedSearch.enum';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { Source } from '../generated/type/entityLineage';

export const FOREIGN_OBJECT_SIZE = 40;
export const ZOOM_VALUE = 0.65;
export const MIN_ZOOM_VALUE = 0.1;
export const MAX_ZOOM_VALUE = 2.5;
export const ZOOM_SLIDER_STEP = 0.1;
export const ZOOM_BUTTON_STEP = 0.25;
export const ZOOM_TRANSITION_DURATION = 800;
export const DATATYPES_HAVING_SUBFIELDS = [
  'RECORD',
  'STRUCT',
  'ARRAY',
  'UNION',
];

export const PIPELINE_EDGE_WIDTH = 200;

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
    type: SearchIndex.SEARCH_INDEX,
    label: t('label.search-index-plural'),
  },
  {
    type: SearchIndex.DASHBOARD_DATA_MODEL,
    label: t('label.data-model-plural'),
  },
];

export const POSITION_X = 150;
export const POSITION_Y = 60;

export const NODE_WIDTH = 400;
export const NODE_HEIGHT = 90;

export const ELEMENT_DELETE_STATE = {
  loading: false,
  status: 'initial' as ElementLoadingState,
};

export const LINEAGE_DEFAULT_QUICK_FILTERS = [
  EntityFields.DOMAIN,
  EntityFields.OWNER,
  EntityFields.TAG,
  EntityFields.COLUMN,
];

export const LINEAGE_SOURCE: { [key in Source]: string } = {
  [Source.DashboardLineage]: 'Dashboard Lineage',
  [Source.DbtLineage]: 'dbt Lineage',
  [Source.Manual]: 'Manual',
  [Source.PipelineLineage]: 'Pipeline Lineage',
  [Source.QueryLineage]: 'Query Lineage',
  [Source.SparkLineage]: 'Spark Lineage',
  [Source.ViewLineage]: 'View Lineage',
  [Source.OpenLineage]: 'OpenLineage',
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
];

export const LINEAGE_EXPORT_HEADERS = [
  { field: 'name', title: 'Name' },
  { field: 'displayName', title: 'Display Name' },
  { field: 'fullyQualifiedName', title: 'Fully Qualified Name' },
  { field: 'entityType', title: 'Entity Type' },
  { field: 'direction', title: 'Direction' },
  { field: 'owner', title: 'Owner' },
  { field: 'domain', title: 'Domain' },
  { field: 'tags', title: 'Tags' },
  { field: 'tier', title: 'Tier' },
  { field: 'glossaryTerms', title: 'Glossary Terms' },
  { field: 'depth', title: 'Level' },
];
