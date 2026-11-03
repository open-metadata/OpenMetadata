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
 * Payload for Incident Resolution tasks.
 */
export interface IncidentResolutionPayload {
    /**
     * When the incident was resolved.
     */
    endTime?: number;
    /**
     * URL to external incident ticket.
     */
    externalTicketUrl?: string;
    /**
     * Assets impacted by this incident.
     */
    impactedAssets?: EntityReference[];
    /**
     * Type of incident.
     */
    incidentType: IncidentType;
    /**
     * Measures to prevent recurrence.
     */
    preventiveMeasures?: string;
    /**
     * How the incident was resolved.
     */
    resolution?: string;
    /**
     * Root cause analysis.
     */
    rootCause?: string;
    /**
     * Severity of the incident.
     */
    severity: Severity;
    /**
     * When the incident started.
     */
    startTime?: number;
}

/**
 * Assets impacted by this incident.
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
 * Type of incident.
 */
export enum IncidentType {
    Custom = "Custom",
    DataQuality = "DataQuality",
    Freshness = "Freshness",
    Pipeline = "Pipeline",
    Schema = "Schema",
    Volume = "Volume",
}

/**
 * Severity of the incident.
 */
export enum Severity {
    Critical = "Critical",
    High = "High",
    Low = "Low",
    Medium = "Medium",
}
