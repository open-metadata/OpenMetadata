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
 * Redpanda Connection Config
 */
export interface RedpandaConnection {
    /**
     * basic.auth.user.info schema registry config property, Client HTTP credentials in the form
     * of username:password.
     */
    basicAuthUserInfo?: string;
    /**
     * Redpanda bootstrap servers. add them in comma separated values ex: host1:9092,host2:9092
     */
    bootstrapServers: string;
    /**
     * Confluent Redpanda Consumer Config
     */
    consumerConfig?: { [key: string]: any };
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
     * Confluent Redpanda Schema Registry Config.
     */
    schemaRegistryConfig?: { [key: string]: any };
    /**
     * Schema Registry Topic Suffix Name. The suffix to be appended to the topic name to get
     * topic schema from registry.
     */
    schemaRegistryTopicSuffixName?: string;
    /**
     * Confluent Redpanda Schema Registry URL.
     */
    schemaRegistryURL?: string;
    /**
     * security.protocol consumer config property
     */
    securityProtocol?:           SecurityProtocol;
    supportsMetadataExtraction?: boolean;
    /**
     * Regex to only fetch topics that matches the pattern.
     */
    topicFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: RedpandaType;
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
 * Redpanda service type
 */
export enum RedpandaType {
    Redpanda = "Redpanda",
}
