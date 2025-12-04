/*
 *  Copyright 2025 Collate.
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
 * Configuration for SQL lineage parser selection.
 */
export interface LineageParserConfig {
    /**
     * Choose the SQL parser for lineage extraction:
     * • sqlglot (default): Recommended - 100% parse success, schema-aware, 27x faster
     * • sqlfluff: Legacy parser - may have parsing issues and timeouts
     * • sqlparse: Generic ANSI SQL fallback
     * • auto: Automatically tries sqlglot first, falls back to sqlparse
     */
    parserType?: LineageParserType;
}

/**
 * Choose the SQL parser for lineage extraction:
 * • sqlglot (default): Recommended - 100% parse success, schema-aware, 27x faster
 * • sqlfluff: Legacy parser - may have parsing issues and timeouts
 * • sqlparse: Generic ANSI SQL fallback
 * • auto: Automatically tries sqlglot first, falls back to sqlparse
 *
 * Type of SQL parser to use for lineage extraction. SQLGlot is recommended for best
 * accuracy and performance (100% parse success vs 10% for SQLFluff).
 */
export enum LineageParserType {
    Auto = "auto",
    Sqlfluff = "sqlfluff",
    Sqlglot = "sqlglot",
    Sqlparse = "sqlparse",
}
