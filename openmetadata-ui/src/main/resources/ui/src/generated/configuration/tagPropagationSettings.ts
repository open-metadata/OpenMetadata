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
 * Controls whether tags applied to a service, database or schema flow down to the assets
 * beneath them. Off by default: turning it on changes which tags every affected asset
 * reports, and therefore what existing tag-based policies match.
 */
export interface TagPropagationSettings {
    /**
     * Propagate tags from a parent down to its assets. Propagated labels are reported as
     * `Derived`, so they are read-only on the asset and disappear when the parent's tag is
     * removed.
     */
    enabled: boolean;
}
