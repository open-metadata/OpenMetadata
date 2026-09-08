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
 * Entity type reachable under the `di-data-assets-*` wildcard, and the single source of
 * truth for which entity types Data Insights covers. The first sixteen are ingested by
 * DataInsightsApp into a datastream of their own and are keyed by
 * `dataInsights/config.json`. The last two are supplied instead by a `dataInsightAliases`
 * entry in `indexMapping.json`, which aliases the live entity search index into the
 * wildcard, so Data Insights reads them without ever writing them; those two must never be
 * added to the ingestion subset.
 */
export enum DataAssetType {
    Chart = "chart",
    Container = "container",
    Dashboard = "dashboard",
    DashboardDataModel = "dashboardDataModel",
    DataProduct = "dataProduct",
    Database = "database",
    DatabaseSchema = "databaseSchema",
    GlossaryTerm = "glossaryTerm",
    Metric = "metric",
    Mlmodel = "mlmodel",
    Pipeline = "pipeline",
    SearchIndex = "searchIndex",
    StoredProcedure = "storedProcedure",
    Table = "table",
    Tag = "tag",
    TestCaseResolutionStatus = "testCaseResolutionStatus",
    TestCaseResult = "testCaseResult",
    Topic = "topic",
}
