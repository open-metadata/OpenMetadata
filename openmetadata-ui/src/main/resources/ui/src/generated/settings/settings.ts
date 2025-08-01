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
 * This schema defines the Settings. A Settings represents a generic Setting.
 */
export interface Settings {
    /**
     * Unique identifier that identifies an entity instance.
     */
    config_type:   SettingType;
    config_value?: PipelineServiceClientConfiguration;
    [property: string]: any;
}

/**
 * Unique identifier that identifies an entity instance.
 *
 * This schema defines all possible filters enum in OpenMetadata.
 */
export enum SettingType {
    AirflowConfiguration = "airflowConfiguration",
    AssetCertificationSettings = "assetCertificationSettings",
    AuthenticationConfiguration = "authenticationConfiguration",
    AuthorizerConfiguration = "authorizerConfiguration",
    CustomUIThemePreference = "customUiThemePreference",
    Elasticsearch = "elasticsearch",
    EmailConfiguration = "emailConfiguration",
    EntityRulesSettings = "entityRulesSettings",
    EventHandlerConfiguration = "eventHandlerConfiguration",
    FernetConfiguration = "fernetConfiguration",
    JwtTokenConfiguration = "jwtTokenConfiguration",
    LineageSettings = "lineageSettings",
    LoginConfiguration = "loginConfiguration",
    OpenMetadataBaseURLConfiguration = "openMetadataBaseUrlConfiguration",
    ProfilerConfiguration = "profilerConfiguration",
    SandboxModeEnabled = "sandboxModeEnabled",
    ScimConfiguration = "scimConfiguration",
    SearchSettings = "searchSettings",
    SecretsManagerConfiguration = "secretsManagerConfiguration",
    SlackAppConfiguration = "slackAppConfiguration",
    SlackBot = "slackBot",
    SlackChat = "slackChat",
    SlackEventPublishers = "slackEventPublishers",
    SlackInstaller = "slackInstaller",
    SlackState = "slackState",
    WorkflowSettings = "workflowSettings",
}

/**
 * This schema defines the Pipeline Service Client Configuration
 *
 * This schema defines the Authentication Configuration.
 *
 * This schema defines the Authorization Configuration.
 *
 * This schema defines the Elastic Search Configuration.
 *
 * This schema defines the Event Handler Configuration.
 *
 * This schema defines the Fernet Configuration.
 *
 * This schema defines the JWT Configuration.
 *
 * This schema defines the SSL Config.
 *
 * This schema defines the SMTP Settings for sending Email
 *
 * This schema defines the OpenMetadata base URL configuration
 *
 * This schema defines the Slack App Information
 *
 * This schema defines the profiler configuration. It is used to configure globally the
 * metrics to compute for specific data types.
 *
 * This schema defines the Asset Certification Settings.
 *
 * This schema defines the Lineage Settings.
 *
 * This schema defines the Workflow Settings.
 */
