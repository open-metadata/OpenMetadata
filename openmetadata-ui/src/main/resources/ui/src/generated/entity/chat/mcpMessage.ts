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
