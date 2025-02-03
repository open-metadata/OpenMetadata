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
/**
 * This schema defines the entity hierarchy structure.
 */
export interface EntityHierarchy {
    /**
     * Other entities that are children of this entity.
     */
    children?: ChildElement[];
    /**
     * Description of the entity hierarchy.
     */
    description: string;
    /**
     * Display name that identifies this hierarchy.
     */
    displayName?: string;
    /**
     * A unique name that identifies an entity within the hierarchy. It captures name hierarchy
     * in the form of `rootEntity.childEntity`.
     */
    fullyQualifiedName?: string;
    /**
     * Unique identifier of an entity hierarchy instance.
     */
    id: string;
    /**
     * Preferred name for the entity hierarchy.
     */
    name: string;
    [property: string]: any;
}

/**
 * Other entities that are children of this entity.
 *
 * This schema defines the entity hierarchy structure.
 */
export interface ChildElement {
    /**
     * Other entities that are children of this entity.
     */
    children?: ChildElement[];
    /**
     * Description of the entity hierarchy.
     */
    description: string;
    /**
     * Display name that identifies this hierarchy.
     */
    displayName?: string;
    /**
     * A unique name that identifies an entity within the hierarchy. It captures name hierarchy
     * in the form of `rootEntity.childEntity`.
     */
    fullyQualifiedName?: string;
    /**
     * Unique identifier of an entity hierarchy instance.
     */
    id: string;
    /**
     * Preferred name for the entity hierarchy.
     */
    name: string;
    [property: string]: any;
}
