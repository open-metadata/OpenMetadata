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

import { loadConnectionSchema } from './loadConnectionSchema';
import { cloneDeep } from 'lodash';
import { COMMON_UI_SCHEMA } from '../constants/ServiceUISchema.constant';
import { PipelineServiceType } from '../generated/entity/services/pipelineService';

type SchemaModule =
  | { default: Record<string, unknown> }
  | Record<string, unknown>;
type SchemaLoader = () => Promise<SchemaModule>;

const pipelineSchemaLoaders: Partial<
  Record<PipelineServiceType, SchemaLoader>
> = {
  [PipelineServiceType.Airbyte]: () =>
    loadConnectionSchema('connections/pipeline/airbyteConnection.json'),
  [PipelineServiceType.Airflow]: () =>
    loadConnectionSchema('connections/pipeline/airflowConnection.json'),
  [PipelineServiceType.GluePipeline]: () =>
    loadConnectionSchema('connections/pipeline/gluePipelineConnection.json'),
  [PipelineServiceType.KafkaConnect]: () =>
    loadConnectionSchema('connections/pipeline/kafkaConnectConnection.json'),
  [PipelineServiceType.Fivetran]: () =>
    loadConnectionSchema('connections/pipeline/fivetranConnection.json'),
  [PipelineServiceType.Dagster]: () =>
    loadConnectionSchema('connections/pipeline/dagsterConnection.json'),
  [PipelineServiceType.DBTCloud]: () =>
    loadConnectionSchema('connections/pipeline/dbtCloudConnection.json'),
  [PipelineServiceType.Nifi]: () =>
    loadConnectionSchema('connections/pipeline/nifiConnection.json'),
  [PipelineServiceType.DomoPipeline]: () =>
    loadConnectionSchema('connections/pipeline/domoPipelineConnection.json'),
  [PipelineServiceType.CustomPipeline]: () =>
    loadConnectionSchema('connections/pipeline/customPipelineConnection.json'),
  [PipelineServiceType.DatabricksPipeline]: () =>
    loadConnectionSchema('connections/pipeline/databricksPipelineConnection.json'),
  [PipelineServiceType.Spline]: () =>
    loadConnectionSchema('connections/pipeline/splineConnection.json'),
  [PipelineServiceType.OpenLineage]: () =>
    loadConnectionSchema('connections/pipeline/openLineageConnection.json'),
  [PipelineServiceType.Flink]: () =>
    loadConnectionSchema('connections/pipeline/flinkConnection.json'),
  [PipelineServiceType.Prefect]: () =>
    loadConnectionSchema('connections/pipeline/prefectConnection.json'),
};

const resolveSchemaModule = (mod: SchemaModule): Record<string, unknown> => {
  const maybeDefault = (mod as { default?: Record<string, unknown> }).default;

  return maybeDefault ?? (mod as Record<string, unknown>);
};

export const getPipelineConfig = async (type: PipelineServiceType) => {
  const loader = pipelineSchemaLoaders[type];
  let schema: Record<string, unknown> = {};
  const uiSchema = { ...COMMON_UI_SCHEMA };

  if (loader) {
    const mod = await loader();
    schema = resolveSchemaModule(mod);
  }

  return cloneDeep({ schema, uiSchema });
};
