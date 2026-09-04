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
 * Credentials for an OpenBao (or HashiCorp Vault) KV v2 secrets engine.
 */
export interface OpenBaoCredentials {
    /**
     * The OpenBao server address, e.g. https://openbao.internal:8200
     */
    address?: string;
    /**
     * How to authenticate against OpenBao
     */
    authMethod?: AuthMethod;
    /**
     * Mount path of the AppRole auth method
     */
    authPath?: string;
    /**
     * Path to a PEM bundle trusted when verifying the OpenBao server certificate
     */
    caCertPath?: string;
    /**
     * Connection timeout for requests to OpenBao
     */
    connectTimeoutMs?: number;
    /**
     * Path of the KV v2 secrets engine mount
     */
    mount?: string;
    /**
     * Optional namespace, sent as the X-Vault-Namespace header. Leave empty for deployments
     * without namespaces.
     */
    namespace?: string;
    /**
     * Read timeout for requests to OpenBao
     */
    readTimeoutMs?: number;
    /**
     * AppRole role_id, used when authMethod is `approle`
     */
    roleId?: string;
    /**
     * AppRole secret_id, used when authMethod is `approle`
     */
    secretId?: string;
    /**
     * Disable TLS certificate verification. Development only: it exposes credentials in transit.
     */
    skipTlsVerify?: boolean;
    /**
     * Token used when authMethod is `token`
     */
    token?: string;
}

/**
 * How to authenticate against OpenBao
 */
export enum AuthMethod {
    Approle = "approle",
    Token = "token",
}
