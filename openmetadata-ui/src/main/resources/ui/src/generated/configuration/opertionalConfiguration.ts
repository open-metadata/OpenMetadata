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
 * This schema defines the Operations Configuration.
 */
export interface OpertionalConfiguration {
    email?:     SMTPSettings;
    serverUrl?: OpenMetadataBaseURLConfiguration;
}

/**
 * This schema defines the SMTP Settings for sending Email
 */
export interface SMTPSettings {
    /**
     * Emailing Entity
     */
    emailingEntity?: string;
    /**
     * If this is enable password will details will be shared on mail
     */
    enableSmtpServer?: boolean;
    /**
     * Smtp Server Password
     */
    password?: string;
    /**
     * Mail of the sender
     */
    senderMail?: string;
    /**
     * Smtp Server Endpoint
     */
    serverEndpoint?: string;
    /**
     * Smtp Server Port
     */
    serverPort?: number;
    /**
     * Support Url
     */
    supportUrl?:             string;
    templatePath?:           string;
    templates?:              Templates;
    transportationStrategy?: TransportationStrategy;
    /**
     * Smtp Server Username
     */
    username?: string;
}

export enum Templates {
    Collate = "collate",
    Openmetadata = "openmetadata",
}

export enum TransportationStrategy {
    SMTP = "SMTP",
    SMTPTLS = "SMTP_TLS",
    Smtps = "SMTPS",
}

/**
 * This schema defines the OpenMetadata base URL configuration
 */
export interface OpenMetadataBaseURLConfiguration {
    /**
     * OpenMetadata Server Endpoint
     */
    openMetadataUrl?: string;
}
