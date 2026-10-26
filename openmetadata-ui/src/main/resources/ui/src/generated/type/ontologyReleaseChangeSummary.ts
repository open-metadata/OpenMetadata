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
 * Member change counts of a release against the release that was active when it was
 * captured. The counts partition the rows of GET /v1/ontologyReleases/{id}/diff with its
 * default base.
 */
export interface OntologyReleaseChangeSummary {
    added:   number;
    changed: number;
    /**
     * Existing concepts or properties newly marked deprecated. Disjoint from added, changed and
     * removed. New captures always set this count; its absence on older summaries means the
     * total is unavailable.
     */
    deprecated?: number;
    removed:     number;
}
