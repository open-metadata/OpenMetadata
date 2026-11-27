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
 * Cache-derived state of a persona's compiled AI context document, as listed by `GET
 * /v1/personas/aiContext/status`. Read from the context cache without compiling — see
 * ADR:2026-10-14-persona-ai-context-status-reads-the-cache-and-pages-like-the-persona-list.
 */
export interface PersonaContextStatus {
    /**
     * State of the cached document. A persona with nothing cached reports `STALE`.
     */
    cacheState: CacheState;
    /**
     * Entities rendered into the cached document. Zero when nothing is cached.
     */
    entitiesIncluded: number;
    /**
     * Reason the latest compilation failed, when it did.
     */
    lastError?: string;
    /**
     * When the cached document was compiled. Absent when nothing is cached.
     */
    lastGeneratedAt?: number;
    /**
     * Id of the persona this status belongs to.
     */
    personaId: string;
    /**
     * Estimated tokens in the cached document, `ceil(characters / 4)` as on the document
     * endpoint. Zero when nothing is cached.
     */
    tokensEst: number;
}

/**
 * State of the cached document. A persona with nothing cached reports `STALE`.
 *
 * Current state of the compiled persona context document.
 */
export enum CacheState {
    Failed = "FAILED",
    Fresh = "FRESH",
    Generating = "GENERATING",
    Stale = "STALE",
}
