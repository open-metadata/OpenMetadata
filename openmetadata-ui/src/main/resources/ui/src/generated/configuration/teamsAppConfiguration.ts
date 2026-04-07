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
 * This schema defines the Microsoft Teams App configuration
 */
export interface TeamsAppConfiguration {
    /**
     * Azure AD Application (Client) ID for the Teams bot
     */
    microsoftAppId: string;
    /**
     * Azure AD Client Secret for the Teams bot
     */
    microsoftAppPassword: string;
    /**
     * Azure AD Tenant ID (optional, for single-tenant bots). Use 'common' for multi-tenant.
     */
    microsoftAppTenantId?: string;
}
