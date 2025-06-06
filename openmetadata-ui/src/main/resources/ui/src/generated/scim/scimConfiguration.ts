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
 * SCIM configuration for automatic provisioning through identity providers like Azure AD or
 * Okta.
 */
export interface ScimConfiguration {
    /**
     * Whether SCIM provisioning is enabled.
     */
    enabled?: boolean;
    /**
     * The name of the identity provider for SCIM (e.g., azure, okta).
     */
    identityProvider?: string;
}
