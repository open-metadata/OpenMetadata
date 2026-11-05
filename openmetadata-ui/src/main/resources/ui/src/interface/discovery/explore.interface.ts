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

import { SearchIndex } from '../../enums/search.enum';

export type ExploreSearchIndex =
  | SearchIndex.DATA_PRODUCT
  | SearchIndex.TABLE
  | SearchIndex.COLUMN
  | SearchIndex.PIPELINE
  | SearchIndex.DASHBOARD
  | SearchIndex.DATABASE
  | SearchIndex.DATABASE_SCHEMA
  | SearchIndex.CHART
  | SearchIndex.MLMODEL
  | SearchIndex.TOPIC
  | SearchIndex.CONTAINER
  | SearchIndex.GLOSSARY_TERM
  | SearchIndex.TAG
  | SearchIndex.SEARCH_INDEX
  | SearchIndex.STORED_PROCEDURE
  | SearchIndex.DASHBOARD_DATA_MODEL
  | SearchIndex.API_COLLECTION
  | SearchIndex.API_ENDPOINT
  | SearchIndex.METRIC
  | SearchIndex.DIRECTORY
  | SearchIndex.FILE
  | SearchIndex.SPREADSHEET
  | SearchIndex.WORKSHEET
  | SearchIndex.KNOWLEDGE_PAGE_INDEX;
