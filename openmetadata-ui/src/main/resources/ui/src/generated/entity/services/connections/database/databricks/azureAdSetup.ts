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
 * Azure Active Directory authentication for Azure Databricks workspaces using Service
 * Principal.
 */
export interface AzureAdSetup {
    /**
     * Azure Service Principal Application (client) ID registered in your Azure Active Directory.
     */
    azureClientId: string;
    /**
     * Azure Service Principal client secret created in Azure AD for authentication.
     */
    azureClientSecret: string;
    /**
     * Azure Active Directory Tenant ID where your Service Principal is registered.
     */
    azureTenantId: string;
}
