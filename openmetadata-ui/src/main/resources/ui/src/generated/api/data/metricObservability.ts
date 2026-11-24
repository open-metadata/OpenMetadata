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
 * Server-computed health rollup for a Metric, derived from the data quality of the assets
 * the metric is computed on.
 */
export interface MetricObservability {
    /**
     * Per-asset breakdown of the contributing upstream assets.
     */
    assets?: AssetRollup[];
    /**
     * Per-dimension breakdown of the contributing tests.
     */
    dimensions?: DimensionRollup[];
    /**
     * Number of upstream assets that carried at least one data quality test and therefore
     * contributed to the score.
     */
    evaluatedAssetCount?: number;
    /**
     * When this rollup was computed.
     */
    evaluatedAt?: number;
    /**
     * Overall health band. Unknown when no upstream asset carries a data quality test.
     */
    health: Health;
    /**
     * Unresolved incidents on the metric's upstream assets.
     */
    incidents?: Incident[];
    /**
     * Most recent included terminal result across all direct upstream tables.
     */
    latestRunTime?: number;
    /**
     * Every asset linked to the metric, annotated with its lineage direction. Only the upstream
     * ones contribute to the score, so this is what explains an asset's absence from `assets`.
     */
    linkedAssets?: MetricAssetDirection[];
    /**
     * The metric this rollup describes.
     */
    metric?: EntityReference;
    /**
     * True when detail rows are redacted for one or more sources while global aggregates remain
     * complete.
     */
    partial?:    boolean;
    reasonCode?: ReasonCode;
    /**
     * Backward-compatible server explanation. Clients should localize reasonCode.
     */
    rollupReason?: string;
    /**
     * Overall score as a percentage. Absent when health is Unknown.
     */
    score?:          number;
    sourceCoverage?: SourceCoverage;
    statusCounts?:   StatusCounts;
    /**
     * The individual test results behind the rollup.
     */
    tests?: TestResult[];
    /**
     * Number of upstream assets linked to the metric.
     */
    upstreamAssetCount?: number;
}

/**
 * Health contribution of a single upstream asset.
 */
export interface AssetRollup {
    /**
     * Number of aborted terminal tests on this asset.
     */
    aborted?: number;
    /**
     * The upstream data asset.
     */
    asset: EntityReference;
    /**
     * Number of tests with a Failed terminal result on this asset.
     */
    failed?: number;
    /**
     * Health band for this asset.
     */
    health: Health;
    /**
     * Most recent included terminal result on this asset.
     */
    latestRunTime?: number;
    /**
     * Number of successful terminal tests on this asset.
     */
    passed?: number;
    /**
     * True when the caller can see the aggregate contribution but not this source's identity or
     * details.
     */
    redacted?: boolean;
    /**
     * Pass rate for this asset as a percentage. Absent when the asset has no data quality tests.
     */
    score?: number;
    /**
     * Number of tests evaluated on this asset.
     */
    total?: number;
}

/**
 * The upstream data asset.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * The asset the incident is on.
 *
 * The test case that raised the incident.
 *
 * The linked data asset.
 *
 * The metric this rollup describes.
 *
 * The asset the test runs against.
 *
 * The test case.
 */
export interface EntityReference {
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type: string;
}

/**
 * Health band for this asset.
 *
 * Overall health band for a metric.
 *
 * Overall health band. Unknown when no upstream asset carries a data quality test.
 */
export enum Health {
    AtRisk = "AtRisk",
    Degraded = "Degraded",
    Healthy = "Healthy",
    Unknown = "Unknown",
}

/**
 * Data quality test results for one quality dimension, aggregated across the metric's
 * upstream assets.
 */
export interface DimensionRollup {
    /**
     * Number of terminal tests that aborted.
     */
    aborted?: number;
    /**
     * Name of the data quality dimension, for example Completeness or Accuracy.
     */
    dimension: string;
    /**
     * Number of tests with a Failed terminal result.
     */
    failed: number;
    /**
     * Number of tests that passed.
     */
    passed: number;
    /**
     * Pass rate for this dimension as a percentage.
     */
    score: number;
    /**
     * Number of tests evaluated in this dimension.
     */
    total: number;
}

/**
 * An unresolved data quality incident on one of the metric's upstream assets.
 */
export interface Incident {
    /**
     * The asset the incident is on.
     */
    asset?: EntityReference;
    /**
     * Identifier of the incident.
     */
    id?: string;
    /**
     * Severity assigned to the incident.
     */
    severity?: string;
    /**
     * Current resolution status.
     */
    status?: string;
    /**
     * The test case that raised the incident.
     */
    testCase: EntityReference;
    /**
     * When the incident was raised.
     */
    timestamp?: number;
}

/**
 * A data asset linked to a metric, annotated with where it sits relative to the metric in
 * the lineage graph.
 */
export interface MetricAssetDirection {
    /**
     * True only for a direct upstream Table, the sources included in Metric health.
     */
    affectsHealth?: boolean;
    /**
     * The linked data asset.
     */
    asset: EntityReference;
    /**
     * Where the asset sits relative to the metric. `upstream` assets feed the metric and drive
     * its health, `downstream` assets consume it, and `unrelated` assets are linked but have no
     * lineage edge to the metric.
     */
    direction: Direction;
}

/**
 * Where the asset sits relative to the metric. `upstream` assets feed the metric and drive
 * its health, `downstream` assets consume it, and `unrelated` assets are linked but have no
 * lineage edge to the metric.
 */
export enum Direction {
    Downstream = "downstream",
    Unrelated = "unrelated",
    Upstream = "upstream",
}

/**
 * Stable code localized by API clients.
 */
export enum ReasonCode {
    AtRisk = "AtRisk",
    Degraded = "Degraded",
    Healthy = "Healthy",
    NoLinkedAssets = "NoLinkedAssets",
    NoTerminalResults = "NoTerminalResults",
    NoUpstreamTables = "NoUpstreamTables",
    PartialDetails = "PartialDetails",
    Unavailable = "Unavailable",
}

/**
 * Coverage and redaction information for direct upstream tables.
 */
export interface SourceCoverage {
    coveragePercent:  number;
    partial:          boolean;
    restrictedTables: number;
    testedTables:     number;
    upstreamTables:   number;
    visibleTables:    number;
}

/**
 * Global latest-result counts used to compute the Metric score.
 */
export interface StatusCounts {
    aborted:  number;
    failed:   number;
    missing:  number;
    passed:   number;
    queued:   number;
    terminal: number;
}

/**
 * A single data quality test contributing to the rollup.
 */
export interface TestResult {
    /**
     * The asset the test runs against.
     */
    asset?: EntityReference;
    /**
     * Data quality dimension the test belongs to.
     */
    dimension?: string;
    /**
     * Result of the most recent run.
     */
    status?: string;
    /**
     * The test case.
     */
    testCase: EntityReference;
    /**
     * When the most recent run completed.
     */
    timestamp?: number;
}
