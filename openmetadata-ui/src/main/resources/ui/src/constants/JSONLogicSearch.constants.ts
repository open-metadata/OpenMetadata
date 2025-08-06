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
import { EntityReferenceFields } from '../enums/AdvancedSearch.enum';

export const GLOSSARY_ENTITY_FIELDS_KEYS: EntityReferenceFields[] = [
  EntityReferenceFields.REVIEWERS,
  EntityReferenceFields.UPDATED_BY,
];

export const TABLE_ENTITY_FIELDS_KEYS: EntityReferenceFields[] = [
  EntityReferenceFields.DATABASE,
  EntityReferenceFields.DATABASE_SCHEMA,
  EntityReferenceFields.TABLE_TYPE,
];

export const COMMON_ENTITY_FIELDS_KEYS: EntityReferenceFields[] = [
  EntityReferenceFields.SERVICE,
  EntityReferenceFields.OWNERS,
  EntityReferenceFields.DISPLAY_NAME,
  EntityReferenceFields.NAME,
  EntityReferenceFields.DESCRIPTION,
  EntityReferenceFields.TAG,
  EntityReferenceFields.DOMAIN,
  EntityReferenceFields.DATA_PRODUCT,
  EntityReferenceFields.TIER,
  EntityReferenceFields.EXTENSION,
];