export interface PipelineServiceClientConfiguration {
    /**
     * External API root to interact with the Pipeline Service Client
     */
    apiEndpoint?: string;
    /**
     * Auth Provider Configuration.
     */
    authConfig?: AuthConfiguration;
    /**
     * Auth Provider with which OpenMetadata service configured with.
     */
    authProvider?: AuthProvider;
    /**
     * Class Name for the Pipeline Service Client.
     *
     * Class Name for authorizer.
     */
    className?: string;
    /**
     * Flags if the ingestion from the OpenMetadata UI is enabled. If ingesting externally, we
     * can set this value to false to not check the Pipeline Service Client component health.
     *
     * Is Task Notification Enabled?
     */
    enabled?: boolean;
    /**
     * Interval in seconds that the server will use to check the /status of the
     * pipelineServiceClient and flag any errors in a Prometheus metric
     * `pipelineServiceClientStatus.counter`.
     */
    healthCheckInterval?: number;
    /**
     * Pipeline Service Client host IP that will be used to connect to the sources.
     */
    hostIp?: string;
    /**
     * Enable or disable the API that fetches the public IP running the ingestion process.
     */
    ingestionIpInfoEnabled?: boolean;
    /**
     * Metadata api endpoint, e.g., `http://localhost:8585/api`
     */
    metadataApiEndpoint?: string;
    /**
     * Additional parameters to initialize the PipelineServiceClient.
     */
    parameters?:           { [key: string]: any };
    secretsManagerLoader?: SecretsManagerClientLoader;
    /**
     * OpenMetadata Client SSL configuration. This SSL information is about the OpenMetadata
     * server. It will be picked up from the pipelineServiceClient to use/ignore SSL when
     * connecting to the OpenMetadata server.
     */
    sslConfig?: Config;
    /**
     * Client SSL verification policy when connecting to the OpenMetadata server: no-ssl,
     * ignore, validate.
     */
    verifySSL?: VerifySSL;
    /**
     * Authentication Authority
     */
    authority?: string;
    /**
     * Callback URL
     */
    callbackUrl?: string;
    /**
     * Client ID
     *
     * Client Id of the Application
     */
    clientId?: string;
    /**
     * Client Type
     */
    clientType?: ClientType;
    /**
     * Enable Self Sign Up
     */
    enableSelfSignup?: boolean;
    /**
     * Jwt Principal Claim
     */
    jwtPrincipalClaims?: string[];
    /**
     * Jwt Principal Claim Mapping
     */
    jwtPrincipalClaimsMapping?: string[];
    /**
     * LDAP Configuration in case the Provider is LDAP
     */
    ldapConfiguration?: LDAPConfiguration;
    /**
     * Oidc Configuration for Confidential Client Type
     */
    oidcConfiguration?: OidcClientConfig;
    provider?:          AuthProvider;
    /**
     * Custom OIDC Authentication Provider Name
     */
    providerName?: string;
    /**
     * List of Public Key URLs
     */
    publicKeyUrls?: string[];
    /**
     * This is used by auth provider provide response as either id_token or code.
     */
    responseType?: ResponseType;
    /**
     * Saml Configuration that is applicable only when the provider is Saml
     */
    samlConfiguration?: SamlSSOClientConfig;
    /**
     * Token Validation Algorithm to use.
     */
    tokenValidationAlgorithm?: TokenValidationAlgorithm;
    /**
     * List of unique admin principals.
     */
    adminPrincipals?: string[];
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
     * Filter for the request authorization.
     */
    containerRequestFilter?: string;
    /**
     * Enable Secure Socket Connection.
     */
    enableSecureSocketConnection?: boolean;
    /**
     * Enable Enforce Principal Domain
     */
    enforcePrincipalDomain?: boolean;
    /**
     * Principal Domain
     */
    principalDomain?: string;
    /**
     * List of unique principals used as test users. **NOTE THIS IS ONLY FOR TEST SETUP AND NOT
     * TO BE USED IN PRODUCTION SETUP**
     */
    testPrincipals?: string[];
    /**
     * Use Roles from Provider
     */
    useRolesFromProvider?: boolean;
    /**
     * Batch Size for Requests
     */
    batchSize?: number;
    /**
     * Alias for search indexes to provide segregation of indexes.
     */
    clusterAlias?: string;
    /**
     * Connection Timeout in Seconds
     */
    connectionTimeoutSecs?: number;
    /**
     * Elastic Search Host
     */
    host?: string;
    /**
     * Keep Alive Timeout in Seconds
     */
    keepAliveTimeoutSecs?: number;
    /**
     * Configuration for natural language search capabilities
     */
    naturalLanguageSearch?: NaturalLanguageSearch;
    /**
     * Elastic Search Password for Login
     *
     * Smtp Server Password
     */
    password?: string;
    /**
     * Payload size in bytes depending on elasticsearch config
     */
    payLoadSize?: number;
    /**
     * Elastic Search port
     */
    port?: number;
    /**
     * Http/Https connection scheme
     */
    scheme?: string;
    /**
     * Index factory name
     */
    searchIndexFactoryClassName?: string;
    searchIndexMappingLanguage?:  SearchIndexMappingLanguage;
    /**
     * This enum defines the search Type elastic/open search.
     */
    searchType?: SearchType;
    /**
     * Socket Timeout in Seconds
     */
    socketTimeoutSecs?: number;
    /**
     * Truststore Password
     */
    truststorePassword?: string;
    /**
     * Truststore Path
     */
    truststorePath?: string;
    /**
     * Elastic Search Username for Login
     *
     * Smtp Server Username
     */
    username?: string;
    /**
     * Event Handler Class Names
     */
    eventHandlerClassNames?: string[];
    /**
     * Fernet Key
     */
    fernetKey?: string;
    /**
     * JWT Issuer
     */
    jwtissuer?: string;
    /**
     * Key ID
     */
    keyId?: string;
    /**
     * RSA Private Key File Path
     */
    rsaprivateKeyFilePath?: string;
    /**
     * RSA Public Key File Path
     */
    rsapublicKeyFilePath?: string;
    /**
     * Emailing Entity
     */
    emailingEntity?: string;
    /**
     * If this is enable password will details will be shared on mail
     */
    enableSmtpServer?: boolean;
    /**
     * Mail of the sender
     */
    senderMail?: string;
    /**
     * Smtp Server Endpoint
     */
    serverEndpoint?: string;
    /**
     * Smtp Server Port
     */
    serverPort?: number;
    /**
     * Support Url
     */
    supportUrl?:             string;
    templatePath?:           string;
    templates?:              Templates;
    transportationStrategy?: TransportationStrategy;
    /**
     * OpenMetadata Server Endpoint
     */
    openMetadataUrl?: string;
    /**
     * Client Secret of the Application.
     */
    clientSecret?: string;
    /**
     * Signing Secret of the Application. Confirm that each request comes from Slack by
     * verifying its unique signature.
     */
    signingSecret?:       string;
    metricConfiguration?: MetricConfigurationDefinition[];
    /**
     * Configurations of allowed searchable fields for each entity type
     */
    allowedFields?: AllowedSearchFields[];
    /**
     * Configurations of allowed field value boost fields for each entity type
     */
    allowedFieldValueBoosts?: AllowedFieldValueBoostFields[];
    /**
     * List of per-asset search configurations that override the global settings.
     */
    assetTypeConfigurations?: AssetTypeConfiguration[];
    /**
     * Fallback configuration for any entity/asset not matched in assetTypeConfigurations.
     */
    defaultConfiguration?: AssetTypeConfiguration;
    globalSettings?:       GlobalSettings;
    /**
     * Configuration for Natural Language Query capabilities
     */
    nlqConfiguration?: NlqConfiguration;
    /**
     * Classification that can be used for certifications.
     */
    allowedClassification?: string;
    /**
     * ISO 8601 duration for the validity period.
     */
    validityPeriod?: string;
    /**
     * DownStream Depth for Lineage.
     */
    downstreamDepth?: number;
    /**
     * Lineage Layer.
     */
    lineageLayer?: LineageLayer;
    /**
     * Upstream Depth for Lineage.
     */
    upstreamDepth?: number;
    /**
     * Used to set up the Workflow Executor Settings.
     */
    executorConfiguration?: ExecutorConfiguration;
    /**
     * Used to set up the History CleanUp Settings.
     */
    historyCleanUpConfiguration?: HistoryCleanUpConfiguration;
    /**
     * Semantics rules defined in the data contract.
     */
    entitySemantics?: SemanticsRule[];
}

