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
 * Entity type reachable under the `di-data-assets-*` wildcard. Asset types and test case
 * definitions are captured as daily snapshots by DataInsightsApp and configured in
 * `dataInsights/config.json`. Test results and resolution statuses are supplied by
 * live-index aliases. Test case coverage history begins with successfully captured
 * snapshots; backfills do not reconstruct definitions from before collection started.
 */
export enum DataAssetType {
    APIEndpoint = "apiEndpoint",
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
    TestCase = "testCase",
    TestCaseResolutionStatus = "testCaseResolutionStatus",
    TestCaseResult = "testCaseResult",
    Topic = "topic",
}
