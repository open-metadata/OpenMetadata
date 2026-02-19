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
import { DataProduct } from '../support/domain/DataProduct';
import { Domain } from '../support/domain/Domain';
import { ApiCollectionClass } from '../support/entity/ApiCollectionClass';
import { ApiEndpointClass } from '../support/entity/ApiEndpointClass';
import { ChartClass } from '../support/entity/ChartClass';
import { ContainerClass } from '../support/entity/ContainerClass';
import { DashboardClass } from '../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../support/entity/DashboardDataModelClass';
import { DatabaseClass } from '../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../support/entity/DatabaseSchemaClass';
import { DirectoryClass } from '../support/entity/DirectoryClass';
import { FileClass } from '../support/entity/FileClass';
import { MetricClass } from '../support/entity/MetricClass';
import { MlModelClass } from '../support/entity/MlModelClass';
import { PipelineClass } from '../support/entity/PipelineClass';
import { SearchIndexClass } from '../support/entity/SearchIndexClass';
import { SpreadsheetClass } from '../support/entity/SpreadsheetClass';
import { StoredProcedureClass } from '../support/entity/StoredProcedureClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import { WorksheetClass } from '../support/entity/WorksheetClass';
import { GlossaryTerm } from '../support/glossary/GlossaryTerm';

export type CPSupportedEntityTypes =
  | typeof ApiCollectionClass
  | typeof ApiEndpointClass
  | typeof ChartClass
  | typeof ContainerClass
  | typeof DashboardDataModelClass
  | typeof DashboardClass
  | typeof DatabaseClass
  | typeof DatabaseSchemaClass
  | typeof DirectoryClass
  | typeof FileClass
  | typeof GlossaryTerm
  | typeof MetricClass
  | typeof MlModelClass
  | typeof PipelineClass
  | typeof SearchIndexClass
  | typeof SpreadsheetClass
  | typeof StoredProcedureClass
  | typeof TableClass
  | typeof TopicClass
  | typeof WorksheetClass
  | typeof DataProduct
  | typeof Domain;
