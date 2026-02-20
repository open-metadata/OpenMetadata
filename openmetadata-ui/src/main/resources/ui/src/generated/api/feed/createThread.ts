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
 * Create thread request
 */
export interface CreateThread {
    /**
     * Data asset about which this thread is created for with format
     * <#E::{entities}::{entityType}::{field}::{fieldValue}
     */
    about: string;
    /**
     * User or team this thread is addressed to in format
     * <#E::{entities}::{entityName}::{field}::{fieldValue}.
     */
    addressedTo?:         string;
    announcementDetails?: AnnouncementDetails;
    /**
     * Details about the Chatbot conversation. This is only applicable if thread is of type
     * Chatbot.
     */
    chatbotDetails?: ChatbotDetails;
    /**
     * Domain the entity belongs to.
     */
    domains?: string[];
    /**
     * Name of the User (regular user or bot) posting the message
     */
    from: string;
    /**
     * Message
     */
    message:      string;
    taskDetails?: CreateTaskDetails;
    type?:        ThreadType;
}

/**
 * Details about the announcement. This is only applicable if thread is of type announcement.
 */
export interface AnnouncementDetails {
    /**
     * Announcement description in Markdown format. See markdown support for more details.
     */
    description?: string;
    /**
     * Timestamp of when the announcement should end
     */
    endTime: number;
    /**
     * Timestamp of the start time from when the announcement should be shown.
     */
    startTime: number;
}

/**
 * Details about the Chatbot conversation. This is only applicable if thread is of type
 * Chatbot.
 */
export interface ChatbotDetails {
    /**
     * The query being discussed with the Chatbot
     */
    query?: string;
    [property: string]: any;
}

/**
 * Details about the task. This is only applicable if thread is of type task.
 */
export interface CreateTaskDetails {
    /**
     * List of users or teams the task is assigned to
     */
    assignees: EntityReference[];
    /**
     * The value of old object for which the task is created.
     */
    oldValue?: string;
    /**
     * The suggestion object for the task provided by the creator.
     */
    suggestion?: string;
    type:        TaskType;
}

/**
 * List of users or teams the task is assigned to
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
 * Type of a task.
 */
export enum TaskType {
    Generic = "Generic",
    RecognizerFeedbackApproval = "RecognizerFeedbackApproval",
    RequestApproval = "RequestApproval",
    RequestDescription = "RequestDescription",
    RequestTag = "RequestTag",
    RequestTestCaseFailureResolution = "RequestTestCaseFailureResolution",
    UpdateDescription = "UpdateDescription",
    UpdateTag = "UpdateTag",
}

/**
 * Type of thread.
 */
export enum ThreadType {
    Announcement = "Announcement",
    Chatbot = "Chatbot",
    Conversation = "Conversation",
    Task = "Task",
}
