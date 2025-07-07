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
 * Team entity
 */
export interface CreateTeam {
    /**
     * Children teams. An `Organization` can have `BusinessUnit`, `Division` or `Department` as
     * children. A `BusinessUnit` can have `BusinessUnit`, `Division`, or `Department` as
     * children. A `Division` can have `Division` or `Department` as children. A `Department`
     * can have `Department` as children.
     */
    children?: string[];
    /**
     * Roles to be assigned to all users that are part of this team.
     */
    defaultRoles?: string[];
    /**
     * Optional description of the team.
     */
    description?: string;
    /**
     * Optional name used for display purposes. Example 'Marketing Team'.
     */
    displayName?: string;
    /**
     * Domains the team belongs to.
     */
    domains?: string[];
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
     * Can any user join this team during sign up? Value of true indicates yes, and false no.
     */
    isJoinable?: boolean;
    name:        string;
    /**
     * Owners sof this team.
     */
    owners?: EntityReference[];
    /**
     * Parent teams. For an `Organization` the `parent` is always null. A `BusinessUnit` always
     * has only one parent of type `BusinessUnit` or an `Organization`. A `Division` can have
     * multiple parents of type `BusinessUnit` or `Division`. A `Department` can have multiple
     * parents of type `Division` or `Department`.
     */
    parents?: string[];
    /**
     * Policies that is attached to this team.
     */
    policies?: string[];
    /**
     * Optional team profile information.
     */
    profile?: Profile;
    /**
     * Team type
     */
    teamType: TeamType;
    /**
     * Optional IDs of users that are part of the team.
     */
    users?: string[];
}

/**
 * Owners sof this team.
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
 * Optional team profile information.
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
