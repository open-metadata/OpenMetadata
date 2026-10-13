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
import { Type } from '../../generated/entity/type';
import { getTypeByFQN } from '../metadataTypeAPI';

/**
 * Several widgets on one entity page read the same type definition (the
 * Custom Properties widget plus any number of single-property widgets).
 * Short enough that a property added in Settings shows up on the next visit,
 * long enough to cover widgets that mount a few ticks apart.
 */
export const TYPE_QUERY_STALE_TIME = 30 * 1000;

export const typeQueryKey = (entityType: string) =>
  ['metadataType', entityType] as const;

export const typeQueryFn = (entityType: string) => (): Promise<Type> =>
  getTypeByFQN(entityType);
