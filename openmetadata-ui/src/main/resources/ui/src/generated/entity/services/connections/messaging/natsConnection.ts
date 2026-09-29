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
 * NATS Connection Config
 */
export interface NatsConnection {
    /**
     * Additional NATS client configuration options. See https://nats-io.github.io/nats.py/
     */
    additionalConfig?: { [key: string]: any };
    /**
     * NATS authentication method. Leave empty for anonymous authentication.
     */
    authType?: AuthenticationType;
    /**
     * NATS server URLs as comma-separated values. Ex: nats://host1:4222,nats://host2:4222
     */
    natsServers: string;
    /**
     * Name of the JetStream KV bucket where schemas are stored. Keys must match stream names.
     * Values should be Avro JSON, Protobuf (.proto) or JSON Schema text.
     */
    schemaKvBucket?:             string;
    supportsMetadataExtraction?: boolean;
    /**
     * TLS/SSL configuration for secure NATS connections.
     */
    tlsConfig?: Config;
    /**
     * Regex to only fetch subjects/streams that match the pattern.
     */
    topicFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: NatsType;
}

/**
 * NATS authentication method. Leave empty for anonymous authentication.
 *
 * Username and password authentication for NATS.
 *
 * Token-based authentication for NATS.
 *
 * NKey seed authentication for NATS.
 */
export interface AuthenticationType {
    /**
     * Password for NATS authentication.
     */
    password?: string;
    /**
     * Username for NATS authentication.
     */
    username?: string;
    /**
     * Token for NATS authentication.
     */
    token?: string;
    /**
     * NKey seed for NATS authentication.
     */
    nkeySeed?: string;
}

/**
 * TLS/SSL configuration for secure NATS connections.
 *
 * Client SSL configuration
 *
 * OpenMetadata Client configured to validate SSL certificates.
 */
export interface Config {
    /**
     * The CA certificate used for SSL validation.
     */
    caCertificate?: string;
    /**
     * The SSL certificate used for client authentication.
     */
    sslCertificate?: string;
    /**
     * The private key associated with the SSL certificate.
     */
    sslKey?: string;
}

/**
 * Regex to only fetch subjects/streams that match the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 */
export interface FilterPattern {
    /**
     * List of strings/regex patterns to match and exclude only database entities that match.
     */
    excludes?: string[];
    /**
     * List of strings/regex patterns to match and include only database entities that match.
     */
    includes?: string[];
}

/**
 * Service Type
 *
 * Service type.
 */
export enum NatsType {
    Nats = "Nats",
}
