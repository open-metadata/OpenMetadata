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
     * Event broker configuration. Choose between Kafka and Kinesis.
     */
    brokerConfig: BrokerConfiguration;
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
 * Event broker configuration. Choose between Kafka and Kinesis.
 *
 * Kafka broker configuration for OpenLineage events.
 *
 * AWS Kinesis Data Streams configuration for OpenLineage events.
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
     */
    consumerOffsets?: InitialConsumerOffsets;
    /**
     * Max allowed wait time.
     *
     * Poll interval in seconds.
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
     */
    streamName?: string;
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
 */
export enum InitialConsumerOffsets {
    Earliest = "earliest",
    InitialConsumerOffsetsLATEST = "LATEST",
    Latest = "latest",
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
