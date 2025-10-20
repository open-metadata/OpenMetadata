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
 * Search Request to find entities from Elastic Search based on different parameters.
 */
export interface SearchRequest {
    /**
     * If Need to apply the domain filter.
     */
    applyDomainFilter?: boolean;
    /**
     * Filter documents by deleted param.
     */
    deleted?: boolean;
    /**
     * Internal Object to filter by Domains.
     */
    domains?: any;
    /**
     * Exclude specified fields from the document body for each hit. Use this to exclude heavy
     * fields like 'columns' for better performance
     */
    excludeSourceFields?: string[];
    /**
     * Explain the results of the query. Defaults to false. Only for debugging purposes.
     */
    explain?: boolean;
    /**
     * Get document body for each hit
     */
    fetchSource?: boolean;
    /**
     * Field Name to match.
     */
    fieldName?: string;
    /**
     * Field Value in case of Aggregations.
     */
    fieldValue?: string;
    /**
     * Start Index for the req.
     */
    from?: number;
    /**
     * Get only selected fields of the document body for each hit. Empty value will return all
     * fields
     */
    includeSourceFields?: string[];
    /**
     * Index Name.
     */
    index?: string;
    /**
     * If true it will try to get the hierarchy of the entity.
     */
    isHierarchy?: boolean;
    /**
     * Elasticsearch query that will be used as a post_filter
     */
    postFilter?: string;
    /**
     * Query to be send to Search Engine.
     */
    query?: string;
    /**
     * Elasticsearch query that will be combined with the query_string query generator from the
     * `query` arg
     */
    queryFilter?: string;
    /**
     * When paginating, specify the search_after values. Use it ass
     * search_after=<val1>,<val2>,...
     */
    searchAfter?: any;
    /**
     * Enable semantic search using embeddings and RDF context. When true, combines vector
     * similarity with traditional BM25 scoring.
     */
    semanticSearch?: boolean;
    /**
     * Size to limit the no.of results returned.
     */
    size?: number;
    /**
     * Sort the search results by field, available fields to sort weekly_stats daily_stats,
     * monthly_stats, last_updated_timestamp.
     */
    sortFieldParam?: string;
    /**
     * Sort order asc for ascending or desc for descending, defaults to desc.
     */
    sortOrder?: string;
    /**
     * Track Total Hits.
     */
    trackTotalHits?: boolean;
}
