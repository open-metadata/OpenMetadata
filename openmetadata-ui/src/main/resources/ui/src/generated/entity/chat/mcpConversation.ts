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
 * A chat conversation between a user and the AI assistant via the MCP Client.
 */
export interface MCPConversation {
    /**
     * Timestamp when the conversation was created.
     */
    createdAt: number;
    /**
     * User who created the conversation.
     */
    createdBy?: string;
    /**
     * Unique identifier for the conversation.
     */
    id: string;
    /**
     * Messages in this conversation (populated on fetch).
     */
    mcpMessages?: MCPMessage[];
    /**
     * Total number of messages in this conversation.
     */
    messageCount?: number;
    /**
     * Title of the conversation.
     */
    title?: string;
    /**
     * Timestamp when the conversation was last updated.
     */
    updatedAt?: number;
    /**
     * User who last updated the conversation.
     */
    updatedBy?: string;
    /**
     * User who owns this conversation.
     */
    user: EntityReference;
}

/**
 * A message within a chat conversation, supporting text and tool usage tracking.
 */
export interface MCPMessage {
    /**
     * Rich content blocks.
     */
    content?: MessageBlock[];
    /**
     * ID of the conversation this message belongs to.
     */
    conversationId: string;
    /**
     * Unique identifier for the message.
     */
    id: string;
    /**
     * Sequential index of the message in the conversation.
     */
    index:  number;
    sender: Sender;
    /**
     * Timestamp when the message was sent.
     */
    timestamp: number;
    /**
     * LLM token usage for generating this message.
     */
    tokens?: Tokens;
}

/**
 * A content block for a chat message supporting text and tool tracking.
 */
export interface MessageBlock {
    textMessage?: TextMessage;
    /**
     * Tool calls made during message generation.
     */
    tools?: ToolCall[];
    type?:  ChatContentType;
    [property: string]: any;
}

export interface TextMessage {
    message?: string;
    type?:    TextMessageType;
    [property: string]: any;
}

export enum TextMessageType {
    Markdown = "markdown",
    Plain = "plain",
}

export interface ToolCall {
    input?:  { [key: string]: any };
    name:    string;
    result?: { [key: string]: any };
    [property: string]: any;
}

/**
 * Chat content type.
 */
export enum ChatContentType {
    Generic = "Generic",
}

/**
 * Sender type.
 */
export enum Sender {
    Assistant = "assistant",
    Human = "human",
}

/**
 * LLM token usage for generating this message.
 */
export interface Tokens {
    inputTokens?:  number;
    outputTokens?: number;
    totalTokens?:  number;
    [property: string]: any;
}

/**
 * User who owns this conversation.
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
