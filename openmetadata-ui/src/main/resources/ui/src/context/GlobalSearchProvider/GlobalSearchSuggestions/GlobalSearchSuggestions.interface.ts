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

import { BaseSelectRef } from 'rc-select';
import {
  ContainerSearchSource,
  DashboardDataModelSearchSource,
  StoredProcedureSearchSource,
} from '../../../interface/search.interface';

export interface GlobalSearchSuggestionsProp {
  isSuggestionsLoading: boolean;
  handleIsSuggestionsLoading: (value: boolean) => void;

  value: string;
  searchText: string;
  onOptionSelection: () => void;
  onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSearch: (newValue: string) => void;
  selectRef?: React.Ref<BaseSelectRef>;
}

export interface CommonSource {
  fullyQualifiedName: string;
  serviceType: string;
  name: string;
  entityType: string;
}

export interface TableSource extends CommonSource {
  table_id: string;
  table_name: string;
}

export interface DashboardSource extends CommonSource {
  dashboard_id: string;
  dashboard_name: string;
}

export interface TopicSource extends CommonSource {
  topic_id: string;
  topic_name: string;
}

export interface PipelineSource extends CommonSource {
  pipeline_id: string;
  pipeline_name: string;
}

export interface MlModelSource extends CommonSource {
  ml_model_id: string;
  mlmodel_name: string;
}

export interface SearchIndexSource extends CommonSource {
  search_index_id: string;
  search_index_name: string;
}

export interface GlossarySource extends CommonSource {
  glossary_id: string;
  glossary_name: string;
}

export interface DatabaseSource extends CommonSource {
  database_id: string;
  database_name: string;
}

export interface DatabaseSchemaSource extends CommonSource {
  database_schema_id: string;
  database_schema_name: string;
}

export interface TagSource extends CommonSource {
  tag_id: string;
  tag_name: string;
}

export interface StoredProcedureSource extends CommonSource {
  stored_procedure_id: string;
  stored_procedure_name: string;
}

export interface DashboardDataModelSource extends CommonSource {
  data_model_id: string;
  data_model_name: string;
}
export interface DataProductSource extends CommonSource {
  data_product_id: string;
  data_product_name: string;
}

export interface ChartSource extends CommonSource {
  chart_id: string;
  chart_name: string;
}

export interface APIEndpointSource extends CommonSource {
  api_endpoint_id: string;
  api_endpoint_name: string;
}
export interface MetricSource extends CommonSource {
  metric_id: string;
  metric_name: string;
}

export interface APICollectionSource extends CommonSource {
  api_collection_id: string;
  api_collection_name: string;
}

export interface Option {
  _index: string;
  _id: string;
  _source:
    | TableSource &
        DashboardSource &
        TopicSource &
        PipelineSource &
        MlModelSource &
        ContainerSearchSource &
        StoredProcedureSearchSource &
        DashboardDataModelSearchSource &
        GlossarySource &
        TagSource &
        SearchIndexSource &
        DataProductSource &
        ChartSource &
        APIEndpointSource &
        APICollectionSource &
        MetricSource;
}

export type SearchSuggestions =
  | TableSource[]
  | TopicSource[]
  | PipelineSource[]
  | TagSource[]
  | GlossarySource[]
  | ContainerSearchSource[]
  | DashboardSource[]
  | MlModelSource[]
  | SearchIndexSource[]
  | StoredProcedureSearchSource[]
  | DashboardDataModelSearchSource[]
  | DataProductSource[]
  | ChartSource[]
  | APIEndpointSource[]
  | APICollectionSource[]
  | MetricSource[]
  | DatabaseSource[]
  | DatabaseSchemaSource[];
