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
 * Configuration for SQL query parser selection for lineage and usage extraction.
 */
export interface QueryParserConfig {
    /**
     * Choose the SQL parser for lineage extraction:
     * • Auto (default): Automatically tries SqlGlot first, falls back to SqlFluff, then
     * SqlParse. Recommended for best results.
     * • SqlGlot: High-performance parser with excellent dialect support. Falls back to SqlParse
     * on failure.
     * • SqlFluff: Comprehensive parser with strong dialect support. Falls back to SqlParse on
     * failure.
     */
    type?: QueryParserType;
}

/**
 * Choose the SQL parser for lineage extraction:
 * • Auto (default): Automatically tries SqlGlot first, falls back to SqlFluff, then
 * SqlParse. Recommended for best results.
 * • SqlGlot: High-performance parser with excellent dialect support. Falls back to SqlParse
 * on failure.
 * • SqlFluff: Comprehensive parser with strong dialect support. Falls back to SqlParse on
 * failure.
 *
 * Type of SQL query parser to use for lineage and usage extraction. Auto mode is
 * recommended for best results.
 */
export enum QueryParserType {
    Auto = "Auto",
    SQLFluff = "SqlFluff",
    SQLGlot = "SqlGlot",
}
