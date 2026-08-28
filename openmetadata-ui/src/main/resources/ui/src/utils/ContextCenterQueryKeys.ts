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
 * Per-entity React Query keys for Context Center sidebar badge counts. Each
 * entity's create/delete/restore call sites invalidate only their own key so
 * e.g. creating an article doesn't also re-fetch the documents/memories/
 * archive counts. A document soft-delete/restore affects both the documents
 * and archive counts and should invalidate both keys.
 */
export const CONTEXT_CENTER_ARTICLES_COUNT_QUERY_KEY = [
  'context-center-articles-count',
];
export const CONTEXT_CENTER_DOCUMENTS_COUNT_QUERY_KEY = [
  'context-center-documents-count',
];
export const CONTEXT_CENTER_ARCHIVE_COUNT_QUERY_KEY = [
  'context-center-archive-count',
];
export const CONTEXT_CENTER_MEMORIES_COUNT_QUERY_KEY = [
  'context-center-memories-count',
];
