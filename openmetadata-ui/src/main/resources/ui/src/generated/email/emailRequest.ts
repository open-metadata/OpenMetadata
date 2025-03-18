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
 * This schema defines the Email Request for creating Email
 */
export interface EmailRequest {
    /**
     * List of BCC
     */
    bccMails?: NameEmailPair[];
    /**
     * List of CC
     */
    ccMails?: NameEmailPair[];
    /**
     * Content for mail
     */
    content?:    string;
    contentType: ContentType;
    /**
     * List of Receiver Name with Email
     */
    recipientMails?: NameEmailPair[];
    /**
     * From Email Address
     */
    senderMail?: string;
    /**
     * Sender Name
     */
    senderName?: string;
    /**
     * Subject for Mail
     */
    subject: string;
}

/**
 * Name Email Pair
 */
export interface NameEmailPair {
    /**
     * Email address of the user.
     */
    email: string;
    /**
     * Name
     */
    name?: string;
}

export enum ContentType {
    HTML = "html",
    Plain = "plain",
}
