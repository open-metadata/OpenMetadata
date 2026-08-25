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
 * Microsoft Fabric credentials configuration for authentication across Fabric services
 * (Database, Pipeline, Dashboard).
 */
export interface FabricCredentials {
    /**
     * Microsoft Fabric authentication credentials
     */
    credentials: CredentialsClass;
}

/**
 * Microsoft Fabric authentication credentials
 *
 * Authenticate using Azure Active Directory Service Principal (Application)
 */
export interface CredentialsClass {
    /**
     * Azure AD Authority URI. Defaults to https://login.microsoftonline.com/
     */
    authorityUri?: string;
    /**
     * Azure Active Directory Application (Client) ID
     */
    clientId: string;
    /**
     * Azure Active Directory Application Client Secret
     */
    clientSecret: string;
    /**
     * Azure Active Directory Tenant ID
     */
    tenantId: string;
    /**
     * Azure Service Principal Authentication
     */
    type?: string;
}
