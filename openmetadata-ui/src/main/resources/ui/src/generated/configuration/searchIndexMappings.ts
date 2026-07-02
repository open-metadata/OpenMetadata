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
 * Admin-editable Elasticsearch/OpenSearch index mappings, persisted in settings and keyed
 * by language and entity type. The stored mapping is the effective mapping used when an
 * index is (re)created; it already carries the field-safety guards (ignore_above,
 * ignore_malformed, mapping limits) baked in at seed time.
 */
export interface SearchIndexMappings {
    /**
     * Mappings keyed by search index mapping language (e.g. 'en', 'jp', 'ru', 'zh'), then by
     * entity type (e.g. 'table', 'topic'). Each leaf value is the raw index mapping document.
     */
    languages?: { [key: string]: any };
}
