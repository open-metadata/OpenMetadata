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
 * Result of a dry-run SSO Test Login. Resolves the identity, roles, teams and domain
 * outcome a candidate security configuration would produce for a real login, WITHOUT
 * creating a user, issuing any token, or starting a session.
 */
export interface TestLoginResult {
    domainCheck?: DomainCheck;
    /**
     * Human-readable failure reasons (only present when status is 'failed').
     */
    errors?: string[];
    /**
     * Roles that would be assigned from the provider claims.
     */
    mappedRoles?: string[];
    /**
     * Teams that would be derived from the team claim mapping.
     */
    mappedTeams?: string[];
    protocol?:    Protocol;
    /**
     * Email that would be associated with the login.
     */
    resolvedEmail?: string;
    /**
     * Username/principal that would be used for the login.
     */
    resolvedPrincipal?: string;
    /**
     * Furthest stage reached.
     */
    stage?: Stage;
    /**
     * Ordered timeline of every stage of the round-trip, for a staged progress view.
     */
    stages?: StageResult[];
    /**
     * Overall outcome of the test login.
     */
    status: Status;
}

/**
 * Outcome of applying the authorizer domain rules to the resolved identity.
 */
export interface DomainCheck {
    /**
     * Whether enforcePrincipalDomain is enabled.
     */
    enforced?: boolean;
    /**
     * Whether the resolved identity satisfies the domain rules.
     */
    passed?: boolean;
    /**
     * Configured principal domain.
     */
    principalDomain?: string;
    /**
     * Domain extracted from the resolved email/principal. Absent when the resolved identity
     * carries no domain.
     */
    resolvedDomain?: string;
}

/**
 * Authentication protocol exercised by the test login.
 */
export enum Protocol {
    Basic = "basic",
    LDAP = "ldap",
    Oidc = "oidc",
    Saml = "saml",
}

/**
 * Furthest stage reached.
 *
 * A step of the login round-trip. Not every protocol emits every stage: the
 * browser-redirect stages apply to OIDC and SAML, CREDENTIALS_VERIFIED applies to LDAP and
 * Basic, and the stages that do not apply are reported with status 'skipped'.
 */
export enum Stage {
    ClaimsExtracted = "CLAIMS_EXTRACTED",
    CredentialsVerified = "CREDENTIALS_VERIFIED",
    DomainChecked = "DOMAIN_CHECKED",
    IdentityResolved = "IDENTITY_RESOLVED",
    Redirected = "REDIRECTED",
    RolesMapped = "ROLES_MAPPED",
    Started = "STARTED",
    TokenReceived = "TOKEN_RECEIVED",
    TokenValidated = "TOKEN_VALIDATED",
}

/**
 * Outcome of one stage of the login round-trip.
 */
export interface StageResult {
    /**
     * Human-readable detail for this stage.
     */
    message?: string;
    stage:    Stage;
    status:   StageStatus;
}

/**
 * Outcome of an individual stage. SKIPPED means the stage does not apply to this protocol.
 */
export enum StageStatus {
    Failed = "failed",
    Passed = "passed",
    Pending = "pending",
    Running = "running",
    Skipped = "skipped",
}

/**
 * Overall outcome of the test login.
 */
export enum Status {
    Failed = "failed",
    Pending = "pending",
    Success = "success",
}