export interface AllowedFieldValueBoostFields {
    /**
     * Entity type this field value boost configuration applies to
     */
    entityType: string;
    fields:     AllowedFieldValueBoostField[];
}

export interface AllowedFieldValueBoostField {
    /**
     * Detailed explanation of what this numeric field represents and how it can be used for
     * boosting relevance
     */
    description: string;
    /**
     * Field name that can be used in fieldValueBoosts
     */
    name: string;
}

export interface AllowedSearchFields {
    /**
     * Entity type this field configuration applies to
     */
    entityType: string;
    fields:     AllowedFieldField[];
}

export interface AllowedFieldField {
    /**
     * Detailed explanation of what this field represents and how it affects search behavior
     */
    description: string;
    /**
     * Field name that can be used in searchFields
     */
    name: string;
}

/**
 * Fallback configuration for any entity/asset not matched in assetTypeConfigurations.
 */
export interface AssetTypeConfiguration {
    /**
     * Catch-all for any advanced or asset-specific search settings.
     */
    additionalSettings?: { [key: string]: any };
    /**
     * List of additional aggregations for this asset type.
     */
    aggregations?: Aggregation[];
    /**
     * Name or type of the asset to which this configuration applies.
     */
    assetType: string;
    /**
     * How the function score is combined with the main query score.
     */
    boostMode?: BoostMode;
    /**
     * List of numeric field-based boosts that apply only to this asset.
     */
    fieldValueBoosts?: FieldValueBoost[];
    /**
     * Which fields to highlight for this asset.
     */
    highlightFields?: string[];
    /**
     * Multipliers applied to different match types to control their relative importance.
     */
    matchTypeBoostMultipliers?: MatchTypeBoostMultipliers;
    /**
     * How to combine function scores if multiple boosts are applied.
     */
    scoreMode?: ScoreMode;
    /**
     * Which fields to search for this asset, with their boost values.
     */
    searchFields?: FieldBoost[];
    /**
     * List of field=value term-boost rules that apply only to this asset.
     */
    termBoosts?: TermBoost[];
}

export interface Aggregation {
    /**
     * The field on which this aggregation is performed.
     */
    field: string;
    /**
     * A descriptive name for the aggregation.
     */
    name: string;
    /**
     * The type of aggregation to perform.
     */
    type: Type;
}

/**
 * The type of aggregation to perform.
 */
export enum Type {
    Avg = "avg",
    DateHistogram = "date_histogram",
    Filters = "filters",
    Histogram = "histogram",
    Max = "max",
    Min = "min",
    Missing = "missing",
    Nested = "nested",
    Range = "range",
    ReverseNested = "reverse_nested",
    Stats = "stats",
    Sum = "sum",
    Terms = "terms",
    TopHits = "top_hits",
}

/**
 * How the function score is combined with the main query score.
 */
export enum BoostMode {
    Avg = "avg",
    Max = "max",
    Min = "min",
    Multiply = "multiply",
    Replace = "replace",
    Sum = "sum",
}

export interface FieldValueBoost {
    /**
     * Conditional logic (e.g., range constraints) to apply the boost only for certain values.
     */
    condition?: Condition;
    /**
     * Multiplier factor for the field value.
     */
    factor: number;
    /**
     * Numeric field name whose value will affect the score.
     */
    field: string;
    /**
     * Value to use if the field is missing on a document.
     */
    missing?: number;
    /**
     * Optional mathematical transformation to apply to the field value.
     */
    modifier?: Modifier;
}

/**
 * Conditional logic (e.g., range constraints) to apply the boost only for certain values.
 */
export interface Condition {
    range?: Range;
}

export interface Range {
    gt?:  number;
    gte?: number;
    lt?:  number;
    lte?: number;
}

/**
 * Optional mathematical transformation to apply to the field value.
 */
export enum Modifier {
    Ln = "ln",
    Ln1P = "ln1p",
    Ln2P = "ln2p",
    Log = "log",
    Log1P = "log1p",
    Log2P = "log2p",
    None = "none",
    Reciprocal = "reciprocal",
    Sqrt = "sqrt",
    Square = "square",
}

/**
 * Multipliers applied to different match types to control their relative importance.
 */
export interface MatchTypeBoostMultipliers {
    /**
     * Multiplier for exact match queries (term queries on .keyword fields)
     */
    exactMatchMultiplier?: number;
    /**
     * Multiplier for fuzzy match queries
     */
    fuzzyMatchMultiplier?: number;
    /**
     * Multiplier for phrase match queries
     */
    phraseMatchMultiplier?: number;
}

/**
 * How to combine function scores if multiple boosts are applied.
 */
export enum ScoreMode {
    Avg = "avg",
    First = "first",
    Max = "max",
    Min = "min",
    Multiply = "multiply",
    Sum = "sum",
}

