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
 * This schema defines the Page entity. A Page is a landing page, schema page to customize
 * in OpenMetadata.
 */
export interface Page {
    /**
     * Domains this page belongs to.
     */
    domains?: EntityReference[];
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
 * Domains this page belongs to.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * This schema defines the EntityReference type used for referencing an entity.
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
