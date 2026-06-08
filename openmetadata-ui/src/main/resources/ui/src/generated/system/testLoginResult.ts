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
    /**
     * Email that would be associated with the login.
     */
    resolvedEmail?: string;
    /**
     * Username/principal that would be used for the login.
     */
    resolvedPrincipal?: string;
    /**
     * Furthest stage reached before a failure (TOKEN_VALIDATED, CLAIMS_EXTRACTED,
     * IDENTITY_RESOLVED, DOMAIN_CHECKED, ROLES_MAPPED).
     */
    stage?: string;
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
     * Domain extracted from the resolved email/principal.
     */
    resolvedDomain?: string;
}

/**
 * Overall outcome of the test login.
 */
export enum Status {
    Failed = "failed",
    Success = "success",
}
