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
 * Names of the data quality dimensions OpenMetadata ships with — the ones the UI has an icon
 * and a dashboard slot for. A dimension is an entity now (Settings > Preferences > Data
 * Quality) and test definitions and test cases may be classified with any of them, custom ones
 * included, so this is a display aid and not the list of valid values. It is hand-written on
 * purpose: the schemas no longer type any field with it, so a generated copy would disappear on
 * the next `make generate-schema-ts`.
 */
export enum DataQualityDimensions {
  Accuracy = 'Accuracy',
  Completeness = 'Completeness',
  Consistency = 'Consistency',
  Integrity = 'Integrity',
  NoDimension = 'NoDimension',
  SQL = 'SQL',
  Uniqueness = 'Uniqueness',
  Validity = 'Validity',
}
