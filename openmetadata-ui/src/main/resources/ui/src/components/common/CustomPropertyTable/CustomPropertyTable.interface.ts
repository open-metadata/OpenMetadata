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

import { EntityType } from '../../../enums/entity.enum';
import { APICollection } from '../../../generated/entity/data/apiCollection';
import { APIEndpoint } from '../../../generated/entity/data/apiEndpoint';
import { Chart } from '../../../generated/entity/data/chart';
import { Container } from '../../../generated/entity/data/container';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { DashboardDataModel } from '../../../generated/entity/data/dashboardDataModel';
import { Database } from '../../../generated/entity/data/database';
import { DatabaseSchema } from '../../../generated/entity/data/databaseSchema';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { Metric } from '../../../generated/entity/data/metric';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { SearchIndex } from '../../../generated/entity/data/searchIndex';
import { StoredProcedure } from '../../../generated/entity/data/storedProcedure';
import { Table } from '../../../generated/entity/data/table';
import { Topic } from '../../../generated/entity/data/topic';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/entity/type';
import { CustomProperty } from '../../../generated/type/customProperty';

export type ExtentionEntities = {
  [EntityType.TABLE]: Table;
  [EntityType.TOPIC]: Topic;
  [EntityType.DASHBOARD]: Dashboard;
  [EntityType.PIPELINE]: Pipeline;
  [EntityType.MLMODEL]: Mlmodel;
  [EntityType.CONTAINER]: Container;
  [EntityType.SEARCH_INDEX]: SearchIndex;
  [EntityType.STORED_PROCEDURE]: StoredProcedure;
  [EntityType.GLOSSARY_TERM]: GlossaryTerm;
  [EntityType.DATABASE]: Database;
  [EntityType.DATABASE_SCHEMA]: DatabaseSchema;
  [EntityType.DASHBOARD_DATA_MODEL]: DashboardDataModel;
  [EntityType.API_COLLECTION]: APICollection;
  [EntityType.API_ENDPOINT]: APIEndpoint;
  [EntityType.DATA_PRODUCT]: DataProduct;
  [EntityType.METRIC]: Metric;
  [EntityType.DOMAIN]: Domain;
  [EntityType.CHART]: Chart;
};

export type ExtentionEntitiesKeys = keyof ExtentionEntities;

export interface CustomPropertyProps<T extends ExtentionEntitiesKeys> {
  isVersionView?: boolean;
  entityType: T;
  hasEditAccess: boolean;
  className?: string;
  hasPermission: boolean;
  maxDataCap?: number;
  isRenderedInRightPanel?: boolean;
}

export interface PropertyValueProps {
  property: CustomProperty;
  extension: Table['extension'];
  hasEditPermissions: boolean;
  versionDataKeys?: string[];
  isVersionView?: boolean;
  isRenderedInRightPanel?: boolean;
  onExtensionUpdate: (updatedExtension: Table['extension']) => Promise<void>;
}

export type TimeIntervalType = {
  start: number;
  end: number;
};

export type TableTypePropertyValueType = {
  columns: string[];
  rows: Record<string, string>[];
};

export type PropertyValueType =
  | string
  | number
  | string[]
  | EntityReference
  | EntityReference[]
  | TimeIntervalType
  | TableTypePropertyValueType;
