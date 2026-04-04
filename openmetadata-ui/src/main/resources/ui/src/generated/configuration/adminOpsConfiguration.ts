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
 * Configuration for the Admin Operations API that allows SaaS Hypervisor to trigger
 * administrative operations.
 */
export interface AdminOpsConfiguration {
    /**
     * Whether the Admin Ops API is enabled.
     */
    enabled?: boolean;
    mtls?:    AdminOpsMTLSConfiguration;
}

/**
 * Mutual TLS authentication configuration for the Admin Ops API.
 */
export interface AdminOpsMTLSConfiguration {
    /**
     * List of allowed certificate Common Names.
     */
    allowedCNs?: string[];
    /**
     * List of allowed certificate issuer DNs.
     */
    allowedIssuers?: string[];
    /**
     * List of allowed Subject Alternative Names.
     */
    allowedSANs?: string[];
    /**
     * Enable mTLS client certificate authentication.
     */
    enabled?: boolean;
    /**
     * Require client certificate when mTLS is enabled.
     */
    requireClientCert?: boolean;
}
