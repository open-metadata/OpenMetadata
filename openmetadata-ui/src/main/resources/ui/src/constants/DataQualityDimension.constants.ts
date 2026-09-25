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
 * Field the search document denormalizes the dimension name into. It is deliberately not
 * `dataQualityDimension`: that name belongs to the EntityReference on the TestCase entity, and
 * indexing a bare name under it makes a search hit fail to deserialize back into a TestCase.
 *
 * Only raw Elasticsearch queries and aggregations use this. The `dataQualityDimension` REST query
 * parameter is unaffected — the server maps it onto this field.
 */
export const DATA_QUALITY_DIMENSION_INDEX_FIELD = 'dataQualityDimensionName';

/**
 * Colours offered when creating or editing a data quality dimension. The system dimensions
 * seeded by the server pick their colour from this same list.
 *
 * Each carries the label key its swatch is announced with — a screen reader saying "#175CD3"
 * is not a usable name. The keys are the shared colour labels the ontology palette also uses.
 */
export const DIMENSION_COLOR_OPTIONS = [
  { color: '#175CD3', labelKey: 'label.color-dark-blue' },
  { color: '#2E90FA', labelKey: 'label.color-blue' },
  { color: '#067647', labelKey: 'label.color-green' },
  { color: '#B54708', labelKey: 'label.color-yellow' },
  { color: '#C4320A', labelKey: 'label.color-orange' },
  { color: '#D92D20', labelKey: 'label.color-red' },
  { color: '#7A5AF8', labelKey: 'label.color-violet' },
  { color: '#6938EF', labelKey: 'label.color-purple' },
  { color: '#C11574', labelKey: 'label.color-pink' },
  { color: '#099250', labelKey: 'label.color-teal' },
  { color: '#475467', labelKey: 'label.color-gray' },
];

export const DIMENSION_COLOR_PALETTE = DIMENSION_COLOR_OPTIONS.map(
  ({ color }) => color
);