export interface FieldBoost {
    /**
     * Relative boost factor for the above field.
     */
    boost?: number;
    /**
     * Field name to search/boost.
     */
    field: string;
    /**
     * Type of matching to use for this field. 'exact' uses term query for .keyword fields,
     * 'phrase' uses match_phrase, 'fuzzy' allows fuzzy matching, 'standard' uses the default
     * behavior.
     */
    matchType?: MatchType;
}

/**
 * Type of matching to use for this field. 'exact' uses term query for .keyword fields,
 * 'phrase' uses match_phrase, 'fuzzy' allows fuzzy matching, 'standard' uses the default
 * behavior.
 */
export enum MatchType {
    Exact = "exact",
    Fuzzy = "fuzzy",
    Phrase = "phrase",
    Standard = "standard",
}

export interface TermBoost {
    /**
     * Numeric boost factor to apply if a document has field==value.
     */
    boost: number;
    /**
     * The keyword field to match, e.g. tier.tagFQN, tags.tagFQN, certification.tagLabel.tagFQN,
     * etc.
     */
    field: string;
    /**
     * The exact keyword value to match in the above field.
     */
    value: string;
}

/**
 * Auth Provider Configuration.
 *
 * This schema defines the Auth Config.
 */
export interface AuthConfiguration {
    /**
     * Auth0 SSO Configuration
     */
    auth0?: Auth0SSOClientConfig;
    /**
     * Azure SSO Configuration
     */
    azure?: AzureSSOClientConfig;
    /**
     * Custom OIDC SSO Configuration
     */
    customOidc?: CustomOIDCSSOClientConfig;
    /**
     * Google SSO Configuration
     */
    google?: GoogleSSOClientConfig;
    /**
     * Okta SSO Configuration
     */
    okta?: OktaSSOClientConfig;
    /**
     * OpenMetadata SSO Configuration
     */
    openmetadata?: OpenMetadataJWTClientConfig;
}

/**
 * Auth0 SSO Configuration
 *
 * Auth0 SSO client security configs.
 */
export interface Auth0SSOClientConfig {
    /**
     * Auth0 Client ID.
     */
    clientId: string;
    /**
     * Auth0 Domain.
     */
    domain: string;
    /**
     * Auth0 Client Secret Key.
     */
    secretKey: string;
}

/**
 * Azure SSO Configuration
 *
 * Azure SSO Client security config to connect to OpenMetadata.
 */
export interface AzureSSOClientConfig {
    /**
     * Azure SSO Authority
     */
    authority: string;
    /**
     * Azure Client ID.
     */
    clientId: string;
    /**
     * Azure SSO client secret key
     */
    clientSecret: string;
    /**
     * Azure Client ID.
     */
    scopes: string[];
}

/**
 * Custom OIDC SSO Configuration
 *
 * Custom OIDC SSO client security configs.
 */
export interface CustomOIDCSSOClientConfig {
    /**
     * Custom OIDC Client ID.
     */
    clientId: string;
    /**
     * Custom OIDC Client Secret Key.
     */
    secretKey: string;
    /**
     * Custom OIDC token endpoint.
     */
    tokenEndpoint: string;
}

/**
 * Google SSO Configuration
 *
 * Google SSO client security configs.
 */
export interface GoogleSSOClientConfig {
    /**
     * Google SSO audience URL
     */
    audience?: string;
    /**
     * Google SSO client secret key path or contents.
     */
    secretKey: string;
}

/**
 * Okta SSO Configuration
 *
 * Okta SSO client security configs.
 */
export interface OktaSSOClientConfig {
    /**
     * Okta Client ID.
     */
    clientId: string;
    /**
     * Okta Service account Email.
     */
    email: string;
    /**
     * Okta org url.
     */
    orgURL: string;
    /**
     * Okta Private Key.
     */
    privateKey: string;
    /**
     * Okta client scopes.
     */
    scopes?: string[];
}

/**
 * OpenMetadata SSO Configuration
 *
 * openMetadataJWTClientConfig security configs.
 */
export interface OpenMetadataJWTClientConfig {
    /**
     * OpenMetadata generated JWT token.
     */
    jwtToken: string;
}

/**
 * Auth Provider with which OpenMetadata service configured with.
 *
 * OpenMetadata Server Authentication Provider. Make sure configure same auth providers as
 * the one configured on OpenMetadata server.
 */
export enum AuthProvider {
    Auth0 = "auth0",
    AwsCognito = "aws-cognito",
    Azure = "azure",
    Basic = "basic",
    CustomOidc = "custom-oidc",
    Google = "google",
    LDAP = "ldap",
    Okta = "okta",
    Openmetadata = "openmetadata",
    Saml = "saml",
}

/**
 * Client Type
 */
export enum ClientType {
    Confidential = "confidential",
    Public = "public",
}

/**
 * Semantics rule defined in the data contract.
 */
export interface SemanticsRule {
    /**
     * Description of the semantics rule.
     */
    description: string;
    /**
     * Indicates if the semantics rule is enabled.
     */
    enabled: boolean;
    /**
     * Type of the entity to which this semantics rule applies.
     */
    entityType?: string;
    /**
     * Name of the semantics rule.
     */
    name:      string;
    provider?: ProviderType;
    /**
     * Definition of the semantics rule.
     */
    rule: string;
}

