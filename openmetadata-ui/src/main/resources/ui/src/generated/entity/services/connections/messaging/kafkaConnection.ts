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
 * Kafka Connection Config
 */
export interface KafkaConnection {
    /**
     * basic.auth.user.info schema registry config property, Client HTTP credentials in the form
     * of username:password.
     */
    basicAuthUserInfo?: string;
    /**
     * Kafka bootstrap servers. add them in comma separated values ex: host1:9092,host2:9092
     */
    bootstrapServers: string;
    /**
     * Confluent Kafka Consumer Config. From
     * https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md
     */
    consumerConfig?: ConsumerConfig;
    /**
     * Consumer Config SSL Config. Configuration for enabling SSL for the Consumer Config
     * connection.
     */
    consumerConfigSSL?: Config;
    /**
     * sasl.mechanism Consumer Config property
     */
    saslMechanism?: SaslMechanismType;
    /**
     * sasl.password consumer config property
     */
    saslPassword?: string;
    /**
     * sasl.username consumer config property
     */
    saslUsername?: string;
    /**
     * Confluent Kafka Schema Registry Config. From
     * https://docs.confluent.io/5.5.1/clients/confluent-kafka-python/index.html#confluent_kafka.schema_registry.SchemaRegistryClient
     */
    schemaRegistryConfig?: SchemaRegistryConfig;
    /**
     * Schema Registry SSL Config. Configuration for enabling SSL for the Schema Registry
     * connection.
     */
    schemaRegistrySSL?: Config;
    /**
     * Schema Registry Topic Suffix Name. The suffix to be appended to the topic name to get
     * topic schema from registry.
     */
    schemaRegistryTopicSuffixName?: string;
    /**
     * Confluent Kafka Schema Registry URL.
     */
    schemaRegistryURL?: string;
    /**
     * security.protocol consumer config property
     */
    securityProtocol?:           SecurityProtocol;
    supportsMetadataExtraction?: boolean;
    supportsProfiler?:           boolean;
    /**
     * Regex to only fetch topics that matches the pattern.
     */
    topicFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: KafkaType;
}

/**
 * Confluent Kafka Consumer Config. From
 * https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md
 */
export interface ConsumerConfig {
    /**
     * Passphrase of the private key used to sign the OAUTHBEARER JWT assertion.
     */
    "sasl.oauthbearer.assertion.private.key.passphrase"?: string;
    /**
     * PEM private key used to sign the OAUTHBEARER JWT assertion.
     */
    "sasl.oauthbearer.assertion.private.key.pem"?: string;
    /**
     * Client secret for the OAUTHBEARER (OIDC) token request.
     */
    "sasl.oauthbearer.client.secret"?: string;
    /**
     * SASL/OAUTHBEARER configuration string, which can carry a client secret.
     */
    "sasl.oauthbearer.config"?: string;
    /**
     * SASL password.
     */
    "sasl.password"?: string;
    /**
     * Passphrase of the client's private key.
     */
    "ssl.key.password"?: string;
    /**
     * Client's private key as a PEM string.
     */
    "ssl.key.pem"?: string;
    /**
     * Password of the client keystore (PKCS#12).
     */
    "ssl.keystore.password"?: string;
    /**
     * Password of the truststore.
     */
    "ssl.truststore.password"?: string;
    [property: string]: any;
}

/**
 * Consumer Config SSL Config. Configuration for enabling SSL for the Consumer Config
 * connection.
 *
 * Client SSL configuration
 *
 * Schema Registry SSL Config. Configuration for enabling SSL for the Schema Registry
 * connection.
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
 * sasl.mechanism Consumer Config property
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
 * Confluent Kafka Schema Registry Config. From
 * https://docs.confluent.io/5.5.1/clients/confluent-kafka-python/index.html#confluent_kafka.schema_registry.SchemaRegistryClient
 */
export interface SchemaRegistryConfig {
    /**
     * Schema Registry credentials in the form of username:password.
     */
    "basic.auth.user.info"?: string;
    /**
     * Client secret for the Schema Registry OAuth token request.
     */
    "bearer.auth.client.secret"?: string;
    /**
     * Static bearer token for the Schema Registry.
     */
    "bearer.auth.token"?: string;
    [property: string]: any;
}

/**
 * security.protocol consumer config property
 */
export enum SecurityProtocol {
    Plaintext = "PLAINTEXT",
    SSL = "SSL",
    SaslPlaintext = "SASL_PLAINTEXT",
    SaslSSL = "SASL_SSL",
}

/**
 * Regex to only fetch topics that matches the pattern.
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
 * Kafka service type
 */
export enum KafkaType {
    Kafka = "Kafka",
}
