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
 * A NotificationTemplate defines the default formatting template for notifications of a
 * specific entity type.
 */
export interface NotificationTemplate {
    /**
     * Change that lead to this version of the template.
     */
    changeDescription?: ChangeDescription;
    /**
     * When `true` indicates the template has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of the template purpose and usage.
     */
    description?: string;
    /**
     * Display Name that identifies this template.
     */
    displayName?: string;
    /**
     * Fully qualified name for the template.
     */
    fullyQualifiedName?: string;
    /**
     * Link to this template resource.
     */
    href?: string;
    /**
     * Unique identifier of this template instance.
     */
    id: string;
    /**
     * Bot user that performed the action on behalf of the actual user.
     */
    impersonatedBy?: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Indicates if this system template has been modified from its default version. Only
     * applicable to system templates.
     */
    isModifiedFromDefault?: boolean;
    /**
     * Name for the notification template (e.g., 'Default Table Template', 'Custom Pipeline
     * Alerts').
     */
    name: string;
    /**
     * Provider of the template. System templates are pre-loaded and cannot be deleted. User
     * templates are created by users and can be deleted.
     */
    provider?: ProviderType;
    /**
     * Handlebars HTML template body with placeholders.
     */
    templateBody: string;
    /**
     * Handlebars template for the email subject line with placeholders.
     */
    templateSubject: string;
    /**
     * Last update time corresponding to the new version of the template.
     */
    updatedAt?: number;
    /**
     * User who made the update.
     */
    updatedBy?: string;
    /**
     * Metadata version of the template.
     */
    version?: number;
}

/**
 * Change that lead to this version of the template.
 *
 * Description of the change.
 *
 * Change that lead to this version of the entity.
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
 * Provider of the template. System templates are pre-loaded and cannot be deleted. User
 * templates are created by users and can be deleted.
 *
 * Type of provider of an entity. Some entities are provided by the `system`. Some are
 * entities created and provided by the `user`. Typically `system` provide entities can't be
 * deleted and can only be disabled. Some apps such as AutoPilot create entities with
 * `automation` provider type. These entities can be deleted by the user.
 */
export enum ProviderType {
    Automation = "automation",
    System = "system",
    User = "user",
}
