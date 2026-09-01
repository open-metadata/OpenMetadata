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
 * Schema corresponding to a Data Quality Dimension
 */
export interface CreateDataQualityDimension {
    /**
     * Description of what this dimension measures and when to use it.
     */
    description?: string;
    /**
     * Name shown in the test library, dashboards and the dimension picker.
     */
    displayName?: string;
    /**
     * Fully qualified names of the domains the Data Quality Dimension belongs to.
     */
    domains?: string[];
    /**
     * Unique technical name used in the API. It cannot be changed after creation because test
     * definitions and test cases reference it.
     */
    name: string;
    /**
     * Owners of this data quality dimension.
     */
    owners?: EntityReference[];
    provider?: ProviderType;
    /**
     * UI style, holding the colour the dimension is rendered with.
     */
    style?: Style;
}

/**
 * This schema defines the EntityReference type used for referencing an entity.
 */
export interface EntityReference {
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Fully qualified name of the entity instance.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type: string;
}

/**
 * Type of provider of an entity. Some entities are provided by the `system`. Some are
 * entities created and provided by the `user`. Typically `system` provide entities can't be
 * deleted and can only be disabled.
 */
export enum ProviderType {
    Automation = "automation",
    System = "system",
    User = "user",
}

/**
 * UI style, holding the colour the dimension is rendered with.
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
