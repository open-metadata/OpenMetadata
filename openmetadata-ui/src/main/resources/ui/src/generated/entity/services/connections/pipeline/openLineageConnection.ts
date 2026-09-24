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
 * OpenLineage Connection Config
 */
export interface OpenLineageConnection {
    /**
     * Event broker configuration. Choose between Kafka, Kinesis and NATS.
     */
    brokerConfig: BrokerConfiguration;
    /**
     * Map OpenLineage dataset namespaces (or prefixes) to OpenMetadata database service names.
     * Used when multiple services of the same type exist. Example: 'mysql://cluster-a:3306' ->
     * 'mysql-cluster-a'.
     */
    namespaceToServiceMapping?: { [key: string]: string };
    /**
     * Regex exclude pipelines.
     */
    pipelineFilterPattern?:      FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: OpenLineageType;
}

/**
 * Event broker configuration. Choose between Kafka, Kinesis and NATS.
 *
 * Kafka broker configuration for OpenLineage events.
 *
 * AWS Kinesis Data Streams configuration for OpenLineage events.
 *
 * NATS JetStream configuration for OpenLineage events.
 */
export interface BrokerConfiguration {
    /**
     * Kafka bootstrap servers URL.
     */
    brokersUrl?: string;
    /**
     * Kafka consumer group name.
     */
    consumerGroupName?: string;
    /**
     * Initial Kafka consumer offset.
     *
     * Initial Kinesis shard iterator type.
     *
     * Where a new durable consumer starts reading.
     */
    consumerOffsets?: InitialConsumerOffsets;
    /**
     * Max allowed wait time.
     *
     * Poll interval in seconds.
     *
     * Max allowed wait time for a single fetch, in seconds. Must be positive: the run ends once
     * it has waited out sessionTimeout, and a zero wait would never advance that.
     */
    poolTimeout?: number;
    /**
     * SASL Configuration details.
     */
    saslConfig?: SASLClientConfig;
    /**
     * Kafka security protocol config.
     */
    securityProtocol?: KafkaSecurityProtocol;
    /**
     * Max allowed inactivity time.
     *
     * Max inactivity timeout in seconds.
     *
     * Max allowed inactivity time before the run ends, in seconds.
     */
    sessionTimeout?: number;
    /**
     * SSL Configuration details.
     */
    sslConfig?: Config;
    /**
     * Topic from where OpenLineage events will be pulled.
     */
    topicName?: string;
    /**
     * AWS credentials configuration.
     */
    awsConfig?: AWSCredentials;
    /**
     * Kinesis Data Stream name.
     *
     * JetStream stream holding the OpenLineage events.
     */
    streamName?: string;
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
    natsServers?: string;
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
 * AWS credentials configuration.
 *
 * AWS credentials configs.
 */
export interface AWSCredentials {
    /**
     * The Amazon Resource Name (ARN) of the role to assume. Required Field in case of Assume
     * Role
     */
    assumeRoleArn?: string;
    /**
     * An identifier for the assumed role session. Use the role session name to uniquely
     * identify a session when the same role is assumed by different principals or for different
     * reasons. Required Field in case of Assume Role
     */
    assumeRoleSessionName?: string;
    /**
     * The Amazon Resource Name (ARN) of the role to assume. Optional Field in case of Assume
     * Role
     */
    assumeRoleSourceIdentity?: string;
    /**
     * AWS Access key ID.
     */
    awsAccessKeyId?: string;
    /**
     * AWS Region
     */
    awsRegion: string;
    /**
     * AWS Secret Access Key.
     */
    awsSecretAccessKey?: string;
    /**
     * AWS Session Token.
     */
    awsSessionToken?: string;
    /**
     * Enable AWS IAM authentication. When enabled, uses the default credential provider chain
     * (environment variables, instance profile, etc.). Defaults to false for backward
     * compatibility.
     */
    enabled?: boolean;
    /**
     * EndPoint URL for the AWS
     */
    endPointURL?: string;
    /**
     * The name of a profile to use with the boto session.
     */
    profileName?: string;
}

/**
 * Initial Kafka consumer offset.
 *
 * Initial Kinesis shard iterator type.
 *
 * Where a new durable consumer starts reading.
 */
export enum InitialConsumerOffsets {
    All = "all",
    Earliest = "earliest",
    InitialConsumerOffsetsLATEST = "LATEST",
    Latest = "latest",
    New = "new",
    TrimHorizon = "TRIM_HORIZON",
}

/**
 * SASL Configuration details.
 *
 * SASL client configuration.
 */
export interface SASLClientConfig {
    /**
     * SASL security mechanism
     */
    saslMechanism?: SaslMechanismType;
    /**
     * The SASL authentication password.
     */
    saslPassword?: string;
    /**
     * The SASL authentication username.
     */
    saslUsername?: string;
}

/**
 * SASL security mechanism
 *
 * SASL Mechanism consumer config property
 */
export enum SaslMechanismType {
    Gssapi = "GSSAPI",
    Oauthbearer = "OAUTHBEARER",
    Plain = "PLAIN",
    ScramSHA256 = "SCRAM-SHA-256",
    ScramSHA512 = "SCRAM-SHA-512",
}

/**
 * Kafka security protocol config.
 */
export enum KafkaSecurityProtocol {
    Plaintext = "PLAINTEXT",
    SSL = "SSL",
    SaslPlaintext = "SASL_PLAINTEXT",
    SaslSSL = "SASL_SSL",
}

/**
 * SSL Configuration details.
 *
 * Client SSL configuration
 *
 * TLS/SSL configuration for secure NATS connections.
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
 * Regex exclude pipelines.
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
export enum OpenLineageType {
    OpenLineage = "OpenLineage",
}
