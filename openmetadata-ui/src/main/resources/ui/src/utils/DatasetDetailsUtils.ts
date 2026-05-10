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

import { TabSpecificField } from '../enums/entity.enum';

// Fields for table details first paint. Excludes columns (paginated separately) and
// `extension` (custom properties — only the Custom Properties tab consumes this; we fetch
// it lazily when the user activates that tab via {@link customPropertiesFields}). Custom
// extension payloads can run into hundreds of KB on tables with many user-defined
// properties; trimming it saves wire bytes on every initial table-page load.
// eslint-disable-next-line max-len
export const defaultFields = `${TabSpecificField.FOLLOWERS},${TabSpecificField.JOINS},${TabSpecificField.TAGS},${TabSpecificField.OWNERS},${TabSpecificField.DATAMODEL},${TabSpecificField.TABLE_CONSTRAINTS},${TabSpecificField.SCHEMA_DEFINITION},${TabSpecificField.DOMAINS},${TabSpecificField.DATA_PRODUCTS},${TabSpecificField.VOTES}`;

// Legacy fields that include columns - only use when pagination is not needed
// eslint-disable-next-line max-len
export const defaultFieldsWithColumns = `${TabSpecificField.COLUMNS},${TabSpecificField.FOLLOWERS},${TabSpecificField.JOINS},${TabSpecificField.TAGS},${TabSpecificField.OWNERS},${TabSpecificField.DATAMODEL},${TabSpecificField.TABLE_CONSTRAINTS},${TabSpecificField.SCHEMA_DEFINITION},${TabSpecificField.DOMAINS},${TabSpecificField.DATA_PRODUCTS},${TabSpecificField.VOTES}`;

// Lazy field set requested only when the Custom Properties tab is activated. Pairs with
// the trim of {@link defaultFields} above.
export const customPropertiesFields = `${TabSpecificField.EXTENSION}`;

export const commonTableFields = `${TabSpecificField.TAGS},${TabSpecificField.OWNERS},${TabSpecificField.DOMAINS},${TabSpecificField.DATA_PRODUCTS},${TabSpecificField.CERTIFICATION}`;
