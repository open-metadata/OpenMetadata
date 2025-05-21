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
 * Contains UI customization details for a Persona.
 */
export interface UICustomization {
    changeDescription?: ChangeDescription;
    /**
     * Description of the UI customization.
     */
    description?: string;
    /**
     * Name used for display purposes.
     */
    displayName?: string;
    href?:        string;
    id:           string;
    /**
     * A unique name for the UI customization configuration.
     */
    name: string;
    /**
     * Site-wide navigation configuration.
     */
    navigation?: NavigationItem[];
    /**
     * List of Pages in the UI customization.
     */
    pages:      Team[];
    updatedAt?: number;
    updatedBy?: string;
    version?:   number;
}

/**
 * Description of the change.
 */
export interface ChangeDescription {
    changeSummary?: { [key: string]: ChangeSummary };
    /**
     * Names of fields added during the version changes.
     */
    fieldsAdded?: FieldChange[];
    /**
     * Fields deleted during the version changes with old value before deleted.
     */
    fieldsDeleted?: FieldChange[];
    /**
     * Fields modified during the version changes with old and new values.
     */
    fieldsUpdated?: FieldChange[];
    /**
     * When a change did not result in change, this could be same as the current version.
     */
    previousVersion?: number;
}

export interface ChangeSummary {
    changedAt?: number;
    /**
     * Name of the user or bot who made this change
     */
    changedBy?:    string;
    changeSource?: ChangeSource;
    [property: string]: any;
}

/**
 * The source of the change. This will change based on the context of the change (example:
 * manual vs programmatic)
 */
export enum ChangeSource {
    Automated = "Automated",
    Derived = "Derived",
    Ingested = "Ingested",
    Manual = "Manual",
    Propagated = "Propagated",
    Suggested = "Suggested",
}

export interface FieldChange {
    /**
     * Name of the entity field that changed.
     */
    name?: string;
    /**
     * New value of the field. Note that this is a JSON string and use the corresponding field
     * type to deserialize it.
     */
    newValue?: any;
    /**
     * Previous value of the field. Note that this is a JSON string and use the corresponding
     * field type to deserialize it.
     */
    oldValue?: any;
}

/**
 * Defines a navigation item in the UI navigation menu.
 */
export interface NavigationItem {
    /**
     * Optional sub-navigation items.
     */
    children?: NavigationItem[];
    /**
     * Unique identifier for the navigation item.
     */
    id: string;
    /**
     * Determine if item is visible or not
     */
    isHidden?: boolean;
    /**
     * Reference to a Page ID that this navigation item links to.
     */
    pageId: string;
    /**
     * Display title of the navigation item.
     */
    title: string;
}

/**
 * This schema defines the Page entity. A Page is a landing page, schema page to customize
 * in OpenMetadata.
 */
export interface Team {
    /**
     * Domain this page belongs to.
     */
    domain?: EntityReference;
    /**
     * Entity Type.
     */
    entityType: EntityType;
    /**
     * KnowledgePanels that are part of this Page.
     */
    knowledgePanels: EntityReference[];
    /**
     * Configuration for the Knowledge Panel.
     */
    layout:   { [key: string]: any };
    pageType: PageType;
    /**
     * Persona this page belongs to.
     */
    persona?: EntityReference;
    /**
     * Tabs included in this page.
     */
    tabs?: Tab[];
}

/**
 * Domain this page belongs to.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * KnowledgePanels that are part of this Page.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Persona this page belongs to.
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
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
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
 * Entity Type.
 */
export enum EntityType {
    Page = "Page",
}

/**
 * This schema defines the type used for describing different types of pages.
 */
export enum PageType {
    APICollection = "APICollection",
    APIEndpoint = "APIEndpoint",
    Container = "Container",
    Dashboard = "Dashboard",
    DashboardDataModel = "DashboardDataModel",
    Database = "Database",
    DatabaseSchema = "DatabaseSchema",
    Domain = "Domain",
    Glossary = "Glossary",
    GlossaryTerm = "GlossaryTerm",
    LandingPage = "LandingPage",
    Metric = "Metric",
    MlModel = "MlModel",
    Pipeline = "Pipeline",
    SearchIndex = "SearchIndex",
    StoredProcedure = "StoredProcedure",
    Table = "Table",
    Topic = "Topic",
}

/**
 * This schema defines a Tab within a Page.
 */
export interface Tab {
    /**
     * DisplayName of the tab.
     */
    displayName?: string;
    /**
     * Weather tab can be edit by the user or not.
     */
    editable?: boolean;
    id:        string;
    /**
     * KnowledgePanels that are part of this Tab.
     */
    knowledgePanels?: EntityReference[];
    /**
     * Layout configuration for this tab.
     */
    layout: { [key: string]: any };
    /**
     * Name of the tab.
     */
    name: string;
}
