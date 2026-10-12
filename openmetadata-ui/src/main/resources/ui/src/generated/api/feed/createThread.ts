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
     * Message
     */
    message: string;
    type?:   ThreadType;
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
 * Type of thread.
 */
export enum ThreadType {
    Announcement = "Announcement",
    Chatbot = "Chatbot",
    Conversation = "Conversation",
}
