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
 * Read one native graph page and a bounded topology page over the resulting loaded prefixes.
 */
export interface NativeOntologyDataGraphPageRequest {
    loaded: LoadedPrefix[];
    page:   Selection;
}

export interface LoadedPrefix {
    bindingRevision: number;
    conceptId:       string;
    /**
     * Inclusive UUID high-water mark, including hidden rows traversed by a binding page. Absent
     * means no assets have been loaded for this concept. This is a context hint, not an
     * authorization grant.
     */
    throughAssetId?: string;
}

export interface Selection {
    after?:     string;
    conceptId?: string;
    kind:       Kind;
    limit?:     number;
    offset?:    number;
}

export enum Kind {
    Bindings = "bindings",
    Clusters = "clusters",
    Topology = "topology",
}
