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
 * This schema defines the Authorization Configuration.
 */
export interface AuthorizerConfiguration {
    /**
     * List of unique admin principals.
     */
    adminPrincipals: string[];
    /**
     * Allowed Domains to access
     */
    allowedDomains?: string[];
    /**
     * List of unique email domains that are allowed to signup on the platforms
     */
    allowedEmailRegistrationDomains?: string[];
    /**
     * **@Deprecated** List of unique bot principals
     */
    botPrincipals?: string[];
    /**
     * Class Name for authorizer.
     */
    className: string;
    /**
     * Filter for the request authorization.
     */
    containerRequestFilter: string;
    /**
     * Enable Secure Socket Connection.
     */
    enableSecureSocketConnection: boolean;
    /**
     * Enable Enforce Principal Domain
     */
    enforcePrincipalDomain: boolean;
    /**
     * Principal Domain
     */
    principalDomain: string;
    /**
     * List of unique principals used as test users. **NOTE THIS IS ONLY FOR TEST SETUP AND NOT
     * TO BE USED IN PRODUCTION SETUP**
     */
    testPrincipals?: string[];
    /**
     * Use Roles from Provider
     */
    useRolesFromProvider?: boolean;
}