/**
 * Type of provider of an entity. Some entities are provided by the `system`. Some are
 * entities created and provided by the `user`. Typically `system` provide entities can't be
 * deleted and can only be disabled. Some apps such as AutoPilot create entities with
 * `automation` provider type. These entities can be deleted by the user.
 */
export enum ProviderType {
    Automation = "automation",
    System = "system",
    User = "user",
}

/**
 * Used to set up the Workflow Executor Settings.
 */
export interface ExecutorConfiguration {
    /**
     * Default worker Pool Size. The Workflow Executor by default has this amount of workers.
     */
    corePoolSize?: number;
    /**
     * The amount of time a Job gets locked before being retried. Default: 15 Days. This avoids
     * jobs that takes too long to run being retried while running.
     */
    jobLockTimeInMillis?: number;
    /**
     * Maximum worker Pool Size. The Workflow Executor could grow up to this number of workers.
     */
    maxPoolSize?: number;
    /**
     * Amount of Tasks that can be queued to be picked up by the Workflow Executor.
     */
    queueSize?: number;
    /**
     * The amount of Tasks that the Workflow Executor is able to pick up each time it looks for
     * more.
     */
    tasksDuePerAcquisition?: number;
}

export interface GlobalSettings {
    /**
     * List of global aggregations to include in the search query.
     */
    aggregations?: Aggregation[];
    /**
     * Flag to enable or disable RBAC Search Configuration globally.
     */
    enableAccessControl?: boolean;
    /**
     * Optional list of numeric field-based boosts applied globally.
     */
    fieldValueBoosts?: FieldValueBoost[];
    /**
     * Which fields to highlight by default.
     */
    highlightFields?:   string[];
    maxAggregateSize?:  number;
    maxAnalyzedOffset?: number;
    maxResultHits?:     number;
    /**
     * List of field=value term-boost rules that apply only to this asset.
     */
    termBoosts?: TermBoost[];
}

/**
 * Used to set up the History CleanUp Settings.
 */
export interface HistoryCleanUpConfiguration {
    /**
     * Cleans the Workflow Task that were finished, after given number of days.
     */
    cleanAfterNumberOfDays?: number;
}

/**
 * LDAP Configuration in case the Provider is LDAP
 *
 * LDAP Configuration
 */
export interface LDAPConfiguration {
    /**
     * All attribute name
     */
    allAttributeName?: string;
    /**
     * Roles should be reassign every time user login
     */
    authReassignRoles?: string[];
    /**
     * Json string of roles mapping between LDAP roles and Ranger roles
     */
    authRolesMapping?: string;
    /**
     * Password for LDAP Admin
     */
    dnAdminPassword: string;
    /**
     * Distinguished Admin name with search capabilities
     */
    dnAdminPrincipal: string;
    /**
     * Group Name attribute name
     */
    groupAttributeName?: string;
    /**
     * Group attribute value
     */
    groupAttributeValue?: string;
    /**
     * Group base distinguished name
     */
    groupBaseDN?: string;
    /**
     * Group Member Name attribute name
     */
    groupMemberAttributeName?: string;
    /**
     * LDAP server address without scheme(Example :- localhost)
     */
    host: string;
    /**
     * If enable need to give full dn to login
     */
    isFullDn?: boolean;
    /**
     * Email attribute name
     */
    mailAttributeName: string;
    /**
     * No of connection to create the pool with
     */
    maxPoolSize?: number;
    /**
     * Port of the server
     */
    port: number;
    /**
     * Admin role name
     */
    roleAdminName?: string;
    /**
     * LDAPS (secure LDAP) or LDAP
     */
    sslEnabled?: boolean;
    /**
     * Truststore Configuration
     */
    trustStoreConfig?: TruststoreConfig;
    /**
     * Truststore Type e.g. TrustAll, HostName, JVMDefault, CustomTrustStore.
     */
    truststoreConfigType?: TruststoreConfigType;
    /**
     * Truststore format e.g. PKCS12, JKS.
     */
    truststoreFormat?: string;
    /**
     * User base distinguished name
     */
    userBaseDN: string;
    /**
     * User Name attribute name
     */
    usernameAttributeName?: string;
}

/**
 * Truststore Configuration
 */
export interface TruststoreConfig {
    /**
     * CustomTrust Configuration
     */
    customTrustManagerConfig?: CustomTrustManagerConfig;
    /**
     * HostName Configuration
     */
    hostNameConfig?: HostNameConfig;
    /**
     * JVMDefault Configuration
     */
    jvmDefaultConfig?: JVMDefaultConfig;
    /**
     * TrustAll Configuration
     */
    trustAllConfig?: TrustAllConfig;
}

/**
 * CustomTrust Configuration
 */
export interface CustomTrustManagerConfig {
    /**
     * Examine validity dates of certificate
     */
    examineValidityDates?: boolean;
    /**
     * Truststore file format
     */
    trustStoreFileFormat?: string;
    /**
     * Truststore file password
     */
    trustStoreFilePassword?: string;
    /**
     * Truststore file path
     */
    trustStoreFilePath?: string;
    /**
     * list of host names to verify
     */
    verifyHostname?: boolean;
}

/**
 * HostName Configuration
 */
export interface HostNameConfig {
    /**
     * list of acceptable host names
     */
    acceptableHostNames?: string[];
    /**
     * Allow wildcards
     */
    allowWildCards?: boolean;
}

/**
 * JVMDefault Configuration
 */
export interface JVMDefaultConfig {
    /**
     * list of host names to verify
     */
    verifyHostname?: boolean;
}

