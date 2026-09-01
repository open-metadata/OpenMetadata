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
import type { OwnerRef } from '../../../types';

/**
 * Structural interface satisfied by any object that carries the fields Owner
 * needs. Both OpenMetadata and Collate's generated EntityReference types match
 * this shape, so neither repo needs to import the other's generated types.
 */
export interface OwnerLike {
  id: string;
  type?: string;
  name?: string;
  displayName?: string;
  href?: string;
}

export const toOwnerRef = (ref: OwnerLike): OwnerRef => ({
  id: ref.id,
  name: ref.name,
  displayName: ref.displayName,
  type: (ref.type ?? 'user') as OwnerRef['type'],
  href: ref.href,
});

export const toOwnerRefs = (refs?: OwnerLike[]): OwnerRef[] =>
  (refs ?? []).map(toOwnerRef);
