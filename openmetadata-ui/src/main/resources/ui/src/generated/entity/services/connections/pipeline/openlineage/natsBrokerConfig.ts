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
 * NATS JetStream configuration for OpenLineage events.
 */
export interface NatsBrokerConfig {
    /**
     * How long JetStream waits for an acknowledgement before redelivering an event, in seconds.
     */
    ackWait?: number;
    /**
     * Additional NATS client configuration options. See https://nats-io.github.io/nats.py/
     */
    additionalConfig?: { [key: string]: any };
    /**
     * NATS authentication method. Leave empty for anonymous authentication.
     */
    authType?: AuthenticationType;
    /**
     * Number of events fetched per request.
     */
    batchSize?: number;
    /**
     * Where a new durable consumer starts reading.
     */
    consumerOffsets?: InitialConsumerOffsets;
    /**
     * Durable JetStream consumer name. Reusing it resumes where the previous run stopped.
     */
    durableConsumerName?: string;
    /**
     * How many times JetStream redelivers an event that is never acknowledged, before it gives
     * up. Keeps an event that ingestion cannot process from being retried on every run.
     */
    maxDeliver?: number;
    /**
     * NATS server URLs as comma-separated values. Ex: nats://host1:4222,nats://host2:4222
     */
    natsServers: string;
    /**
     * Max allowed wait time for a single fetch, in seconds.
     */
    poolTimeout?: number;
    /**
     * Max allowed inactivity time before the run ends, in seconds.
     */
    sessionTimeout?: number;
    /**
     * JetStream stream holding the OpenLineage events.
     */
    streamName: string;
    /**
     * Subject to consume from the stream. Defaults to all subjects of the stream.
     */
    subject?: string;
    /**
     * TLS/SSL configuration for secure NATS connections.
     */
    tlsConfig?: Config;
}

/**
 * NATS authentication method. Leave empty for anonymous authentication.
 *
 * Username and password authentication for NATS.
 *
 * Token-based authentication for NATS.
 *
 * NKey seed authentication for NATS.
 *
 * Decentralized authentication with the contents of a NATS .creds file (user JWT and NKey
 * seed).
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
    /**
     * Contents of the .creds file, including the user JWT and the NKey seed.
     */
    credentials?: string;
}

/**
 * Where a new durable consumer starts reading.
 */
export enum InitialConsumerOffsets {
    All = "all",
    New = "new",
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