/**
 * TrustAll Configuration
 */
export interface TrustAllConfig {
    /**
     * Examine validity dates of certificate
     */
    examineValidityDates?: boolean;
}

/**
 * Truststore Type e.g. TrustAll, HostName, JVMDefault, CustomTrustStore.
 */
export enum TruststoreConfigType {
    CustomTrustStore = "CustomTrustStore",
    HostName = "HostName",
    JVMDefault = "JVMDefault",
    TrustAll = "TrustAll",
}

/**
 * Lineage Layer.
 *
 * Lineage Layers
 */
export enum LineageLayer {
    ColumnLevelLineage = "ColumnLevelLineage",
    DataObservability = "DataObservability",
    EntityLineage = "EntityLineage",
}

/**
 * This schema defines the parameters that can be passed for a Test Case.
 */
export interface MetricConfigurationDefinition {
    dataType?: DataType;
    /**
     * If true, the metric will not be computed for the data type.
     */
    disabled?: boolean;
    metrics?:  MetricType[];
}

/**
 * This enum defines the type of data stored in a column.
 */
export enum DataType {
    AggState = "AGG_STATE",
    Aggregatefunction = "AGGREGATEFUNCTION",
    Array = "ARRAY",
    Bigint = "BIGINT",
    Binary = "BINARY",
    Bit = "BIT",
    Bitmap = "BITMAP",
    Blob = "BLOB",
    Boolean = "BOOLEAN",
    Bytea = "BYTEA",
    Byteint = "BYTEINT",
    Bytes = "BYTES",
    CIDR = "CIDR",
    Char = "CHAR",
    Clob = "CLOB",
    Date = "DATE",
    Datetime = "DATETIME",
    Datetimerange = "DATETIMERANGE",
    Decimal = "DECIMAL",
    Double = "DOUBLE",
    Enum = "ENUM",
    Error = "ERROR",
    Fixed = "FIXED",
    Float = "FLOAT",
    Geography = "GEOGRAPHY",
    Geometry = "GEOMETRY",
    Heirarchy = "HEIRARCHY",
    Hll = "HLL",
    Hllsketch = "HLLSKETCH",
    Image = "IMAGE",
    Inet = "INET",
    Int = "INT",
    Interval = "INTERVAL",
    Ipv4 = "IPV4",
    Ipv6 = "IPV6",
    JSON = "JSON",
    Kpi = "KPI",
    Largeint = "LARGEINT",
    Long = "LONG",
    Longblob = "LONGBLOB",
    Lowcardinality = "LOWCARDINALITY",
    Macaddr = "MACADDR",
    Map = "MAP",
    Measure = "MEASURE",
    MeasureHidden = "MEASURE HIDDEN",
    MeasureVisible = "MEASURE VISIBLE",
    Mediumblob = "MEDIUMBLOB",
    Mediumtext = "MEDIUMTEXT",
    Money = "MONEY",
    Ntext = "NTEXT",
    Null = "NULL",
    Number = "NUMBER",
    Numeric = "NUMERIC",
    PGLsn = "PG_LSN",
    PGSnapshot = "PG_SNAPSHOT",
    Point = "POINT",
    Polygon = "POLYGON",
    QuantileState = "QUANTILE_STATE",
    Record = "RECORD",
    Rowid = "ROWID",
    Set = "SET",
    Smallint = "SMALLINT",
    Spatial = "SPATIAL",
    String = "STRING",
    Struct = "STRUCT",
    Super = "SUPER",
    Table = "TABLE",
    Text = "TEXT",
    Time = "TIME",
    Timestamp = "TIMESTAMP",
    Timestampz = "TIMESTAMPZ",
    Tinyint = "TINYINT",
    Tsquery = "TSQUERY",
    Tsvector = "TSVECTOR",
    Tuple = "TUPLE",
    TxidSnapshot = "TXID_SNAPSHOT",
    UUID = "UUID",
    Uint = "UINT",
    Union = "UNION",
    Unknown = "UNKNOWN",
    Varbinary = "VARBINARY",
    Varchar = "VARCHAR",
    Variant = "VARIANT",
    XML = "XML",
    Year = "YEAR",
}

/**
 * This schema defines all possible metric types in OpenMetadata.
 */
export enum MetricType {
    ColumnCount = "columnCount",
    ColumnNames = "columnNames",
    CountInSet = "countInSet",
    DistinctCount = "distinctCount",
    DistinctProportion = "distinctProportion",
    DuplicateCount = "duplicateCount",
    FirstQuartile = "firstQuartile",
    Histogram = "histogram",
    ILikeCount = "iLikeCount",
    ILikeRatio = "iLikeRatio",
    InterQuartileRange = "interQuartileRange",
    LikeCount = "likeCount",
    LikeRatio = "likeRatio",
    Max = "max",
    MaxLength = "maxLength",
    Mean = "mean",
    Median = "median",
    Min = "min",
    MinLength = "minLength",
    NonParametricSkew = "nonParametricSkew",
    NotLikeCount = "notLikeCount",
    NotRegexCount = "notRegexCount",
    NullCount = "nullCount",
    NullProportion = "nullProportion",
    RegexCount = "regexCount",
    RowCount = "rowCount",
    Stddev = "stddev",
    Sum = "sum",
    System = "system",
    ThirdQuartile = "thirdQuartile",
    UniqueCount = "uniqueCount",
    UniqueProportion = "uniqueProportion",
    ValuesCount = "valuesCount",
}

