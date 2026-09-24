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
import { EntityReference } from '../generated/entity/type';

/**
 * Stable content key for a domain list, used to skip no-op `setActiveDomain`
 * updates that would otherwise churn the state's array identity on every
 * context re-render — remounting the domain picker subtree and collapsing an
 * open picker mid-interaction. Keyed on every render-relevant field (not just
 * identity) so refreshed metadata — a renamed domain, a flipped `inherited`, a
 * changed link — still updates the chip, while unchanged data stays
 * reference-stable. JSON encoding keeps it collision-safe.
 *
 * Shared by DomainLabel and DomainLabelV2 so the two cannot drift apart again.
 */
export const getDomainsContentKey = (list: EntityReference[]): string =>
  JSON.stringify(
    list.map((d) => [
      d.id,
      d.fullyQualifiedName,
      d.name,
      d.displayName,
      d.inherited,
      d.href,
    ])
  );
