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

import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityType } from '../../enums/entity.enum';
import { Document } from '../../generated/entity/docStore/document';
import { normalizePersonaDocument } from '../../utils/CustomizePage/PersonaPage.utils';
import { getDocumentByFQN } from '../DocStoreAPI';

/**
 * Shared query plumbing for a single DocStore document by FQN. Any consumer
 * that wants a cache-aware read — page customisation hooks, sidebar navigation,
 * the My Data landing page — should go through {@link docStoreQueryKey} +
 * {@link docStoreQueryFn} so they all hit the same normalised cache slot.
 *
 * React Query deduplicates in-flight requests: if multiple components mount
 * simultaneously with the same FQN key (e.g. the sidebar navigation hook and
 * the My Data page both reading `persona.X`), only one network request fires
 * and both subscribers receive the result.
 *
 * {@link PERSONA_DOC_STALE_TIME} extends deduplication beyond concurrent
 * mounts: staggered subscribers (sidebar renders a tick before page body)
 * reuse the cached document instead of triggering a background refetch.
 * Matches the staleTime used in useResolvedAppMode for the same endpoint.
 */
export const PERSONA_DOC_STALE_TIME = 5 * 60 * 1000;

export const docStoreQueryKey = (fqn: string) => ['docStore', fqn] as const;

export const docStoreQueryFn = (fqn: string) => async (): Promise<Document> =>
  normalizePersonaDocument(await getDocumentByFQN(fqn));

/**
 * Derive the docStore FQN for a persona's UICustomization document.
 * Returns null when the persona has no FQN (disabled query guard).
 */
export const personaDocFqn = (
  persona?: {
    fullyQualifiedName?: string;
  } | null
): string | null =>
  persona?.fullyQualifiedName
    ? `${EntityType.PERSONA}${FQN_SEPARATOR_CHAR}${persona.fullyQualifiedName}`
    : null;