/**
 * Configuration for natural language search capabilities
 */
export interface NaturalLanguageSearch {
    /**
     * AWS Bedrock configuration for natural language processing
     */
    bedrock?: Bedrock;
    /**
     * Enable or disable natural language search
     */
    enabled?: boolean;
    /**
     * Fully qualified class name of the NLQService implementation to use
     */
    providerClass?: string;
}

/**
 * AWS Bedrock configuration for natural language processing
 */
export interface Bedrock {
    /**
     * AWS access key for Bedrock service authentication
     */
    accessKey?: string;
    /**
     * Bedrock model identifier to use for query transformation
     */
    modelId?: string;
    /**
     * AWS Region for Bedrock service
     */
    region?: string;
    /**
     * AWS secret key for Bedrock service authentication
     */
    secretKey?: string;
    /**
     * Set to true to use IAM role based authentication instead of access/secret keys.
     */
    useIamRole?: boolean;
}

/**
 * Configuration for Natural Language Query capabilities
 */
export interface NlqConfiguration {
    entitySpecificInstructions?: EntitySpecificInstruction[];
    examples?:                   QueryExample[];
    /**
     * Guidelines for querying custom properties in extension fields
     */
    extensionFieldGuidelines?: ExtensionFieldGuidelines;
    globalInstructions?:       PromptSection[];
    /**
     * Configuration for including Elasticsearch mapping information in prompts
     */
    mappingConfiguration?: MappingConfiguration;
    /**
     * Base prompt template for the NLQ system. Use {{INSTRUCTIONS}} where entity-specific
     * instructions should appear.
     */
    promptTemplate?: string;
    [property: string]: any;
}

export interface EntitySpecificInstruction {
    /**
     * Entity type this instruction applies to (e.g., 'table', 'dashboard')
     */
    entityType: string;
    sections:   PromptSection[];
    [property: string]: any;
}

export interface PromptSection {
    /**
     * The content for this section of the prompt
     */
    content: string;
    /**
     * Display order for this section (lower numbers appear first)
     */
    order?: number;
    /**
     * Section name (e.g., 'CRITICAL FIELD CORRECTIONS', 'QUERY PATTERNS')
     */
    section: string;
    [property: string]: any;
}

export interface QueryExample {
    /**
     * Human-readable description of the example query
     */
    description?: string;
    /**
     * Entity types this example applies to (empty array = all types)
     */
    entityTypes?: string[];
    /**
     * The corresponding Elasticsearch query
     */
    esQuery: string;
    /**
     * Natural language query example
     */
    query: string;
    [property: string]: any;
}

/**
 * Guidelines for querying custom properties in extension fields
 */
export interface ExtensionFieldGuidelines {
    examples?: QueryExample[];
    /**
     * Title for the extension field guidelines section
     */
    header:   string;
    sections: GuidelineSection[];
    [property: string]: any;
}

export interface GuidelineSection {
    guidelines: string[];
    /**
     * Section title (e.g., 'For EntityReference type custom properties')
     */
    title: string;
    [property: string]: any;
}

/**
 * Configuration for including Elasticsearch mapping information in prompts
 */
export interface MappingConfiguration {
    /**
     * Specific guidance for interpreting field patterns in the mapping
     */
    fieldInterpretations?: FieldInterpretation[];
    /**
     * Whether to include mapping information in the prompts
     */
    includeMappings?: boolean;
    mappingSection?:  TitleSection;
    [property: string]: any;
}

export interface FieldInterpretation {
    /**
     * How to interpret and query this field pattern
     */
    explanation: string;
    /**
     * Field pattern to match (e.g., 'tags.tagFQN')
     */
    pattern: string;
    [property: string]: any;
}

export interface TitleSection {
    /**
     * Description text for the section
     */
    description?: string;
    /**
     * Position of this section in the prompt (lower numbers appear first)
     */
    order?: number;
    /**
     * Title for the section
     */
    title?: string;
    [property: string]: any;
}

/**
 * Oidc Configuration for Confidential Client Type
 *
 * Oidc client security configs.
 */
export interface OidcClientConfig {
    /**
     * Callback Url.
     */
    callbackUrl?: string;
    /**
     * Client Authentication Method.
     */
    clientAuthenticationMethod?: ClientAuthenticationMethod;
    /**
     * Custom Params.
     */
    customParams?: { [key: string]: any };
    /**
     * Disable PKCE.
     */
    disablePkce?: boolean;
    /**
     * Discovery Uri for the Client.
     */
    discoveryUri?: string;
    /**
     * Client ID.
     */
    id?: string;
    /**
     * Validity for the JWT Token created from SAML Response
     */
    maxAge?: string;
    /**
     * Max Clock Skew
     */
    maxClockSkew?: string;
    /**
     * Preferred Jws Algorithm.
     */
    preferredJwsAlgorithm?: string;
    /**
     * Prompt whether login/consent
     */
    prompt?: string;
    /**
     * Auth0 Client Secret Key.
     */
    responseType?: string;
    /**
     * Oidc Request Scopes.
     */
    scope?: string;
    /**
     * Client Secret.
     */
    secret?: string;
    /**
     * Server Url.
     */
    serverUrl?: string;
    /**
     * Validity for the Session in case of confidential clients
     */
    sessionExpiry?: number;
    /**
     * Tenant in case of Azure.
     */
    tenant?: string;
    /**
     * Validity for the JWT Token created from SAML Response
     */
    tokenValidity?: number;
    /**
     * IDP type (Example Google,Azure).
     */
    type?: string;
    /**
     * Use Nonce.
     */
    useNonce?: string;
}

