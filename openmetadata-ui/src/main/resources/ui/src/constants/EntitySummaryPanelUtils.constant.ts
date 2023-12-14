/*
 *  Copyright 2023 Collate.
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
import { SummaryEntityType } from '../enums/EntitySummary.enum';

export const SummaryListHighlightKeysMap = {
  [SummaryEntityType.COLUMN]: [
    'columns.name',
    'columns.children.name',
    'synonyms',
    'dataModel.columns.name',
    'dataModel.columns.description',
    'dataModel.columns.children.name',
  ],
  [SummaryEntityType.FIELD]: [], // not found any key in ElasticSearchClient.java file
  [SummaryEntityType.CHART]: ['charts.name', 'charts.description'],
  [SummaryEntityType.TASK]: ['tasks.name', 'tasks.description'],
  [SummaryEntityType.MLFEATURE]: ['mlFeatures.name', 'mlFeatures.description'],
  [SummaryEntityType.SCHEMAFIELD]: [], // not found any key in ElasticSearchClient.java file
};
