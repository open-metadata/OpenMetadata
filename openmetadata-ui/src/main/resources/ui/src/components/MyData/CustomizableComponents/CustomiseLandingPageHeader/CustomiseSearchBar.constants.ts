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

import { ExplorePageTabs } from '../../../../enums/Explore.enum';
import { SearchIndex } from '../../../../enums/search.enum';

type SearchIndexPathMap = Partial<
  Record<SearchIndex, ExplorePageTabs | string>
>;

// Keep this map near the landing search component instead of SearchClassBase so
// the /my-data shell does not import advanced-search setup before interaction.
export const SEARCH_INDEX_PATH_MAP: SearchIndexPathMap = {
  [SearchIndex.TABLE]: ExplorePageTabs.TABLES,
  [SearchIndex.COLUMN]: ExplorePageTabs.COLUMNS,
  [SearchIndex.STORED_PROCEDURE]: ExplorePageTabs.STORED_PROCEDURE,
  [SearchIndex.DATABASE]: ExplorePageTabs.DATABASE,
  [SearchIndex.DATABASE_SCHEMA]: ExplorePageTabs.DATABASE_SCHEMA,
  [SearchIndex.DATABASE_SERVICE]: ExplorePageTabs.DATABASE_SERVICE,
  [SearchIndex.DASHBOARD]: ExplorePageTabs.DASHBOARDS,
  [SearchIndex.CHART]: ExplorePageTabs.CHARTS,
  [SearchIndex.DASHBOARD_DATA_MODEL]: ExplorePageTabs.DASHBOARD_DATA_MODEL,
  [SearchIndex.DASHBOARD_SERVICE]: ExplorePageTabs.DASHBOARD_SERVICE,
  [SearchIndex.PIPELINE]: ExplorePageTabs.PIPELINES,
  [SearchIndex.PIPELINE_SERVICE]: ExplorePageTabs.PIPELINE_SERVICE,
  [SearchIndex.TOPIC]: ExplorePageTabs.TOPICS,
  [SearchIndex.MESSAGING_SERVICE]: ExplorePageTabs.MESSAGING_SERVICE,
  [SearchIndex.MLMODEL]: ExplorePageTabs.MLMODELS,
  [SearchIndex.ML_MODEL_SERVICE]: ExplorePageTabs.ML_MODEL_SERVICE,
  [SearchIndex.CONTAINER]: ExplorePageTabs.CONTAINERS,
  [SearchIndex.STORAGE_SERVICE]: ExplorePageTabs.STORAGE_SERVICE,
  [SearchIndex.SEARCH_INDEX]: ExplorePageTabs.SEARCH_INDEX,
  [SearchIndex.SEARCH_SERVICE]: ExplorePageTabs.SEARCH_INDEX_SERVICE,
  [SearchIndex.API_COLLECTION]: ExplorePageTabs.API_COLLECTION,
  [SearchIndex.API_ENDPOINT]: ExplorePageTabs.API_ENDPOINT,
  [SearchIndex.API_SERVICE]: ExplorePageTabs.API_SERVICE,
  [SearchIndex.GLOSSARY_TERM]: ExplorePageTabs.GLOSSARY,
  [SearchIndex.TAG]: ExplorePageTabs.TAG,
  [SearchIndex.DATA_PRODUCT]: ExplorePageTabs.DATA_PRODUCT,
  [SearchIndex.KNOWLEDGE_PAGE_INDEX]: 'knowledgePages',
  [SearchIndex.METRIC]: ExplorePageTabs.METRIC,
  [SearchIndex.DIRECTORY]: ExplorePageTabs.DIRECTORIES,
  [SearchIndex.FILE]: ExplorePageTabs.FILES,
  [SearchIndex.SPREADSHEET]: ExplorePageTabs.SPREADSHEETS,
  [SearchIndex.WORKSHEET]: ExplorePageTabs.WORKSHEETS,
};
