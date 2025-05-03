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
 * This schema defines the Kafka Event Publisher Configuration.
 */
export interface KafkaEventConfiguration {
    /**
     * Acknowledgment
     */
    acks?: string;
    /**
     * Buffer Memory
     */
    bufferMemory?: number;
    /**
     * Serializer class for key
     */
    keySerializer?: string;
    /**
     * Artificial Delay in milliseconds
     */
    lingerMS?: number;
    /**
     * No. of retries
     */
    retries?: number;
    /**
     * Kafka security protocol config
     */
    securityProtocol?: SecurityProtocol;
    /**
     * Kafka SSL key password
     */
    SSLKeyPassword?: string;
    /**
     * Kafka SSL keystore location
     */
    SSLKeystoreLocation?: string;
    /**
     * Kafka SSL keystore password
     */
    SSLKeystorePassword?: string;
    /**
     * Kafka SSL protocol config
     */
    SSLProtocol?: string;
    /**
     * Kafka SSL truststore location
     */
    SSLTrustStoreLocation?: string;
    /**
     * Kafka SSL truststore password
     */
    SSLTrustStorePassword?: string;
    /**
     * Topics of Kafka Producer
     */
    topics: string[];
    /**
     * Serializer class for value
     */
    valueSerializer?: string;
}

/**
 * Kafka security protocol config
 */
export enum SecurityProtocol {
    Plaintext = "PLAINTEXT",
    SSL = "SSL",
}
