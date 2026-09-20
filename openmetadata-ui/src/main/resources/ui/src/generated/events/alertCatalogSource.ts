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
 * One source an alert can watch: its kind, and the filters and triggers it supports, by
 * name.
 */
export interface AlertCatalogSource {
    /**
     * Entity types that can contain this source, so a name filter can be scoped to descendants.
     */
    containerEntities?: string[];
    /**
     * Names of the filters this source supports, in the order they are offered.
     */
    filters?: string[];
    kind:     SourceKind;
    /**
     * Labels by filter or trigger name, where this source calls one differently from its
     * definition.
     */
    labels?: { [key: string]: any };
    /**
     * Name of the source, as alerts store it.
     */
    name: string;
    /**
     * Settings of a filter or trigger for this source, by its name, such as which fields count
     * as the schema of this asset type.
     */
    parameters?: { [key: string]: any };
    /**
     * A source of an earlier release. Never offered; kept so alerts saved then still build.
     */
    removed?: boolean;
    /**
     * Filters this source supported in an earlier release. Never offered; kept so alerts saved
     * then still build.
     */
    removedFilters?: string[];
    /**
     * Triggers this source supported in an earlier release. Never offered; kept so alerts saved
     * then still build.
     */
    removedTriggers?: string[];
    /**
     * Names of the triggers this source supports, in the order they are offered.
     */
    triggers?: string[];
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
