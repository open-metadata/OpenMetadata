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
 * This schema defines the Team entity. A `Team` is a group of zero or more users and/or
 * other teams. Teams can own zero or more data assets. Hierarchical teams are supported
 * `Organization` -> `BusinessUnit` -> `Division` -> `Department`.
 */
export interface Team {
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    /**
     * Children teams. An `Organization` can have `BusinessUnit`, `Division` or `Department` as
     * children. A `BusinessUnit` can have `BusinessUnit`, `Division`, or `Department` as
     * children. A `Division` can have `Division` or `Department` as children. A `Department`
     * can have `Department` as children.
     */
    children?: EntityReference[];
    /**
     * Total count of Children teams.
     */
    childrenCount?: number;
    /**
     * Default roles of a team. These roles will be inherited by all the users that are part of
     * this team.
     */
    defaultRoles?: EntityReference[];
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of the team.
     */
    description?: string;
    /**
     * Name used for display purposes. Example 'Data Science team'.
     */
    displayName?: string;
    /**
     * Domain the Team belongs to.
     */
    domains?: EntityReference[];
    /**
     * Email address of the team.
     */
    email?: string;
    /**
     * External identifier for the team from an external identity provider (e.g., Azure AD group
     * ID).
     */
    externalId?: string;
    /**
     * FullyQualifiedName same as `name`.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this entity.
     */
    href?: string;
    id:    string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Roles that a team is inheriting through membership in teams that have set team default
     * roles.
     */
    inheritedRoles?: EntityReference[];
    /**
     * Can any user join this team during sign up? Value of true indicates yes, and false no.
     */
    isJoinable?: boolean;
    /**
     * A unique name of the team typically the team ID from an identity provider. Example -
     * group Id from LDAP.
     */
    name: string;
    /**
     * Owner of this team.
     */
    owners?: EntityReference[];
    /**
     * List of entities owned by the team.
     */
    owns?: EntityReference[];
    /**
     * Parent teams. For an `Organization` the `parent` is always null. A `BusinessUnit` always
     * has only one parent of type `BusinessUnit` or an `Organization`. A `Division` can have
     * multiple parents of type `BusinessUnit` or `Division`. A `Department` can have multiple
     * parents of type `Division` or `Department`.
     */
    parents?: EntityReference[];
    /**
     * Policies that is attached to this team.
     */
    policies?: EntityReference[];
    /**
     * Team profile information.
     */
    profile?: Profile;
    /**
     * Team type
     */
    teamType?: TeamType;
    /**
     * Last update time corresponding to the new version of the entity in Unix epoch time
     * milliseconds.
     */
    updatedAt?: number;
    /**
     * User who made the update.
     */
    updatedBy?: string;
    /**
     * Total count of users that are part of the team.
     */
    userCount?: number;
    /**
     * Users that are part of the team.
     */
    users?: EntityReference[];
    /**
     * Metadata version of the entity.
     */
    version?: number;
}

/**
 * Change that lead to this version of the entity.
 *
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
 * Children teams. An `Organization` can have `BusinessUnit`, `Division` or `Department` as
 * children. A `BusinessUnit` can have `BusinessUnit`, `Division`, or `Department` as
 * children. A `Division` can have `Division` or `Department` as children. A `Department`
 * can have `Department` as children.
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
 * Team profile information.
 *
 * This schema defines the type for a profile of a user, team, or organization.
 */
export interface Profile {
    images?:       ImageList;
    subscription?: MessagingProvider;
}

/**
 * Links to a list of images of varying resolutions/sizes.
 */
export interface ImageList {
    image?:    string;
    image192?: string;
    image24?:  string;
    image32?:  string;
    image48?:  string;
    image512?: string;
    image72?:  string;
}

/**
 * Holds the Subscription Config for different types
 */
export interface MessagingProvider {
    gChat?:   Webhook;
    generic?: Webhook;
    msTeams?: Webhook;
    slack?:   Webhook;
}

/**
 * This schema defines webhook for receiving events from OpenMetadata.
 */
export interface Webhook {
    /**
     * Endpoint to receive the webhook events over POST requests.
     */
    endpoint?: string;
    /**
     * Custom headers to be sent with the webhook request.
     */
    headers?: { [key: string]: any };
    /**
     * HTTP operation to send the webhook request. Supports POST or PUT.
     */
    httpMethod?: HTTPMethod;
    /**
     * Query parameters to be added to the webhook request URL.
     */
    queryParams?: { [key: string]: any };
    /**
     * List of receivers to send mail to
     */
    receivers?: string[];
    /**
     * Secret set by the webhook client used for computing HMAC SHA256 signature of webhook
     * payload and sent in `X-OM-Signature` header in POST requests to publish the events.
     */
    secretKey?: string;
    /**
     * Send the Event to Admins
     */
    sendToAdmins?: boolean;
    /**
     * Send the Event to Followers
     */
    sendToFollowers?: boolean;
    /**
     * Send the Event to Owners
     */
    sendToOwners?: boolean;
}

/**
 * HTTP operation to send the webhook request. Supports POST or PUT.
 */
export enum HTTPMethod {
    Post = "POST",
    Put = "PUT",
}

/**
 * Team type
 *
 * Organization is the highest level entity. An Organization has one of more Business Units,
 * Division, Departments, Group, or Users. A Business Unit has one or more Divisions,
 * Departments, Group, or Users. A Division has one or more Divisions, Departments, Group,
 * or Users. A Department has one or more Departments, Group, or Users. A Group has only
 * Users
 */
export enum TeamType {
    BusinessUnit = "BusinessUnit",
    Department = "Department",
    Division = "Division",
    Group = "Group",
    Organization = "Organization",
}
