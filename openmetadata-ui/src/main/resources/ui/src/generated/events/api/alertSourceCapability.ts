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
 * One source of an alert type, as it relates to a selection of sources.
 */
export interface AlertSourceCapability {
    /**
     * False when adding this source to the selection would break a rule. The form disables it
     * and shows the reason.
     */
    canJoin?: boolean;
    kind:     SourceKind;
    name:     string;
    /**
     * Why the source cannot join the selection.
     */
    reason?:   string;
    selected?: boolean;
    /**
     * For a selected source: why, with what has been chosen so far, it can never produce a
     * match. The alert still saves.
     */
    warning?: string;
}

/**
 * Source names look alike but mean different things. Entity: the change events of one asset
 * type. Activity: collaboration items. All: the wildcard.
 */
export enum SourceKind {
    Activity = "activity",
    All = "all",
    Entity = "entity",
}
