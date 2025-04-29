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
 * Create tag API request
 */
export interface CreateTag {
    /**
     * Fully qualified names of tags associated with this tag
     */
    associatedTags?: string[];
    /**
     * Name of the classification that this tag is part of.
     */
    classification?: string;
    /**
     * Unique name of the classification
     */
    description: string;
    /**
     * Display Name that identifies this tag.
     */
    displayName?: string;
    /**
     * Fully qualified name of the domain the Table belongs to.
     */
    domain?: string;
    /**
     * Children tags under this group are mutually exclusive. When mutually exclusive is `true`
     * the tags from this group are used to **classify** an entity. An entity can only be in one
     * class - example, it can only be either `tier1` or `tier2` and not both. When mutually
     * exclusive is `false`, the tags from this group are used to **categorize** an entity. An
     * entity can be in multiple categories simultaneously - example a customer can be
     * `newCustomer` and `atRisk` simultaneously.
     */
    mutuallyExclusive?: boolean;
    name:               string;
    /**
     * Fully qualified name of the parent tag. When null, the term is at the root of the
     * classification.
     */
    parent?:   string;
    provider?: ProviderType;
    style?:    Style;
}

/**
 * Type of provider of an entity. Some entities are provided by the `system`. Some are
 * entities created and provided by the `user`. Typically `system` provide entities can't be
 * deleted and can only be disabled.
 */
export enum ProviderType {
    System = "system",
    User = "user",
}

/**
 * UI Style is used to associate a color code and/or icon to entity to customize the look of
 * that entity in UI.
 */
export interface Style {
    /**
     * Hex Color Code to mark an entity such as GlossaryTerm, Tag, Domain or Data Product.
     */
    color?: string;
    /**
     * An icon to associate with GlossaryTerm, Tag, Domain or Data Product.
     */
    iconURL?: string;
}
