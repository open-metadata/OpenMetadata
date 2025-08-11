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
 * This schema defines the Auth Config.
 */
export interface AuthConfig {
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
