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

import { cloneDeep } from 'lodash';
import { COMMON_UI_SCHEMA } from '../constants/ServiceUISchema.constant';
import { SearchServiceType } from '../generated/entity/services/searchService';

type SchemaModule =
  | { default: Record<string, unknown> }
  | Record<string, unknown>;
type SchemaLoader = () => Promise<SchemaModule>;

const searchSchemaLoaders: Partial<Record<SearchServiceType, SchemaLoader>> = {
  [SearchServiceType.ElasticSearch]: () =>
    import(
      '../jsons/connectionSchemas/connections/search/elasticSearchConnection.json'
    ),
  [SearchServiceType.OpenSearch]: () =>
    import(
      '../jsons/connectionSchemas/connections/search/openSearchConnection.json'
    ),
  [SearchServiceType.CustomSearch]: () =>
    import(
      '../jsons/connectionSchemas/connections/search/customSearchConnection.json'
    ),
};

const resolveSchemaModule = (mod: SchemaModule): Record<string, unknown> => {
  const maybeDefault = (mod as { default?: Record<string, unknown> }).default;

  return maybeDefault ?? (mod as Record<string, unknown>);
};

export const getSearchServiceConfig = async (type: SearchServiceType) => {
  const loader = searchSchemaLoaders[type];
  let schema: Record<string, unknown> = {};
  const uiSchema = { ...COMMON_UI_SCHEMA };

  if (loader) {
    const mod = await loader();
    schema = resolveSchemaModule(mod);
  }

  return cloneDeep({ schema, uiSchema });
};