/**
 * Client Authentication Method.
 */
export enum ClientAuthenticationMethod {
    ClientSecretBasic = "client_secret_basic",
    ClientSecretJwt = "client_secret_jwt",
    ClientSecretPost = "client_secret_post",
    PrivateKeyJwt = "private_key_jwt",
}

/**
 * This is used by auth provider provide response as either id_token or code.
 *
 * Response Type
 */
export enum ResponseType {
    Code = "code",
    IDToken = "id_token",
}

/**
 * Saml Configuration that is applicable only when the provider is Saml
 *
 * SAML SSO client security configs.
 */
export interface SamlSSOClientConfig {
    /**
     * Get logs from the Library in debug mode
     */
    debugMode?: boolean;
    idp:        Idp;
    security?:  Security;
    sp:         SP;
}

/**
 * This schema defines defines the identity provider config.
 */
export interface Idp {
    /**
     * Authority URL to redirect the users on Sign In page
     */
    authorityUrl?: string;
    /**
     * Identity Provider Entity ID usually same as the SSO login URL.
     */
    entityId: string;
    /**
     * X509 Certificate
     */
    idpX509Certificate?: string;
    /**
     * Authority URL to redirect the users on Sign In page
     */
    nameId?: string;
    /**
     * SSO Login URL.
     */
    ssoLoginUrl: string;
}

/**
 * This schema defines defines the security config for SAML.
 */
export interface Security {
    /**
     * KeyStore Alias
     */
    keyStoreAlias?: string;
    /**
     * KeyStore File Path
     */
    keyStoreFilePath?: string;
    /**
     * KeyStore Password
     */
    keyStorePassword?: string;
    /**
     * Encrypt Name Id while sending requests from SP.
     */
    sendEncryptedNameId?: boolean;
    /**
     * Sign the Authn Request while sending.
     */
    sendSignedAuthRequest?: boolean;
    /**
     * Want the Metadata of this SP to be signed.
     */
    signSpMetadata?: boolean;
    /**
     * Only accept valid signed and encrypted assertions if the relevant flags are set
     */
    strictMode?: boolean;
    /**
     * Validity for the JWT Token created from SAML Response
     */
    tokenValidity?: number;
    /**
     * In case of strict mode whether to validate XML format.
     */
    validateXml?: boolean;
    /**
     * SP requires the assertion received to be encrypted.
     */
    wantAssertionEncrypted?: boolean;
    /**
     * SP requires the assertions received to be signed.
     */
    wantAssertionsSigned?: boolean;
    /**
     * SP requires the messages received to be signed.
     */
    wantMessagesSigned?: boolean;
}

/**
 * This schema defines defines the identity provider config.
 */
export interface SP {
    /**
     * Assertion Consumer URL.
     */
    acs: string;
    /**
     * Service Provider Entity ID usually same as the SSO login URL.
     */
    callback: string;
    /**
     * Service Provider Entity ID.
     */
    entityId: string;
    /**
     * Sp Private Key for Signing and Encryption Only
     */
    spPrivateKey?: string;
    /**
     * X509 Certificate
     */
    spX509Certificate?: string;
}

/**
 * This schema defines the language options available for search index mappings.
 */
export enum SearchIndexMappingLanguage {
    En = "EN",
    Jp = "JP",
    Zh = "ZH",
}

/**
 * This enum defines the search Type elastic/open search.
 */
export enum SearchType {
    Elasticsearch = "elasticsearch",
    Opensearch = "opensearch",
}

/**
 * OpenMetadata Secrets Manager Client Loader. Lets the client know how the Secrets Manager
 * Credentials should be loaded from the environment.
 */
export enum SecretsManagerClientLoader {
    Airflow = "airflow",
    Env = "env",
    Noop = "noop",
}

/**
 * OpenMetadata Client SSL configuration. This SSL information is about the OpenMetadata
 * server. It will be picked up from the pipelineServiceClient to use/ignore SSL when
 * connecting to the OpenMetadata server.
 *
 * Client SSL configuration
 *
 * OpenMetadata Client configured to validate SSL certificates.
 */
export interface Config {
    /**
     * The CA certificate used for SSL validation.
     */
    caCertificate?: string;
    /**
     * The SSL certificate used for client authentication.
     */
    sslCertificate?: string;
    /**
     * The private key associated with the SSL certificate.
     */
    sslKey?: string;
}

export enum Templates {
    Collate = "collate",
    Openmetadata = "openmetadata",
}

/**
 * Token Validation Algorithm to use.
 */
export enum TokenValidationAlgorithm {
    Rs256 = "RS256",
    Rs384 = "RS384",
    Rs512 = "RS512",
}

export enum TransportationStrategy {
    SMTP = "SMTP",
    SMTPTLS = "SMTP_TLS",
    Smtps = "SMTPS",
}

/**
 * Client SSL verification policy when connecting to the OpenMetadata server: no-ssl,
 * ignore, validate.
 *
 * Client SSL verification. Make sure to configure the SSLConfig if enabled.
 */
export enum VerifySSL {
    Ignore = "ignore",
    NoSSL = "no-ssl",
    Validate = "validate",
}
