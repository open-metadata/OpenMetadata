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
 * Request to create User entity
 */
export interface CreateUser {
    /**
     * Authentication mechanism specified
     */
    authenticationMechanism?: AuthenticationMechanism;
    /**
     * User bot name if we want to associate this bot with an specific bot
     */
    botName?: string;
    /**
     * Confirm Password for User
     */
    confirmPassword?: string;
    /**
     * User Password Method
     */
    createPasswordType?: CreatePasswordType;
    /**
     * Default Persona from User's Personas.
     */
    defaultPersona?: EntityReference;
    /**
     * Used for user biography.
     */
    description?: string;
    /**
     * Name used for display purposes. Example 'FirstName LastName'
     */
    displayName?: string;
    /**
     * Domains the User belongs to.
     */
    domains?: string[];
    email:    string;
    /**
     * External identifier from identity provider (used for SCIM).
     */
    externalId?: string;
    /**
     * When true indicates user is an administrator for the system with superuser privileges
     */
    isAdmin?: boolean;
    /**
     * When true indicates user is a bot with appropriate privileges
     */
    isBot?: boolean;
    name:   string;
    /**
     * Password for User
     */
    password?: string;
    /**
     * Persona that the user belongs to.
     */
    personas?: EntityReference[];
    /**
     * Profile of the user.
     */
    profile?: Profile;
    /**
     * Roles that the user has been assigned
     */
    roles?: string[];
    /**
     * Raw user name from SCIM.
     */
    scimUserName?: string;
    /**
     * Teams that the user belongs to
     */
    teams?: string[];
    /**
     * Timezone of the user
     */
    timezone?: string;
}

/**
 * Authentication mechanism specified
 *
 * User/Bot Authentication Mechanism.
 */
export interface AuthenticationMechanism {
    authType?: AuthType;
    config?:   AuthMechanism;
}

export enum AuthType {
    Basic = "BASIC",
    Jwt = "JWT",
    Sso = "SSO",
}

/**
 * User/Bot SSOAuthN.
 *
 * User/Bot JWTAuthMechanism.
 *
 * User basic Auth Mechanism.
 */
export interface AuthMechanism {
    /**
     * The authentication configuration used by the SSO
     */
    authConfig?: SsoClientConfig;
    /**
     * Type of database service such as Amundsen, Atlas...
     */
    ssoServiceType?: SsoServiceType;
    /**
     * JWT Auth Token.
     */
    JWTToken?: string;
    /**
     * JWT Auth Token expiration time.
     */
    JWTTokenExpiresAt?: number;
    JWTTokenExpiry?:    JWTTokenExpiry;
    /**
     * User Password
     */
    password?: string;
}

/**
 * JWT Auth Token expiration in days
 */
export enum JWTTokenExpiry {
    OneHour = "OneHour",
    The1 = "1",
    The30 = "30",
    The60 = "60",
    The7 = "7",
    The90 = "90",
    Unlimited = "Unlimited",
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

/**
 * User Password Method
 */
export enum CreatePasswordType {
    AdminCreate = "ADMIN_CREATE",
    UserCreate = "USER_CREATE",
}

/**
 * Default Persona from User's Personas.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Persona that the user belongs to.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 */
export interface EntityReference {
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type: string;
}

/**
 * Profile of the user.
 *
 * This schema defines the type for a profile of a user, team, or organization.
 */
export interface Profile {
    images?:       ImageList;
    subscription?: MessagingProvider;
}

/**
 * Links to a list of images of varying resolutions/sizes.
 */
export interface ImageList {
    image?:    string;
    image192?: string;
    image24?:  string;
    image32?:  string;
    image48?:  string;
    image512?: string;
    image72?:  string;
}

/**
 * Holds the Subscription Config for different types
 */
export interface MessagingProvider {
    gChat?:   Webhook;
    generic?: Webhook;
    msTeams?: Webhook;
    slack?:   Webhook;
}

/**
 * This schema defines webhook for receiving events from OpenMetadata.
 */
export interface Webhook {
    /**
     * Endpoint to receive the webhook events over POST requests.
     */
    endpoint?: string;
    /**
     * Custom headers to be sent with the webhook request.
     */
    headers?: { [key: string]: any };
    /**
     * HTTP operation to send the webhook request. Supports POST or PUT.
     */
    httpMethod?: HTTPMethod;
    /**
     * Query parameters to be added to the webhook request URL.
     */
    queryParams?: { [key: string]: any };
    /**
     * List of receivers to send mail to
     */
    receivers?: string[];
    /**
     * Secret set by the webhook client used for computing HMAC SHA256 signature of webhook
     * payload and sent in `X-OM-Signature` header in POST requests to publish the events.
     */
    secretKey?: string;
    /**
     * Send the Event to Admins
     */
    sendToAdmins?: boolean;
    /**
     * Send the Event to Followers
     */
    sendToFollowers?: boolean;
    /**
     * Send the Event to Owners
     */
    sendToOwners?: boolean;
}

/**
 * HTTP operation to send the webhook request. Supports POST or PUT.
 */
export enum HTTPMethod {
    Post = "POST",
    Put = "PUT",
}
