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
 * User/Bot SSOAuthN.
 */
export interface SsoAuth {
    /**
     * The authentication configuration used by the SSO
     */
    authConfig?: SsoClientConfig;
    /**
     * Type of database service such as Amundsen, Atlas...
     */
    ssoServiceType?: SsoServiceType;
}

/**
 * The authentication configuration used by the SSO
 *
 * Google SSO Configuration
 *
 * Google SSO client security configs.
 *
 * Okta SSO Configuration
 *
 * Okta SSO client security configs.
 *
 * Auth0 SSO Configuration
 *
 * Auth0 SSO client security configs.
 *
 * Azure SSO Configuration
 *
 * Azure SSO Client security config to connect to OpenMetadata.
 *
 * Custom OIDC SSO Configuration
 *
 * Custom OIDC SSO client security configs.
 *
 * SAML SSO Configuration
 *
 * SAML SSO client security configs.
 */
export interface SsoClientConfig {
    /**
     * Google SSO audience URL
     */
    audience?: string;
    /**
     * Google SSO client secret key path or contents.
     *
     * Auth0 Client Secret Key.
     *
     * Custom OIDC Client Secret Key.
     */
    secretKey?: string;
    /**
     * Okta Client ID.
     *
     * Auth0 Client ID.
     *
     * Azure Client ID.
     *
     * Custom OIDC Client ID.
     */
    clientId?: string;
    /**
     * Okta Service account Email.
     */
    email?: string;
    /**
     * Okta org url.
     */
    orgURL?: string;
    /**
     * Okta Private Key.
     */
    privateKey?: string;
    /**
     * Okta client scopes.
     *
     * Azure Client ID.
     */
    scopes?: string[];
    /**
     * Auth0 Domain.
     */
    domain?: string;
    /**
     * Azure SSO Authority
     */
    authority?: string;
    /**
     * Azure SSO client secret key
     */
    clientSecret?: string;
    /**
     * Custom OIDC token endpoint.
     */
    tokenEndpoint?: string;
    /**
     * Get logs from the Library in debug mode
     */
    debugMode?: boolean;
    idp?:       Idp;
    security?:  Security;
    sp?:        SP;
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
 * Type of database service such as Amundsen, Atlas...
 */
export enum SsoServiceType {
    Auth0 = "auth0",
    Azure = "azure",
    CustomOidc = "custom-oidc",
    Google = "google",
    Okta = "okta",
}
