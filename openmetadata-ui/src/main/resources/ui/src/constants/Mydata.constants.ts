/*
 *  Copyright 2022 Collate.
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

import { SearchIndex } from '../enums/search.enum';

export const myDataSearchIndex =
  // eslint-disable-next-line max-len
  `${SearchIndex.TABLE},${SearchIndex.TOPIC},${SearchIndex.DASHBOARD},${SearchIndex.PIPELINE},${SearchIndex.MLMODEL},${SearchIndex.STORED_PROCEDURE},${SearchIndex.DASHBOARD_DATA_MODEL},${SearchIndex.DATABASE},${SearchIndex.DATABASE_SCHEMA},${SearchIndex.DATABASE},${SearchIndex.DATABASE_SERVICE},${SearchIndex.MESSAGING_SERVICE},${SearchIndex.PIPELINE_SERVICE},${SearchIndex.SEARCH_SERVICE},${SearchIndex.DASHBOARD_SERVICE},${SearchIndex.ML_MODEL_SERVICE},${SearchIndex.STORAGE_SERVICE},${SearchIndex.SEARCH_INDEX}` as SearchIndex;

export const observerOptions = {
  root: null,
  rootMargin: '0px',
  threshold: 1.0,
};
