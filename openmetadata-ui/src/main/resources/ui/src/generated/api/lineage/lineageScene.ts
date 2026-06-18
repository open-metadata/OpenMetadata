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

export enum LineageLens {
  Service = 'service',
  Domain = 'domain',
  DataProduct = 'dataProduct',
}

export enum LineageBand {
  Layer = 'LAYER',
  Asset = 'ASSET',
  Field = 'FIELD',
}

export enum LineageLevelKind {
  Service = 'service',
  Database = 'database',
  Schema = 'schema',
  Table = 'table',
  Column = 'column',
  Topic = 'topic',
  Field = 'field',
  Dashboard = 'dashboard',
  Chart = 'chart',
  Model = 'model',
  Feature = 'feature',
  Pipeline = 'pipeline',
  Task = 'task',
  Domain = 'domain',
  DataProduct = 'dataProduct',
  Container = 'container',
  SearchIndex = 'searchIndex',
  ApiEndpoint = 'apiEndpoint',
  Metric = 'metric',
  Directory = 'directory',
  File = 'file',
  Spreadsheet = 'spreadsheet',
  Worksheet = 'worksheet',
  Asset = 'asset',
}

export interface LineageSceneField {
  id: string;
  name: string;
  fullyQualifiedName?: string;
  dataType?: string;
}

export interface LineageSceneBreadcrumb {
  id: string;
  label: string;
  fullyQualifiedName?: string;
  entityType?: string;
  levelKind: LineageLevelKind;
  band: LineageBand;
}

export interface LineageSceneNode {
  id: string;
  fullyQualifiedName?: string;
  entityType?: string;
  levelKind: LineageLevelKind;
  band: LineageBand;
  serviceType?: string;
  label: string;
  displayName?: string;
  parentId?: string;
  parentFqn?: string;
  childrenCount?: number;
  hiddenChildrenCount?: number;
  counts?: Record<string, number>;
  fields?: LineageSceneField[];
  isFocus?: boolean;
  isOrigin?: boolean;
  isExpandable?: boolean;
  isGhost?: boolean;
  certification?: string;
  sourceEntity?: Record<string, unknown>;
}

export interface LineageSceneEdge {
  id: string;
  from: string;
  to: string;
  band: LineageBand;
  isRollup?: boolean;
  weight?: number;
  label?: string;
  source?: string;
  sqlQuery?: string;
  transform?: string;
  underlyingEdgeIds?: string[];
}

export interface LineageScene {
  lens: LineageLens;
  band: LineageBand;
  focusFqn?: string;
  focusEntityType?: string;
  originFqn?: string;
  originEntityType?: string;
  nodes: LineageSceneNode[];
  edges: LineageSceneEdge[];
  breadcrumb: LineageSceneBreadcrumb[];
  hiddenNodeCount?: number;
}
