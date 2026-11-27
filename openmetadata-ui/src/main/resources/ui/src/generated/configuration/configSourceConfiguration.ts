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
 * Where settings that exist both in the server configuration (YAML and environment
 * variables) and in the database take their values from.
 */
export interface ConfigSourceConfiguration {
    /**
     * Source of the application configuration. Defaults to DB.
     */
    app?: ConfigSourceMode;
    /**
     * Allow the first start in ENV mode to replace the identity provider stored in the database
     * with a different one from the deployment configuration.
     */
    confirmProviderChange?: boolean;
    /**
     * Source of the email (SMTP) settings. Defaults to AUTO.
     */
    email?: ConfigSourceMode;
    /**
     * Source of the MCP configuration. Defaults to AUTO.
     */
    mcp?: ConfigSourceMode;
    /**
     * Source of the SCIM configuration. Defaults to AUTO.
     */
    scim?: ConfigSourceMode;
    /**
     * Source of authenticationConfiguration and authorizerConfiguration. Defaults to AUTO.
     */
    security?: ConfigSourceMode;
    /**
     * Source of the OpenMetadata base URL. Defaults to AUTO.
     */
    serverUrl?: ConfigSourceMode;
    /**
     * How often each server checks the database for settings changed by another server, the CLI
     * or an administration API.
     */
    watchIntervalSeconds?: number;
}

/**
 * Source of the application configuration. Defaults to DB.
 *
 * AUTO applies a value changed in the deployment configuration on the next start unless the
 * same value was changed through the API since. ENV makes the deployment configuration
 * authoritative: every field it defines is overwritten on start and cannot be changed
 * through the API. DB keeps the stored values and only fills fields that the stored
 * configuration does not have.
 *
 * Source of the email (SMTP) settings. Defaults to AUTO.
 *
 * Source of the MCP configuration. Defaults to AUTO.
 *
 * Source of the SCIM configuration. Defaults to AUTO.
 *
 * Source of authenticationConfiguration and authorizerConfiguration. Defaults to AUTO.
 *
 * Source of the OpenMetadata base URL. Defaults to AUTO.
 */
export enum ConfigSourceMode {
    Auto = "AUTO",
    DB = "DB",
    Env = "ENV",
}
