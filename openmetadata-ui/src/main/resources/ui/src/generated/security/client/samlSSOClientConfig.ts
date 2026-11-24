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
 * SAML SSO client security configs.
 */
export interface SamlSSOClientConfig {
    /**
     * Get logs from the Library in debug mode
     */
    debugMode?: boolean;
    idp:        Idp;
    /**
     * Ordered list of SAML attribute names to check for display name. First available attribute
     * wins. Defaults to common OIDC/SAML attribute names.
     */
    samlDisplayNameAttributes?: string[];
    security?:                  Security;
    sp:                         SP;
}

/**
 * This schema defines defines the identity provider config.
 */
export interface Idp {
    /**
     * Authority URL (deprecated, use entityId instead).
     */
    authorityUrl?: string;
    /**
     * Identity Provider Entity ID usually same as the SSO login URL.
     */
    entityId: string;
    /**
     * IdP signing certificate(s): a PEM certificate or concatenated PEM bundle; a single base64
     * DER certificate is also accepted. Saving requires at least one currently valid
     * certificate. At runtime every configured certificate is trusted, including expired and
     * future rollover ones, so remove a retired key explicitly.
     */
    idpX509Certificate?: string;
    /**
     * Name ID format for SAML assertions
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
     * Enable strict SAML protocol checks and the Want Messages Signed / Want Assertions Signed
     * policies. Require Encrypted Assertions applies independently of strict mode.
     */
    strictMode?: boolean;
    /**
     * Lifetime in seconds of the OpenMetadata JWT issued after SAML authentication.
     */
    tokenValidity?: number;
    /**
     * In case of strict mode whether to validate XML format.
     */
    validateXml?: boolean;
    /**
     * Reject plaintext assertions even when Strict Mode is off. Optional and disabled by
     * default. Requires an SP private key and matching certificate; configure token encryption
     * at the IdP too. Providing an SP key alone does not require encryption.
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
