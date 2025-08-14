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
 * This schema defines the Authentication Configuration.
 */
export interface AuthenticationConfiguration {
    /**
     * Authentication Authority
     */
    authority: string;
    /**
     * Callback URL
     */
    callbackUrl: string;
    /**
     * Client ID
     */
    clientId: string;
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
    jwtPrincipalClaims: string[];
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
    provider:           AuthProvider;
    /**
     * Custom OIDC Authentication Provider Name
     */
    providerName: string;
    /**
     * List of Public Key URLs
     */
    publicKeyUrls: string[];
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
}

/**
 * Client Type
 */
export enum ClientType {
    Confidential = "confidential",
    Public = "public",
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
 * Token Validation Algorithm to use.
 */
export enum TokenValidationAlgorithm {
    Es256 = "ES256",
    Es384 = "ES384",
    Es512 = "ES512",
    Rs256 = "RS256",
    Rs384 = "RS384",
    Rs512 = "RS512",
}
