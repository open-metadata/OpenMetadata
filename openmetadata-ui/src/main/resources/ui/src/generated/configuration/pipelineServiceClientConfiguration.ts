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
 * This schema defines the Pipeline Service Client Configuration
 */
export interface PipelineServiceClientConfiguration {
    /**
     * External API root to interact with the Pipeline Service Client
     */
    apiEndpoint: string;
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
     */
    className: string;
    /**
     * Flags if the ingestion from the OpenMetadata UI is enabled. If ingesting externally, we
     * can set this value to false to not check the Pipeline Service Client component health.
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
    metadataApiEndpoint: string;
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
