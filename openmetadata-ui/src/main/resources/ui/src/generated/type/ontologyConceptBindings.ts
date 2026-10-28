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
/**
 * Operational catalog associations for a native concept, stored separately from semantic
 * definitions and releases.
 */
export interface OntologyConceptBindings {
    assets:   AssetBinding[];
    revision: number;
}

export interface AssetBinding {
    assetId:   string;
    assetType: AssetType;
    columns?:  ColumnBinding[];
}

export enum AssetType {
    APIEndpoint = "apiEndpoint",
    Chart = "chart",
    Container = "container",
    Dashboard = "dashboard",
    DashboardDataModel = "dashboardDataModel",
    Metric = "metric",
    Mlmodel = "mlmodel",
    Pipeline = "pipeline",
    SearchIndex = "searchIndex",
    StoredProcedure = "storedProcedure",
    Table = "table",
    Topic = "topic",
}

export interface ColumnBinding {
    columnPath: string[];
    propertyId: string;
}
