/*
 *  Copyright 2022 Collate
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

export interface GlobalSearchSuggestionsProp {
  value: string;
  searchText: string;
  onOptionSelection: () => void;
  onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSearch: (newValue: string) => void;
}

export interface CommonSource {
  fullyQualifiedName: string;
  serviceType: string;
  name: string;
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

export interface Option {
  _index: string;
  _source: TableSource &
    DashboardSource &
    TopicSource &
    PipelineSource &
    MlModelSource;
}
