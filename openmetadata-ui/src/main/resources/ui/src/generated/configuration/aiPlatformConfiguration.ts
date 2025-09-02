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
 * This schema defines the JWT Configuration.
 */
export interface AIPlatformConfiguration {
    /**
     * Indicates whether the AI Platform is enabled
     */
    enabled?: boolean;
    /**
     * gRPC configuration for the AI Platform server
     */
    grpc: GrpcConfiguration;
    /**
     * Host for the AI Platform server
     */
    host: string;
    /**
     * Port for the AI Platform server
     */
    port: number;
    /**
     * Path to the TLS certificate for the AI Platform server
     */
    tlsCertPath?: string;
    /**
     * Path to the TLS key for the AI Platform server
     */
    tlsKeyPath?: string;
    /**
     * Path to the trusted CA certificate for the AI Platform server
     */
    trustedCertsPath?: string;
}

/**
 * gRPC configuration for the AI Platform server
 */
export interface GrpcConfiguration {
    /**
     * Keep alive time for the gRPC server
     */
    keepAliveTime?: number;
    /**
     * Keep alive timeout for the gRPC server
     */
    keepAliveTimeout?: number;
    /**
     * Port for the gRPC server
     */
    maxInboundMessageSize?: number;
    /**
     * Host for the gRPC server
     */
    port: number;
    [property: string]: any;
}
