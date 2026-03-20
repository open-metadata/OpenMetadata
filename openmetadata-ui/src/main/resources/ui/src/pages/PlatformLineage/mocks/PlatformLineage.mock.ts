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
import { SourceType } from '../../../components/SearchedData/SearchedData.interface';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { PipelineViewMode } from '../../../generated/configuration/lineageSettings';
import { AppPreferences } from '../../../interface/store.interface';

export const MOCK_TABLE_ENTITY: SourceType = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'dim_customer',
  displayName: 'Customer Dimension',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_customer',
  description: 'Customer dimension table',
  entityType: EntityType.TABLE,
  deleted: false,
};

export const MOCK_DASHBOARD_ENTITY: SourceType = {
  id: '223e4567-e89b-12d3-a456-426614174001',
  name: 'sales_dashboard',
  displayName: 'Sales Dashboard',
  fullyQualifiedName: 'sample_data.superset.sales_dashboard',
  description: 'Sales analytics dashboard',
  entityType: EntityType.DASHBOARD,
  deleted: false,
};

export const MOCK_PIPELINE_ENTITY: SourceType = {
  id: '323e4567-e89b-12d3-a456-426614174002',
  name: 'etl_customer_pipeline',
  displayName: 'Customer ETL Pipeline',
  fullyQualifiedName: 'sample_data.airflow.etl_customer_pipeline',
  description: 'ETL pipeline for customer data',
  entityType: EntityType.PIPELINE,
  deleted: false,
};

export const MOCK_TOPIC_ENTITY: SourceType = {
  id: '423e4567-e89b-12d3-a456-426614174003',
  name: 'customer_events',
  displayName: 'Customer Events',
  fullyQualifiedName: 'sample_data.kafka.customer_events',
  description: 'Customer event stream',
  entityType: EntityType.TOPIC,
  deleted: false,
};

export const MOCK_DOMAIN_ENTITY: SourceType = {
  id: '523e4567-e89b-12d3-a456-426614174004',
  name: 'customer_domain',
  displayName: 'Customer Domain',
  fullyQualifiedName: 'customer_domain',
  description: 'Customer data domain',
  entityType: EntityType.DOMAIN,
  deleted: false,
};

export const MOCK_SERVICE_ENTITY = {
  id: '623e4567-e89b-12d3-a456-426614174005',
  name: 'mysql_service',
  displayName: 'MySQL Service',
  fullyQualifiedName: 'mysql_service',
  description: 'MySQL database service',
  entityType: EntityType.DATABASE_SERVICE,
  deleted: false,
  href: 'http://localhost:8585/api/v1/services/databaseServices/623e4567-e89b-12d3-a456-426614174005',
};

export const MOCK_SEARCH_RESULTS = {
  hits: {
    total: {
      value: 5,
      relation: 'eq',
    },
    hits: [
      {
        _index: SearchIndex.TABLE,
        _id: MOCK_TABLE_ENTITY.id,
        _source: MOCK_TABLE_ENTITY,
      },
      {
        _index: SearchIndex.DASHBOARD,
        _id: MOCK_DASHBOARD_ENTITY.id,
        _source: MOCK_DASHBOARD_ENTITY,
      },
      {
        _index: SearchIndex.PIPELINE,
        _id: MOCK_PIPELINE_ENTITY.id,
        _source: MOCK_PIPELINE_ENTITY,
      },
      {
        _index: SearchIndex.TOPIC,
        _id: MOCK_TOPIC_ENTITY.id,
        _source: MOCK_TOPIC_ENTITY,
      },
      {
        _index: SearchIndex.DOMAIN,
        _id: MOCK_DOMAIN_ENTITY.id,
        _source: MOCK_DOMAIN_ENTITY,
      },
    ],
  },
};

export const MOCK_EMPTY_SEARCH_RESULTS = {
  hits: {
    total: {
      value: 0,
      relation: 'eq',
    },
    hits: [],
  },
};

export const MOCK_PERMISSIONS_FULL_ACCESS = {
  ViewAll: true,
  ViewBasic: true,
  ViewDataProfile: true,
  ViewQueries: true,
  ViewSampleData: true,
  ViewTests: true,
  ViewUsage: true,
  EditAll: true,
  EditCustomFields: true,
  EditDataProfile: true,
  EditDescription: true,
  EditLineage: true,
  EditOwners: true,
  EditQueries: true,
  EditSampleData: true,
  EditTags: true,
  EditTests: true,
  EditTier: true,
  Delete: true,
};

export const MOCK_PERMISSIONS_VIEW_ONLY = {
  ViewAll: true,
  ViewBasic: true,
  ViewDataProfile: true,
  ViewQueries: true,
  ViewSampleData: true,
  ViewTests: true,
  ViewUsage: true,
  EditAll: false,
  EditCustomFields: false,
  EditDataProfile: false,
  EditDescription: false,
  EditLineage: false,
  EditOwners: false,
  EditQueries: false,
  EditSampleData: false,
  EditTags: false,
  EditTests: false,
  EditTier: false,
  Delete: false,
};

export const MOCK_PERMISSIONS_LINEAGE_EDIT = {
  ViewAll: true,
  EditAll: false,
  EditLineage: true,
};

export const MOCK_LINEAGE_CONFIG_DEFAULT = {
  upstreamDepth: 1,
  downstreamDepth: 1,
  nodesPerLayer: 50,
  pipelineViewMode: PipelineViewMode.Node,
};

export const MOCK_LINEAGE_CONFIG_CUSTOM = {
  upstreamDepth: 3,
  downstreamDepth: 2,
  nodesPerLayer: 100,
  pipelineViewMode: PipelineViewMode.Node,
};

export const MOCK_APP_PREFERENCES = {
  lineageConfig: MOCK_LINEAGE_CONFIG_CUSTOM,
} as unknown as AppPreferences;

export const MOCK_LOCATION_DEFAULT = {
  pathname: '/lineage/table/sample_data.ecommerce_db.shopify.dim_customer',
  search: '',
  hash: '',
  state: null,
};

export const MOCK_LOCATION_FULLSCREEN = {
  pathname: '/lineage/table/sample_data.ecommerce_db.shopify.dim_customer',
  search: '?fullscreen=true',
  hash: '',
  state: null,
};

export const MOCK_LOCATION_WITH_PLATFORM_VIEW = {
  pathname: '/lineage/table/sample_data.ecommerce_db.shopify.dim_customer',
  search: '?platformView=Domain',
  hash: '',
  state: null,
};

export const MOCK_LOCATION_FULLSCREEN_AND_PLATFORM_VIEW = {
  pathname: '/lineage/table/sample_data.ecommerce_db.shopify.dim_customer',
  search: '?fullscreen=true&platformView=DataProduct',
  hash: '',
  state: null,
};

export const MOCK_EXPORT_CONFIG = {
  name: 'label.lineage_2025-03-05',
  exportTypes: ['PNG'],
  title: 'label.lineage',
  documentSelector: '#lineage-react-flow',
  viewport: { x: 0, y: 0, zoom: 1 },
};
