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
import { EntityType } from '../../enums/entity.enum';
import { LineageLens } from '../../generated/api/lineage/lineageScene';

// Picking a domain or data product opens it through its own lens, not the
// Service lens, whose breadcrumb would name one of its assets instead.
export const LENS_BY_ENTITY_TYPE: Partial<Record<EntityType, LineageLens>> = {
  [EntityType.DOMAIN]: LineageLens.Domain,
  [EntityType.DATA_PRODUCT]: LineageLens.DataProduct,
};

// A 404 means the entity is gone and a 403 that it can't be viewed; any other
// failed fetch can be retried.
export const ENTITY_LOAD_ERRORS: Record<number, 'missing' | 'denied'> = {
  403: 'denied',
  404: 'missing',
};
