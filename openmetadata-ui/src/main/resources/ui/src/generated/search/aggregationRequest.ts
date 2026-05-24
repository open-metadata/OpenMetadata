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
 * Request body for performing field aggregations with optional top_hits sub-aggregation.
 */
export interface AggregationRequest {
    /**
     * Whether to include deleted documents.
     */
    deleted?: boolean;
    /**
     * Field name to aggregate on (typically a keyword field like service.displayName.keyword).
     */
    fieldName: string;
    /**
     * Filter value for the aggregation include clause.
     */
    fieldValue?: string;
    /**
     * Name of the index to aggregate on.
     */
    index?: string;
    /**
     * Ordering mode for terms aggregation buckets. 'key' (default) sorts alphabetically by term
     * value and preserves existing behavior for all callers. 'relevance' ranks buckets so that
     * exact matches against the typed literal in fieldValue surface first, followed by prefix
     * matches, then substring matches. Relevance ordering activates only when fieldValue is a
     * wildcard-wrapped literal of the form '.*<literal>.*' (the convention used by the
     * OpenMetadata UI autocomplete dropdowns); otherwise the request silently falls back to
     * 'key' ordering.
     */
    orderBy?: OrderBy;
    /**
     * Query string to be sent to the search engine.
     */
    query?: string;
    /**
     * Free-text search query used to scope aggregation results to matching documents.
     */
    queryText?: string;
    /**
     * Size to limit the number of aggregation buckets returned.
     */
    size?: number;
    /**
     * List of fields to include from _source in the response (outside of top_hits).
     */
    sourceFields?: string[];
    /**
     * Optional top_hits sub-aggregation to fetch selected source fields per bucket.
     */
    topHits?: TopHits;
}

/**
 * Ordering mode for terms aggregation buckets. 'key' (default) sorts alphabetically by term
 * value and preserves existing behavior for all callers. 'relevance' ranks buckets so that
 * exact matches against the typed literal in fieldValue surface first, followed by prefix
 * matches, then substring matches. Relevance ordering activates only when fieldValue is a
 * wildcard-wrapped literal of the form '.*<literal>.*' (the convention used by the
 * OpenMetadata UI autocomplete dropdowns); otherwise the request silently falls back to
 * 'key' ordering.
 */
export enum OrderBy {
    Key = "key",
    Relevance = "relevance",
}

/**
 * Optional top_hits sub-aggregation to fetch selected source fields per bucket.
 */
export interface TopHits {
    /**
     * Number of top documents to return per bucket.
     */
    size?: number;
    /**
     * Field to sort the top hits on.
     */
    sortField?: string;
    /**
     * Sort order for top hits - asc or desc.
     */
    sortOrder?: SortOrder;
    [property: string]: any;
}

/**
 * Sort order for top hits - asc or desc.
 */
export enum SortOrder {
    Asc = "asc",
    Desc = "desc",
}
