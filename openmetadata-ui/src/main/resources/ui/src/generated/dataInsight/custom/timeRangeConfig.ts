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
 * Structured time-range intent for a Data Insight chart. Resolved into (startMillis,
 * endMillis, live) by the server-side resolver
 * (org.openmetadata.service.jdbi3.TimeRangeConfigResolver) for both chart preview and
 * scheduled refresh. One of four variants discriminated by the `type` field.
 * `existingJavaType` binds every reference to the handwritten sealed interface (with record
 * variants and Jackson @JsonTypeInfo / @JsonSubTypes) instead of generating one, so callers
 * get the typed value directly.
 *
 * Current state with no historical window. Resolves to (0, runStart, live=true); the
 * executor reads the live data-asset search index rather than the time-series Data Insights
 * index. Use for current-state KPIs and inventories (e.g. 'how many tables right now').
 *
 * Sliding trailing window. Resolves to (runStart - value*unit, runStart, live=false). The
 * window moves on every refresh, so a 'last 7 days' chart updates daily. Use for trends
 * (e.g. 'last 30 days', 'trailing year').
 *
 * Last N complete calendar periods, aligned to UTC boundaries. Resolves to (startOf(N units
 * ago, unit), startOf(current unit), live=false). The window snaps to calendar boundaries
 * and only changes when the next boundary crosses. Use for recurring reports (e.g. 'last
 * completed quarter', 'prior year').
 *
 * Frozen absolute range in epoch milliseconds (UTC). Resolves to (startTimestamp,
 * endTimestamp, live=false) — never changes on refresh. Use for retrospective reports and
 * named periods (e.g. 'Q1 2026', 'Jan-Mar 2025'). startTimestamp must be less than
 * endTimestamp.
 */
export interface TimeRangeConfig {
    /**
     * Discriminator field.
     */
    type:  Type;
    unit?: TimeUnit;
    /**
     * Number of units in the trailing window. Must be at least 1.
     *
     * Number of complete periods to include. Must be at least 1.
     */
    value?: number;
    /**
     * Window end in epoch milliseconds (UTC).
     */
    endTimestamp?: number;
    /**
     * Window start in epoch milliseconds (UTC).
     */
    startTimestamp?: number;
}

/**
 * Discriminator field.
 */
export enum Type {
    CompletedPeriod = "CompletedPeriod",
    FixedWindow = "FixedWindow",
    LiveSnapshot = "LiveSnapshot",
    RollingWindow = "RollingWindow",
}

/**
 * Calendar unit for rolling and completed time windows. All boundary math is performed in
 * UTC.
 */
export enum TimeUnit {
    Day = "day",
    Month = "month",
    Quarter = "quarter",
    Week = "week",
    Year = "year",
}
