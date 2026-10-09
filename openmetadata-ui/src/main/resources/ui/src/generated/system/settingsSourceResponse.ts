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
 * Where each setting that exists both in the deployment configuration and in the database
 * takes its values from, and which deployment values the stored configuration currently
 * overrides.
 */
export interface SettingsSourceResponse {
    /**
     * One entry per setting that exists both in the deployment configuration and in the
     * database.
     */
    settings: SettingSource[];
}

/**
 * Source status of one setting.
 */
export interface SettingSource {
    /**
     * The setting.
     */
    configType: SettingType;
    /**
     * False when every field of the setting is owned by the deployment configuration.
     */
    editable: boolean;
    /**
     * Why this server could not apply the latest stored value of the setting, if it could not.
     */
    lastReloadError?: string;
    /**
     * Fields owned by the deployment configuration. They cannot be changed through the API.
     */
    managedPaths?: string[];
    /**
     * Fields set deliberately in the deployment configuration whose stored value differs.
     */
    overriddenFields?: OverriddenField[];
    /**
     * Where the setting takes its values from.
     */
    source: ConfigSourceMode;
    /**
     * Environment variable that selects the source of this setting.
     */
    sourceVariable?: string;
}

/**
 * The setting.
 *
 * This schema defines all possible filters enum in OpenMetadata.
 */
export enum SettingType {
    AirflowConfiguration = "airflowConfiguration",
    AppConfiguration = "appConfiguration",
    AssetCertificationSettings = "assetCertificationSettings",
    AuthenticationConfiguration = "authenticationConfiguration",
    AuthorizerConfiguration = "authorizerConfiguration",
    CustomUIThemePreference = "customUiThemePreference",
    Elasticsearch = "elasticsearch",
    EmailConfiguration = "emailConfiguration",
    EntityRulesSettings = "entityRulesSettings",
    EventHandlerConfiguration = "eventHandlerConfiguration",
    FernetConfiguration = "fernetConfiguration",
    GlossaryTermRelationSettings = "glossaryTermRelationSettings",
    JwtTokenConfiguration = "jwtTokenConfiguration",
    LineageSettings = "lineageSettings",
    LoginConfiguration = "loginConfiguration",
    MCPConfiguration = "mcpConfiguration",
    OpenLineageSettings = "openLineageSettings",
    OpenMetadataBaseURLConfiguration = "openMetadataBaseUrlConfiguration",
    ProfilerConfiguration = "profilerConfiguration",
    SandboxModeEnabled = "sandboxModeEnabled",
    ScimConfiguration = "scimConfiguration",
    SearchSettings = "searchSettings",
    SecretsManagerConfiguration = "secretsManagerConfiguration",
    SecurityConfiguration = "securityConfiguration",
    SlackAppConfiguration = "slackAppConfiguration",
    SlackBot = "slackBot",
    SlackChat = "slackChat",
    SlackEventPublishers = "slackEventPublishers",
    SlackInstaller = "slackInstaller",
    SlackState = "slackState",
    SparqlQuerySettings = "sparqlQuerySettings",
    StartupChecksums = "startupChecksums",
    TeamsAppConfiguration = "teamsAppConfiguration",
    WorkflowSettings = "workflowSettings",
}

/**
 * A field set deliberately in the deployment configuration whose stored value differs.
 */
export interface OverriddenField {
    /**
     * Environment variable that sets the field in the deployment configuration, when the
     * configuration file uses one.
     */
    envVariable?: string;
    /**
     * JSON pointer of the field inside the setting, for example
     * /oidcConfiguration/clientAuthenticationMethod.
     */
    path: string;
}

/**
 * Where the setting takes its values from.
 *
 * AUTO applies a value changed in the deployment configuration on the next start unless the
 * same value was changed through the API since. ENV makes the deployment configuration
 * authoritative: every field it defines is overwritten on start and cannot be changed
 * through the API. DB keeps the stored values and only fills fields that the stored
 * configuration does not have.
 */
export enum ConfigSourceMode {
    Auto = "AUTO",
    DB = "DB",
    Env = "ENV",
}
